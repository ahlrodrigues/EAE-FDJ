// === backend/lib/backupRun.js ===============================================
// Modo híbrido de execução de backup para Google Drive:
// 1) Se existir Service Account JSON em:
//    ~/.config/escola-aprendizes/credentials/google-drive-service.json
//    → usa Service Account (sem consent)
// 2) Caso contrário → usa OAuth (tokens criptografados em usuario.json)
//
// Integra com:
// - backend/lib/usuarioStore: carregarUsuarioJsonSeguro, salvarUsuarioJsonSeguro, descriptografarCampo
// - backend/lib/googleDriveClient: GoogleDriveClient (para o caminho OAuth)
//
// Logs detalhados e falhas não interrompem o processo de forma abrupta.

const fs = require("fs");
const path = require("path");
const os = require("os");
const { google } = require("googleapis");

const {
  carregarUsuarioJsonSeguro,
  salvarUsuarioJsonSeguro,
  descriptografarCampo,
} = require("./usuarioStore");

const { GoogleDriveClient } = require("./googleDriveClient");

// ---------- Utilidades Serviço de Conta ----------
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
  if (remoto && remoto.md5Checksum === md5Local) return false;

  const media = { mimeType: guessMime(filePath), body: fs.createReadStream(filePath) };
  if (remoto) {
    await drive.files.update({ fileId: remoto.id, media, fields: "id,md5Checksum,modifiedTime" });
  } else {
    await drive.files.create({
      requestBody: { name: fileName, parents: [folderId] },
      media,
      fields: "id,md5Checksum,modifiedTime",
    });
  }
  return true;
}

// ---------- Núcleo de envio (híbrido) ----------
async function getDriveClientFromConfig(backupCfg) {
  if (hasServiceJson()) {
    const sa = readServiceJson();
    const auth = buildJwtAuthFromServiceJson(sa);
    const drive = google.drive({ version: "v3", auth });
    return { mode: "service", drive };
  }
  if (!backupCfg?.oauthTokenEnc) {
    throw new Error("Conta Google não conectada (Service JSON ausente e OAuth não configurado).");
  }
  const tokens = JSON.parse(descriptografarCampo(backupCfg.oauthTokenEnc));
  const client = new GoogleDriveClient(tokens); // possui this.drive
  return { mode: "oauth", drive: client.drive, client };
}

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
          console.warn("⚠️ [backupRun] Falha ao enviar arquivo:", p, e?.message || e);
        }
      }
    }
    return count;
  };

  let enviados = 0;
  enviados += await enviarDir(notasDir);
  enviados += await enviarDir(temasDir);
  return enviados;
}

// ---------- API pública ----------
/**
 * Executa backup completo (notas + temas) no destino configurado.
 * Atualiza `backup.ultimoBackupISO` em usuario.json.
 */
async function execute() {
  console.log("▶️ [backupRun] Execução iniciada…");
  const all = await carregarUsuarioJsonSeguro();
  const b = all?.backup || {};
  if (b.servico !== "google-drive") {
    console.log("ℹ️ [backupRun] Serviço não é Google Drive. Abortando.");
    return { enviados: 0, motivo: "serviço-incompativel" };
  }
  if (!b.pastaRemota) {
    console.log("ℹ️ [backupRun] Pasta remota ausente. Abortando.");
    return { enviados: 0, motivo: "pasta-remota-ausente" };
  }

  const enviados = await enviarDiretoriosPadrao(b);
  all.backup.ultimoBackupISO = new Date().toISOString();
  await salvarUsuarioJsonSeguro(all);

  console.log("✅ [backupRun] Concluído. Enviados:", enviados);
  return { enviados, ultimoBackupISO: all.backup.ultimoBackupISO };
}

module.exports = { execute };
