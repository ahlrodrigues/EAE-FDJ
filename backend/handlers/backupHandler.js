// === backend/handlers/backupHandler.js ===
const { ipcMain } = require("electron");
const { startSchedule, stopSchedule, reschedule, getStatus } = require("./backupSchedule");
const { carregarUsuarioJsonSeguro, salvarUsuarioJsonSeguro } = require("../lib/usuarioStore");
const { execute: executarBackup } = require("../lib/backupRun");

function _validateConfig(cfg) {
  if (!cfg || typeof cfg !== "object") throw new Error("Config ausente.");
  if (!cfg.servico) throw new Error("Serviço não informado.");
  if (!cfg.pastaRemota) throw new Error("Pasta remota não informada.");
  if (!["manual", "agendado", "continuo"].includes(cfg.modo || "manual")) {
    throw new Error("Modo inválido.");
  }
  if (cfg.modo === "agendado") {
    const ok = /^([01]\d|2[0-3]):([0-5]\d)$/.test(cfg.horario || "");
    if (!ok) throw new Error("Horário inválido (use HH:mm).");
  }
}

function registrarBackupHandler() {
  ipcMain.handle("backup:carregar-config", async () => {
    const all = await carregarUsuarioJsonSeguro();
    return all?.backup || {};
  });

  ipcMain.handle("backup:salvar-config", async (_evt, cfg) => {
    _validateConfig(cfg);

    const all = await carregarUsuarioJsonSeguro();
    all.backup = {
      ...(all.backup || {}),
      servico: cfg.servico,
      pastaRemota: cfg.pastaRemota,
      modo: cfg.modo || "manual",
      horario: cfg.horario || all.backup?.horario || "22:30",
      oauthTokenEnc: all.backup?.oauthTokenEnc,
      ultimoBackupISO: all.backup?.ultimoBackupISO,
    };
    await salvarUsuarioJsonSeguro(all);

    if (cfg.modo === "agendado") {
      reschedule(all.backup.horario, executarBackup, { timezone: process.env.BACKUP_TZ });
      console.log("🔁 [backupHandler] Agendamento atualizado para", all.backup.horario);
    } else {
      stopSchedule();
      console.log("⏹️ [backupHandler] Agendamento cancelado (modo:", cfg.modo, ").");
    }
    return { ok: true, backup: all.backup, schedule: getStatus() };
  });

  ipcMain.handle("backup:iniciar-oauth", async (_evt, servico) => {
    if (servico !== "google-drive") throw new Error("Serviço não suportado no momento.");
    console.warn("ℹ️ [backupHandler] iniciar-oauth: implementar fluxo OAuth.");
    return { ok: false, mensagem: "OAuth em implementação." };
  });

  ipcMain.handle("backup:testar-conexao", async () => {
    const all = await carregarUsuarioJsonSeguro();
    const ok = !!all?.backup?.oauthTokenEnc && !!all?.backup?.pastaRemota;
    return { ok, detalhes: ok ? "Token e pasta configurados." : "Token/pasta ausentes." };
  });

  ipcMain.handle("backup:executar-agora", async () => {
    const res = await executarBackup();
    return { ok: true, ...res };
  });

  console.log("✅ [backupHandler] Handlers de backup registrados.");
}

module.exports = { registrarBackupHandler };
