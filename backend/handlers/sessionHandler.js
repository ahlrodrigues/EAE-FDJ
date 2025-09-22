// =============================================================================
// Caminho: backend/handlers/sessionHandler.js
// Objetivo: registrar IPC de sessão (processo MAIN), sem tocar no preload.
// =============================================================================
const { ipcMain } = require("electron");
const {
  isLoginAtivo,
  definirSessaoAtiva,
  limparSessao,
  obterEmailHashAtivo,
} = require("../lib/sessionStore");

const LOG = "[SESSION]";

function registrarSessionHandler() {
  console.log(`${LOG} registrando IPC…`);

  ipcMain.on("sessao-definir", (_event, emailHash) => {
    console.log(`${LOG} definir sessão →`, emailHash?.slice(0,8) + "…");
    definirSessaoAtiva(emailHash);
  });

  ipcMain.handle("session:isLoginAtivo", () => {
    const status = isLoginAtivo();
    console.log(`${LOG} status login ativo:`, status);
    return status;
  });

  ipcMain.handle("session:logout", () => {
    console.log(`${LOG} logout → limpar sessão`);
    limparSessao();
    return true;
  });

  ipcMain.handle("session:emailHash", () => {
    return obterEmailHashAtivo();
  });
}

module.exports = { registrarSessionHandler };
