// backend/handlers/criptografarHandler.js
const { ipcMain } = require("electron");
const { criptografarComMestra } = require("../lib/criptografia");

function registrarCriptografarHandler() {
  ipcMain.handle("criptografar-com-mestra", async (_event, texto) => {
    try {
      const chave = process.env.CRYPTO_SECRET;
      if (!chave) throw new Error("Chave mestra não definida no .env");

      return criptografarComMestra(String(texto || ""), chave);
    } catch (erro) {
      console.error("❌ [MAIN] Erro ao criptografar:", erro.message);
      throw erro;
    }
  });
}

module.exports = { registrarCriptografarHandler };
