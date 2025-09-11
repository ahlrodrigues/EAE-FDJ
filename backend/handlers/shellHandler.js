// backend/handlers/backupHandler.js
const { ipcMain } = require("electron");
const { startDeviceCode, pollDeviceTokens } = require("../lib/googleAuth");

function registrarBackupOAuthHandlers(){
  ipcMain.handle("backup:iniciar-oauth", async (_e, servico) => {
    if (servico !== "google-drive") return { ok:false, error:"Serviço não suportado" };

    // 1) Pega o code e DEVOLVE na resposta (UI mostra imediatamente)
    const dc = await startDeviceCode(); // { url, code, device_code, ... }
    // 2) Inicia polling em background (não bloqueia UI)
    pollDeviceTokens(dc.device_code).catch(err => {
      console.error("🔐 [OAuth] Polling falhou:", err?.response?.data || err?.message || err);
    });

    // Resposta para o renderer preencher o card agora
    return { ok:true, url: dc.url, code: dc.code, expiresIn: dc.expiresIn, issuedAt: dc.issuedAt };
  });
}

module.exports = { registrarBackupOAuthHandlers };
