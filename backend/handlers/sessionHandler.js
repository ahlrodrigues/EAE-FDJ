// backend/handlers/sessionHandler.js
const { ipcMain } = require("electron");
const { isLoginAtivo, setLoginAtivo } = require("../lib/sessionStore");

function registrarSessionHandler() {
  console.log("🧩 Registrando sessionHandler...");

  ipcMain.handle("session:isLoginAtivo", () => {
    const status = isLoginAtivo();
    console.log("🔐 Consulta de sessão ativa:", status);
    return status;
  });

  ipcMain.handle("session:logout", () => {
    console.log("🔓 Logout requisitado. Finalizando sessão...");
    setLoginAtivo(false);
    return true;
  });
}

module.exports = { registrarSessionHandler };
