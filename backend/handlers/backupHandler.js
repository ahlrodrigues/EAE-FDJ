// === backend/handlers/backupHandler.js ======================================
/**
 * Handlers de backup:
 *  - backup:carregar-config
 *  - backup:salvar-config
 *  - backup:iniciar-oauth  (fallback automático: usa Service Account se JSON existir)
 *  - backup:testar-conexao
 *  - backup:executar-agora
 *
 * Fluxo híbrido e automático:
 *  1) Se existir arquivo JSON de Service Account em:
 *     ~/.config/escola-aprendizes/credentials/google-drive-service.json
 *     -> usa Service Account (sem consent do usuário)
 *  2) Senão, usa OAuth Installed App (fluxo anterior via runInstalledAppOAuth)
 *
 * Requisitos:
 *  - ./backend/lib/usuarioStore: { carregarUsuarioJsonSeguro, salvarUsuarioJsonSeguro, descriptografarCampo, criptografarCampo }
 *  - ./backend/lib/googleDriveClient: { GoogleDriveClient }  (caminho OAuth)
 *  - ./backend/lib/googleOAuth: { runInstalledAppOAuth }     (caminho OAuth)
 */

const path = require("path");
const fs = require("fs");
const os = require("os");
const { ipcMain } = require("electron");
const { google } = require("googleapis");

const {
  carregarUsuarioJsonSeguro,
  salvarUsuarioJsonSeguro,
  descriptografarCampo,
} = require("../lib/usuarioStore");

const { GoogleDriveClient } = require("../lib/googleDriveClient");
const { runInstalledAppOAuth } = require("../lib/googleOAuth");

// Caminho padrão do JSON de Service Account (automático)
function getServiceJsonDefaultPath() {
  const home = process.env.HOME || process.env.USERPROFILE || os.homedir();
  return path.join(home, ".config", "escola-aprendizes", "credentials", "google-drive-service.json");
}

function hasServiceJson() {
  const p = getServiceJsonDefaultPath();
  try { return fs.existsSync(p) && fs.statSync(p).isFile(); } catch { return false; }
}

function readServiceJson() {
  const p = getServiceJsonDefaultPath();
  const raw = fs.readFileSync(p, "utf-8");
  const json = JSON.parse(raw);
  if (!json.client_email || !json.private_key) {
    throw new Error("Arquivo JSON inválido (client_email/private_key ausentes).");
  }
  return json;
}

function buildJwtAuthFromServiceJson(sa) {
  const scopes = ["https://www.googleapis.com/auth/drive.file"];
  return new google.auth.JWT(sa.client_email, null, sa.private_key, scopes);
}

// --------- Helpers para Drive (Service Account) ---------
async function ensureFolderPathJWT(drive, pathStr) {
  const parts = String(pathStr || "").split("/").map(s => s.trim()).filter(Boolean);
  if (!parts.length) throw new Error("Caminho remoto inválido.");
  let parentId = null;
  for (const name of parts) {
    parentId = await getOrCreateFolderJWT(drive, name, parentId);
  }
  return parentId;
}

async function getOrCreateFolderJWT(drive, name, parentId) {
  const q = [
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false",
    `name = '${name.replace(/'/g, "\\'")}'`,
  ];
  if (parentId) q.push(`'${parentId}' in parents`);
  const { data } = await drive.files.list({
    q: q.join(" and "),
    fields: "files(id,name)",
    pageSize: 1,
  });
  const found = data?.files?.[0];
  if (found) return found.id;

  const { data: created } = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    },
    fields: "id,name",
  });
  return created.id;
}

async function findFileInFolderByNameJWT(drive, parentId, fileName) {
  const { data } = await drive.files.list({
    q: `trashed = false and '${parentId}' in parents and name = '${fileName.replace(/'/g, "\\'")}'`,
    fields: "files(id,name,md5Checksum,modifiedTime)",
    pageSize: 1,
  });
  return data?.files?.[0] || null;
}

function guessMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".txt" || ext === ".log") return "text/plain";
  if (ext === ".json") return "application/json";
  if (ext === ".md") return "text/markdown";
  return "application/octet-stream";
}

