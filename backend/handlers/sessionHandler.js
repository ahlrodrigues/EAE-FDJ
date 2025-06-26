const { ipcMain } = require("electron");
const {
  isLoginAtivo,
  definirSessaoAtiva,
  limparSessao,
  obterEmailHashAtivo,
} = require("../lib/sessionStore");

function registrarSessionHandler() {
  console.log("🧩 Registrando sessionHandler...");

  ipcMain.on("sessao-definir", (event, emailHash) => {
    console.log("🧩 Sessão ativa definida para:", emailHash);
    definirSessaoAtiva(emailHash);
  });

  ipcMain.handle("session:isLoginAtivo", () => {
    const status = isLoginAtivo();
    console.log("🔐 Consulta de sessão ativa:", status);
    return status;
  });

  ipcMain.handle("session:logout", () => {
    console.log("🔓 Logout requisitado. Finalizando sessão...");
    limparSessao();
    return true;
  });

  ipcMain.handle("session:emailHash", () => {
    return obterEmailHashAtivo();
  });
}

module.exports = { registrarSessionHandler };
