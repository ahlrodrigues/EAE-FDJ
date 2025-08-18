// backend/handlers/backupHandler.js
const { ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");

const { startSchedule, stopSchedule } = require("./backupSchedule");
const { carregarUsuarioJsonSeguro, salvarUsuarioJsonSeguro } = require("../lib/usuarioStore");
const { GoogleDriveClient } = require("../lib/googleDriveClient");

function getLocalBackupDir(emailHash, pastaNome) {
  const home = process.env.HOME || process.env.USERPROFILE || os.homedir();
  return path.join(home, ".config", "escola-aprendizes", "backups", emailHash, pastaNome);
}

function getRemoteBackupPath(pastaNome) {
  // padrão fixo
  return path.posix.join("EscolaAprendizes", "Backups", pastaNome);
}

async function ensureLocalDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function ensureRemotePath(drive, remotePath) {
  // Recomendado: implementar ensureFolderPath no GoogleDriveClient
  // que cria a árvore "EscolaAprendizes/Backups/<pastaNome>" se não existir.
  await drive.ensureFolderPath(remotePath);
}

function registrarBackupHandler() {
  // Carregar configuração
  ipcMain.handle("backup:carregar-config", async () => {
    const cfgAll = await carregarUsuarioJsonSeguro();
    return cfgAll.backup || {};
  });

  // Salvar configuração
  ipcMain.handle("backup:salvar-config", async (_evt, cfg) => {
    const cfgAll = await carregarUsuarioJsonSeguro();
    const emailHash = Object.keys(cfgAll.usuarios || {})[0] || "default";

    // validação básica
    if (!cfg || typeof cfg !== "object") throw new Error("Config inválida.");
    const servico = cfg.servico || "google-drive";
    const pastaNome = String(cfg.pastaNome || "").trim();
    const modo = cfg.modo || "manual";
    const horario = cfg.horario || "22:30";

    if (servico !== "google-drive") throw new Error("Serviço ainda não suportado.");
    if (!pastaNome) throw new Error("Informe o nome da pasta.");

    // resolve caminhos padronizados
    const localDir = getLocalBackupDir(emailHash, pastaNome);
    const remotePath = getRemoteBackupPath(pastaNome);

    // cria pasta local
    await ensureLocalDir(localDir);

    // se já houver token OAuth salvo, garante pasta remota
    // (se ainda não houver, será garantida no primeiro backup)
    const bkpPrev = cfgAll.backup || {};
    const oauthTokenEnc = cfg.oauthTokenEnc || bkpPrev.oauthTokenEnc;

    if (oauthTokenEnc) {
      try {
        const token = JSON.parse(require("../lib/usuarioStore").descriptografarCampo(oauthTokenEnc));
        const drive = new GoogleDriveClient(token);
        await ensureRemotePath(drive, remotePath);
      } catch (e) {
        console.warn("⚠️ [backup] Não foi possível garantir pasta remota agora:", e?.message || e);
      }
    }

    // persiste
    cfgAll.backup = {
      servico,
      pastaNome,
      modo,
      horario,
      oauthTokenEnc: oauthTokenEnc || null,
      ultimoBackupISO: cfgAll.backup?.ultimoBackupISO || null,
    };

    await salvarUsuarioJsonSeguro(cfgAll);

    // reagenda se necessário
    if (modo === "agendado" && startSchedule && stopSchedule) {
      try {
        stopSchedule();
        startSchedule(horario, async () => {
          await executarBackupAgoraInner();
        });
      } catch (e) {
        console.warn("⚠️ [backup] Falha ao configurar agendamento:", e?.message || e);
      }
    } else if (stopSchedule) {
      stopSchedule();
    }

    return { ok: true, localDir, remotePath };
  });

  // Iniciar OAuth
  ipcMain.handle("backup:iniciar-oauth", async (_evt, servico) => {
    if (servico !== "google-drive") throw new Error("Serviço ainda não suportado.");
    const { startDeviceFlow } = require("../lib/googleOAuth");
    const token = await startDeviceFlow(); // retorna token JSON (obj)
    if (!token) throw new Error("Não foi possível obter token OAuth.");

    // salva token criptografado em backup.oauthTokenEnc
    const cfgAll = await carregarUsuarioJsonSeguro();
    const { criptografarCampo } = require("../lib/usuarioStore");
    const enc = criptografarCampo(JSON.stringify(token));
    cfgAll.backup = { ...(cfgAll.backup || {}), oauthTokenEnc: enc };
    await salvarUsuarioJsonSeguro(cfgAll);

    return { ok: true };
  });

  // Testar conexão
  ipcMain.handle("backup:testar-conexao", async () => {
    const cfgAll = await carregarUsuarioJsonSeguro();
    const bkp = cfgAll.backup || {};
    if (bkp.servico !== "google-drive" || !bkp.oauthTokenEnc) {
      throw new Error("Backup do Google Drive não configurado.");
    }
    const token = JSON.parse(require("../lib/usuarioStore").descriptografarCampo(bkp.oauthTokenEnc));
    const drive = new GoogleDriveClient(token);
    const about = await drive.getAbout();
    return { ok: true, user: about?.user?.displayName || "Conta Google" };
  });

  // Executar agora
  ipcMain.handle("backup:executar-agora", async () => {
    return await executarBackupAgoraInner();
  });
}

async function executarBackupAgoraInner() {
  const { carregarUsuarioJsonSeguro, descriptografarCampo } = require("../lib/usuarioStore");
  const cfgAll = await carregarUsuarioJsonSeguro();
  const emailHash = Object.keys(cfgAll.usuarios || {})[0] || "default";
  const bkp = cfgAll.backup || {};
  if (bkp.servico !== "google-drive" || !bkp.oauthTokenEnc || !bkp.pastaNome) {
    throw new Error("Backup do Google Drive não configurado.");
  }

  const token = JSON.parse(descriptografarCampo(bkp.oauthTokenEnc));
  const drive = new GoogleDriveClient(token);

  const pastaNome = bkp.pastaNome;
  const localDir = getLocalBackupDir(emailHash, pastaNome);
  const remotePath = getRemoteBackupPath(pastaNome);

  // garante pasta remota
  await ensureRemotePath(drive, remotePath);

  // varredura simples + incremental
  let enviados = 0;
  if (fs.existsSync(localDir)) {
    const entries = fs.readdirSync(localDir);
    for (const entry of entries) {
      const p = path.join(localDir, entry);
      if (fs.statSync(p).isFile()) {
        const ok = await drive.enviarIncremental(remotePath, p);
        if (ok) enviados++;
      }
    }
  }

  cfgAll.backup.ultimoBackupISO = new Date().toISOString();
  await salvarUsuarioJsonSeguro(cfgAll);

  return { ok: true, enviados, localDir, remotePath, quando: cfgAll.backup.ultimoBackupISO };
}

module.exports = { registrarBackupHandler };