function md5File(filePath) {
  const crypto = require("crypto");
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("md5");
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function enviarIncrementalJWT(drive, pastaRemota, filePath) {
  const folderId = await ensureFolderPathJWT(drive, pastaRemota);
  const fileName = path.basename(filePath);
  if (!fs.existsSync(filePath)) return false;

  const md5Local = await md5File(filePath);
  const remoto = await findFileInFolderByNameJWT(drive, folderId, fileName);
  if (remoto && remoto.md5Checksum === md5Local) {
    return false; // nada a enviar
  }

  const media = {
    mimeType: guessMime(filePath),
    body: fs.createReadStream(filePath),
  };

  if (remoto) {
    await drive.files.update({
      fileId: remoto.id,
      media,
      fields: "id,md5Checksum,modifiedTime",
    });
  } else {
    await drive.files.create({
      requestBody: { name: fileName, parents: [folderId] },
      media,
      fields: "id,md5Checksum,modifiedTime",
    });
  }
  return true;
}

// --------- Abstração para obter cliente do Drive conforme modo ---------
async function getDriveClientFromConfig(backupCfg) {
  if (hasServiceJson()) {
    // Service Account
    const sa = readServiceJson();
    const auth = buildJwtAuthFromServiceJson(sa);
    const drive = google.drive({ version: "v3", auth });
    return { mode: "service", drive };
  }
  // OAuth (tokens no usuario.json)
  if (!backupCfg?.oauthTokenEnc) {
    throw new Error("Conta Google não conectada (OAuth ausente e JSON de service account não encontrado).");
  }
  const tokens = JSON.parse(descriptografarCampo(backupCfg.oauthTokenEnc));
  const client = new GoogleDriveClient(tokens);
  return { mode: "oauth", drive: client.drive, client };
}

// --------- Núcleo de envio de diretórios padrão ---------
async function enviarDiretoriosPadrao(backupCfg) {
  const home = process.env.HOME || process.env.USERPROFILE || os.homedir();
  const notasDir = path.join(home, ".config", "escola-aprendizes", "notas");
  const temasDir = path.join(home, ".config", "escola-aprendizes", "temas");
  const pastaRemota = backupCfg.pastaRemota;

  const { mode, drive, client } = await getDriveClientFromConfig(backupCfg);

  const enviarDir = async (dir) => {
    if (!fs.existsSync(dir)) return 0;
    let count = 0;
    for (const entry of fs.readdirSync(dir)) {
      const p = path.join(dir, entry);
      if (fs.statSync(p).isFile()) {
        try {
          if (mode === "service") {
            if (await enviarIncrementalJWT(drive, pastaRemota, p)) count++;
          } else {
            if (await client.enviarIncremental(pastaRemota, p)) count++;
          }
        } catch (e) {
          console.warn("⚠️ [backupHandler] Falha ao enviar arquivo:", p, e?.message || e);
        }
      }
    }
    return count;
  };

  const enviados = (await enviarDir(notasDir)) + (await enviarDir(temasDir));
  return enviados;
}

// --------- Validações simples ---------
function _validaHorario(hhmm) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(hhmm || ""));
}
function _padraoHorario(modo, horario) {
  if (modo !== "agendado") return "22:30";
  return _validaHorario(horario) ? horario : "22:30";
}

