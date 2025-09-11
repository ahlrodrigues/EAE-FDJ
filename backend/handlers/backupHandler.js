// ============================================================================
// Caminho: backend/handlers/backupHandler.js
// Responsável por: configuração, OAuth, teste de conexão e execução de backup.
// Logs com prefixo padronizado: 📦 [backup]
// ============================================================================

const { ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");

// Agendador
const { startSchedule, stopSchedule } = require("./backupSchedule");

// Store do usuário (criptografia/persistência)
const {
  carregarUsuarioJsonSeguro,
  salvarUsuarioJsonSeguro,
  descriptografarCampo,
  criptografarCampo,
} = require("../lib/usuarioStore");

// Cliente do Drive
const { GoogleDriveClient } = require("../lib/googleDriveClient");

// OAuth (preferência por googleAuth; fallback para googleOAuth se houver)
let oauthLib = null;
try {
  oauthLib = require("../lib/googleAuth"); // recomendado
  console.log("📦 [backup] OAuth lib: ../lib/googleAuth");
} catch {
  try {
    // ⚠️ Correção: antes tentava carregar googleAuth de novo — agora tenta googleOAuth
    oauthLib = require("../lib/googleOAuth"); // fallback
    console.warn("📦 [backup] Usando fallback ../lib/googleOAuth (recomenda-se migrar para ../lib/googleAuth).");
  } catch {
    console.warn("📦 [backup] Nenhuma biblioteca OAuth encontrada (googleAuth/googleOAuth).");
    oauthLib = null;
  }
}

const LOG = "📦 [backup]";

// ----------------------------------------------------------------------------
// Helpers de caminho
// ----------------------------------------------------------------------------
function getLocalBackupDir(emailHash, pastaNome) {
  const home = process.env.HOME || process.env.USERPROFILE || os.homedir();
  return path.join(home, ".config", "escola-aprendizes", "backups", emailHash, pastaNome);
}

function getRemoteBackupPath(pastaNome) {
  return String(pastaNome || "").trim();
}

async function ensureLocalDir(dir) {
  // sincrono é OK aqui; mantém a função async por compatibilidade de chamadas
  fs.mkdirSync(dir, { recursive: true });
  console.log(`${LOG} Pasta local garantida: ${dir}`);
}

/**
 * Garante a existência do caminho remoto no Drive.
 * Prioriza drive.ensureFolderPath(); se não houver, tenta ensureFolder().
 */
async function ensureRemotePath(drive, remotePath) {
  if (!remotePath) return;
  if (typeof drive.ensureFolderPath === "function") {
    await drive.ensureFolderPath(remotePath);
    console.log(`${LOG} Pasta remota garantida (ensureFolderPath): /${remotePath}`);
    return;
  }
  if (typeof drive.ensureFolder === "function") {
    await drive.ensureFolder(remotePath);
    console.log(`${LOG} Pasta remota garantida (ensureFolder): /${remotePath}`);
    return;
  }
  console.warn(`${LOG} Cliente Drive não expõe ensureFolderPath/ensureFolder. Pulei a garantia de pasta remota.`);
}

// ----------------------------------------------------------------------------
// Execução de backup imediato (incremental simples)
// ----------------------------------------------------------------------------
async function executarBackupAgoraInner() {
  const cfgAll = await carregarUsuarioJsonSeguro();
  const emailHash = Object.keys(cfgAll.usuarios || {})[0] || "default";
  const bkp = cfgAll.backup || {};

  if (bkp.servico !== "google-drive" || !bkp.oauthTokenEnc || !bkp.pastaNome) {
    throw new Error("Backup do Google Drive não configurado.");
  }

  // Token descriptografado (armazenado no usuario.json seguro)
  const token = JSON.parse(descriptografarCampo(bkp.oauthTokenEnc));
  const drive = new GoogleDriveClient(token);

  const pastaNome = bkp.pastaNome;
  const localDir = getLocalBackupDir(emailHash, pastaNome);
  const remotePath = getRemoteBackupPath(pastaNome);

  console.log(`${LOG} Iniciando backup agora. Local: ${localDir} → Remoto: /${remotePath}`);

  // Garante pasta remota
  await ensureRemotePath(drive, remotePath);

  // Varredura simples + incremental
  let enviados = 0;
  if (fs.existsSync(localDir)) {
    const entries = fs.readdirSync(localDir);
    for (const entry of entries) {
      const p = path.join(localDir, entry);
      if (fs.statSync(p).isFile()) {
        try {
          const ok = await drive.enviarIncremental(remotePath, p);
          if (ok) {
            enviados++;
            console.log(`${LOG} Enviado: ${entry}`);
          } else {
            console.log(`${LOG} Sem envio (sem mudanças): ${entry}`);
          }
        } catch (e) {
          console.warn(`${LOG} Falha ao enviar arquivo: ${p} →`, e?.message || e);
        }
      }
    }
  } else {
    console.warn(`${LOG} Diretório local não existe: ${localDir}`);
  }

  cfgAll.backup.ultimoBackupISO = new Date().toISOString();
  await salvarUsuarioJsonSeguro(cfgAll);

  console.log(`${LOG} Backup concluído. Arquivos enviados: ${enviados}`);
  return { ok: true, enviados, localDir, remotePath, quando: cfgAll.backup.ultimoBackupISO };
}

// ----------------------------------------------------------------------------
// Registro dos IPCs públicos de backup
// ----------------------------------------------------------------------------
function registrarBackupHandler() {
  console.log(`${LOG} Registrando IPCs de backup…`);

  // Carregar configuração
  ipcMain.handle("backup:carregar-config", async () => {
    try {
      const cfgAll = await carregarUsuarioJsonSeguro();
      const backup = cfgAll.backup || {};
      console.log(`${LOG} Carregar config →`, backup);
      return backup;
    } catch (e) {
      console.error(`${LOG} Falha ao carregar config:`, e?.message || e);
      throw e;
    }
  });

  // Salvar configuração
  ipcMain.handle("backup:salvar-config", async (_evt, cfg) => {
    console.log(`${LOG} Salvar config solicitado.`);
    const cfgAll = await carregarUsuarioJsonSeguro();
    const emailHash = Object.keys(cfgAll.usuarios || {})[0] || "default";

    // Validação básica
    if (!cfg || typeof cfg !== "object") throw new Error("Config inválida.");
    const servico = cfg.servico || "google-drive";
    const pastaNome = String(cfg.pastaNome || "").trim();
    const modo = cfg.modo || "manual";
    const horario = cfg.horario || "22:30";

    if (servico !== "google-drive") throw new Error("Serviço ainda não suportado.");
    if (!pastaNome) throw new Error("Informe o nome da pasta.");

    // Caminhos padronizados
    const localDir = getLocalBackupDir(emailHash, pastaNome);
    const remotePath = getRemoteBackupPath(pastaNome);

    // Cria pasta local
    await ensureLocalDir(localDir);

    // Se já houver token OAuth salvo, garante pasta remota
    const bkpPrev = cfgAll.backup || {};
    const oauthTokenEnc = cfg.oauthTokenEnc || bkpPrev.oauthTokenEnc;

    if (oauthTokenEnc) {
      try {
        const token = JSON.parse(descriptografarCampo(oauthTokenEnc));
        const drive = new GoogleDriveClient(token);
        await ensureRemotePath(drive, remotePath);
      } catch (e) {
        console.warn(`${LOG} Não foi possível garantir pasta remota agora:`, e?.message || e);
      }
    }

    // Persiste
    cfgAll.backup = {
      servico,
      pastaNome,
      modo,
      horario,
      oauthTokenEnc: oauthTokenEnc || null,
      ultimoBackupISO: cfgAll.backup?.ultimoBackupISO || null,
    };
    await salvarUsuarioJsonSeguro(cfgAll);
    console.log(`${LOG} Configuração salva.`, cfgAll.backup);

    // Reagenda se necessário
    if (modo === "agendado" && startSchedule && stopSchedule) {
      try {
        stopSchedule?.();
        startSchedule(horario, async () => {
          try {
            console.log(`${LOG} Execução agendada disparada (${horario}).`);
            await executarBackupAgoraInner();
          } catch (e) {
            console.error(`${LOG} Erro na execução agendada:`, e?.message || e);
          }
        });
        console.log(`${LOG} Agendamento diário ativo para ${horario}.`);
      } catch (e) {
        console.warn(`${LOG} Falha ao configurar agendamento:`, e?.message || e);
      }
    } else if (stopSchedule) {
      stopSchedule?.();
      console.log(`${LOG} Agendamento parado (modo manual).`);
    }

    return { ok: true, localDir, remotePath: `/${pastaNome}` };
  });

  // Iniciar OAuth (Device Code) — biblioteca faz o fluxo completo e retorna tokens
  ipcMain.handle("backup:iniciar-oauth", async (_evt, servico) => {
    console.log(`${LOG} IPC 'backup:iniciar-oauth' acionado. servico=`, servico);
    if (servico && servico !== "google-drive") return { ok: false, erro: "Serviço ainda não suportado." };
    try {
      if (!oauthLib) throw new Error("Biblioteca de OAuth não encontrada (googleAuth/googleOAuth).");

      // Preferência: getAuthorizedClient() — dispara Device Flow se necessário e já salva tokens no lib
      if (typeof oauthLib.getAuthorizedClient === "function") {
        console.log(`${LOG} Iniciando OAuth via getAuthorizedClient().`);
        const auth = await oauthLib.getAuthorizedClient();
        const tokens = auth?.credentials || null;
        if (!tokens || (!tokens.access_token && !tokens.refresh_token)) {
          return { ok: false, erro: "Tokens não retornados pelo autorizador." };
        }

        const cfgAll = await carregarUsuarioJsonSeguro();
        const enc = criptografarCampo(JSON.stringify(tokens));
        cfgAll.backup = { ...(cfgAll.backup || {}), oauthTokenEnc: enc };
        await salvarUsuarioJsonSeguro(cfgAll);

        console.log(`${LOG} OAuth concluído e tokens salvos.`);
        return { ok: true };
      }

      // Compatibilidade: startDeviceFlow() — retorna token final
      if (typeof oauthLib.startDeviceFlow === "function") {
        console.log(`${LOG} Iniciando OAuth via startDeviceFlow().`);
        const token = await oauthLib.startDeviceFlow();
        if (!token) return { ok: false, erro: "Token vazio recebido." };

        const cfgAll = await carregarUsuarioJsonSeguro();
        const enc = criptografarCampo(JSON.stringify(token));
        cfgAll.backup = { ...(cfgAll.backup || {}), oauthTokenEnc: enc };
        await salvarUsuarioJsonSeguro(cfgAll);

        console.log(`${LOG} OAuth concluído (startDeviceFlow) e tokens salvos.`);
        return { ok: true };
      }

      throw new Error("A biblioteca OAuth não expõe getAuthorizedClient() nem startDeviceFlow().");
    } catch (e) {
      console.error(`${LOG} iniciar-oauth:`, e?.message || e);
      return { ok: false, erro: e?.message || "Falha ao iniciar OAuth" };
    }
  });

  // 🔁 Aliases para compatibilizar com UI que usa "backup:oauth:*"
  ipcMain.handle("backup:oauth:start", async (_evt, servico) => {
    console.log(`${LOG} Alias 'backup:oauth:start' → 'backup:iniciar-oauth'`);
    return ipcMain.invoke("backup:iniciar-oauth", servico);
  });
  // Não há polling separado neste handler porque a lib cuida do device flow internamente.
  ipcMain.handle("backup:oauth:poll", async () => {
    console.log(`${LOG} Chamado 'backup:oauth:poll' (não suportado neste handler).`);
    return { ok: false, erro: "Polling não necessário: o fluxo é conduzido internamente pela lib OAuth." };
  });

  // Testar conexão
  ipcMain.handle("backup:testar-conexao", async () => {
    try {
      const cfgAll = await carregarUsuarioJsonSeguro();
      const bkp = cfgAll.backup || {};
      if (bkp.servico !== "google-drive" || !bkp.oauthTokenEnc) {
        throw new Error("Backup do Google Drive não configurado.");
      }

      const token = JSON.parse(descriptografarCampo(bkp.oauthTokenEnc));
      const drive = new GoogleDriveClient(token);
      const about = await drive.getAbout();

      const nome = about?.user?.displayName || "Conta Google";
      console.log(`${LOG} Teste de conexão OK. Usuário: ${nome}`);
      return { ok: true, user: nome };
    } catch (e) {
      console.error(`${LOG} Falha ao testar conexão:`, e?.message || e);
      return { ok: false, erro: e?.message || "Falha ao testar conexão" };
    }
  });

  // Executar agora
  ipcMain.handle("backup:executar-agora", async () => {
    try {
      return await executarBackupAgoraInner();
    } catch (e) {
      console.error(`${LOG} Falha no backup imediato:`, e?.message || e);
      return { ok: false, erro: e?.message || "Falha no backup imediato" };
    }
  });
}

module.exports = { registrarBackupHandler };
