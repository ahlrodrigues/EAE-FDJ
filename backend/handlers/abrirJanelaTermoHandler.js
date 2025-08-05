const path = require("path");
const { BrowserWindow, ipcMain } = require("electron");

function registrarAbrirJanelaTermoHandler() {
  ipcMain.handle("abrir-janela-termo", async () => {
    return new Promise((resolve) => {
      const caminhoPreload = path.join(__dirname, "../../preload-termo.js");
      console.log("📄 Abrindo janela do termo com preload:", caminhoPreload);

      const termoWin = new BrowserWindow({
        width: 800,
        height: 600,
        modal: true,
        parent: BrowserWindow.getFocusedWindow(),
        show: false,
        webPreferences: {
          preload: caminhoPreload,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false
        }
      });

      let aceiteRegistrado = false;

      termoWin.once("ready-to-show", () => termoWin.show());
      termoWin.loadFile(path.join(__dirname, "../../frontend/termo.html"));

      ipcMain.once("termo-aceito", () => {
        aceiteRegistrado = true;
        console.log("✅ Termo aceito pelo usuário.");
        resolve(true);
        termoWin.close();
      });

      termoWin.on("closed", () => {
        if (!aceiteRegistrado) {
          console.warn("⚠️ Termo fechado sem aceite.");
          resolve(undefined); // não resolve false → não mostra aviso à toa
        }
      });
    });
  });
}

module.exports = { registrarAbrirJanelaTermoHandler };
