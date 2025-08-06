const { ipcMain } = require("electron");

function registrarTermoAceitoHandler(getJanelaCadastro) {
  ipcMain.on("termo-aceito", () => {
    console.log("📬 [MAIN] Evento 'termo-aceito' recebido do preload-termo");

    const janela = getJanelaCadastro();
    if (janela && !janela.isDestroyed()) {
      janela.webContents.send("termo-aceito");
      console.log("📤 [MAIN] Evento 'termo-aceito' enviado à janela de cadastro.");
    } else {
      console.warn("⚠️ [MAIN] Janela de cadastro indisponível para reenviar evento.");
    }
  });
}

module.exports = { registrarTermoAceitoHandler };

