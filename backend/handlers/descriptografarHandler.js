const { ipcMain } = require("electron");
const { descriptografarComMestra } = require("../lib/criptografia");

function registrarDescriptografarHandler() {
  ipcMain.handle("descriptografar-com-mestra", async (_, texto) => {
    try {
      const chave = process.env.CRYPTO_SECRET;
      if (!chave) throw new Error("Chave mestra não definida no .env");

      const resultado = descriptografarComMestra(texto, chave);
      console.log("🔓 [MAIN] codigoTemas descriptografado com sucesso.");
      return resultado;
    } catch (erro) {
      console.error("❌ [MAIN] Erro ao descriptografar codigoTemas:", erro.message);
      throw erro;
    }
  });
}

module.exports = { registrarDescriptografarHandler };