function registrarBackupHandler() {
  console.log("🔧 [backupHandler] Registrando handlers de backup…");

  // Carregar configurações
  ipcMain.handle("backup:carregar-config", async () => {
    try {
      const all = await carregarUsuarioJsonSeguro();
      const b = all?.backup || {};
      const cfg = {
        servico: b.servico || "",
        pastaRemota: b.pastaRemota || "EscolaAprendizes/Backups",
        modo: b.modo || "manual",
        horario: b.horario || "22:30",
        ultimoBackupISO: b.ultimoBackupISO || null,
        conectado: Boolean(b.oauthTokenEnc),               // status OAuth
        conectadoService: hasServiceJson(),                // status Service Account (auto)
      };
      console.log("📦 [backupHandler] carregar-config:", cfg);
      return { ok: true, backup: cfg };
    } catch (e) {
      console.error("❌ [backupHandler] Falha ao carregar config:", e?.message || e);
      return { ok: false, mensagem: e?.message || "Erro ao carregar configuração." };
    }
  });

  // Salvar configurações e (re)agendar
  ipcMain.handle("backup:salvar-config", async (_evt, cfgIn) => {
    try {
      const { servico, pastaRemota, modo, horario } = cfgIn || {};
      if (!servico) throw new Error("Serviço não informado.");
      if (!pastaRemota || !String(pastaRemota).trim()) throw new Error("Pasta remota inválida.");
      if (!["manual", "agendado", "continuo"].includes(modo)) throw new Error("Modo inválido.");
      const hhmm = _padraoHorario(modo, horario);

      const all = await carregarUsuarioJsonSeguro();
      all.backup = all.backup || {};

      // preserva token e último backup
      const { oauthTokenEnc, ultimoBackupISO } = all.backup;

      all.backup = {
        servico,
        pastaRemota: String(pastaRemota).trim(),
        modo,
        horario: hhmm,
        oauthTokenEnc: oauthTokenEnc || null,
        ultimoBackupISO: ultimoBackupISO || null,
      };

      await salvarUsuarioJsonSeguro(all);
      console.log("💾 [backupHandler] Config de backup salva:", all.backup);

      // (re)agendar
      if (modo === "agendado") {
        ipcMain.emit("backup:schedule:update", null, hhmm);
      } else {
        // cancelar/neutralizar via canal já existente (seu main.js decide)
        ipcMain.emit("backup:schedule:update", null, "22:30");
      }

      return { ok: true, backup: all.backup, schedule: modo === "agendado" ? `diário ${hhmm}` : "não agendado" };
    } catch (e) {
      console.error("❌ [backupHandler] Falha ao salvar config:", e?.message || e);
      return { ok: false, mensagem: e?.message || "Erro ao salvar configuração." };
    }
  });

  // Conectar conta
  ipcMain.handle("backup:iniciar-oauth", async (_evt, servico) => {
    try {
      if (servico !== "google-drive") throw new Error("Serviço não suportado ainda.");

      // Se existir Service JSON, consideramos conectado sem abrir navegador
      if (hasServiceJson()) {
        console.log("🔑 [backupHandler] Detectado Service Account JSON — usando sem OAuth.");
        return { ok: true, mensagem: "Chave de serviço detectada. Conta conectada." };
      }

      console.log("🌐 [backupHandler] Iniciando OAuth Google (Installed App) …");
      await runInstalledAppOAuth();

      // confirma token salvo
      const all = await carregarUsuarioJsonSeguro();
      const ok = !!all?.backup?.oauthTokenEnc;
      console.log("🔑 [backupHandler] OAuth concluído. Token salvo?", ok);
      return { ok, mensagem: ok ? "Conta conectada com sucesso." : "Token não foi salvo." };
    } catch (e) {
      console.error("❌ [backupHandler] OAuth/Conexão falhou:", e?.message || e);
      return { ok: false, mensagem: e?.message || "Erro na autorização." };
    }
  });

  // Testar conexão
  ipcMain.handle("backup:testar-conexao", async () => {
    try {
      const all = await carregarUsuarioJsonSeguro();
      const b = all?.backup || {};
      if (b.servico !== "google-drive") {
        return { ok: false, detalhes: "Serviço não configurado como Google Drive." };
      }
      if (!b.pastaRemota) {
        return { ok: false, detalhes: "Pasta remota não configurada." };
      }

      // Service Account
      if (hasServiceJson()) {
        const sa = readServiceJson();
        const auth = buildJwtAuthFromServiceJson(sa);
        const drive = google.drive({ version: "v3", auth });
        await ensureFolderPathJWT(drive, b.pastaRemota);
        return { ok: true, detalhes: "Service Account OK e pasta acessível." };
      }

      // OAuth
      if (!b.oauthTokenEnc) {
        return { ok: false, detalhes: "Conta não conectada (OAuth ausente) e JSON de serviço não encontrado." };
      }
      const tokens = JSON.parse(descriptografarCampo(b.oauthTokenEnc));
      const client = new GoogleDriveClient(tokens);
      await client.ensureFolderPath(b.pastaRemota);
      return { ok: true, detalhes: "OAuth OK e pasta acessível." };
    } catch (e) {
      console.error("❌ [backupHandler] Teste de conexão falhou:", e?.message || e);
      return { ok: false, detalhes: e?.message || "Falha no teste de conexão." };
    }
  });

  // Executar agora
  ipcMain.handle("backup:executar-agora", async () => {
    try {
      const all = await carregarUsuarioJsonSeguro();
      const b = all?.backup || {};
      if (b.servico !== "google-drive") {
        return { ok: false, mensagem: "Serviço não configurado como Google Drive." };
      }
      if (!b.pastaRemota) {
        return { ok: false, mensagem: "Pasta remota não configurada." };
      }

      const enviados = await enviarDiretoriosPadrao(b);
      all.backup.ultimoBackupISO = new Date().toISOString();
      await salvarUsuarioJsonSeguro(all);

      console.log("✅ [backupHandler] Execução manual concluída. Enviados:", enviados);
      return { ok: true, enviados, ultimoBackupISO: all.backup.ultimoBackupISO };
    } catch (e) {
      console.error("❌ [backupHandler] Execução manual falhou:", e?.message || e);
      return { ok: false, mensagem: e?.message || "Erro ao executar backup." };
    }
  });

  console.log("✅ [backupHandler] Handlers de backup registrados.");
}

module.exports = { registrarBackupHandler };
