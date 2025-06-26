// handlers/lerArquivoHandler.js
const fs = require("fs").promises;
const { ipcMain } = require("electron");
const { descriptografarComMestra } = require("../lib/criptografia");


function registrarLerArquivoHandler() {
  ipcMain.handle("ler-arquivo", async (_, caminho) => {
    try {
      console.log("📥 Recebido pedido para ler arquivo:", caminho);

      const conteudo = await fs.readFile(caminho, "utf-8");
      console.log("📄 Conteúdo lido:", conteudo);
      
      const [ivBase64, dataBase64] = conteudo.split(":");
      
      if (!ivBase64 || !dataBase64) {
        throw new Error("Conteúdo criptografado malformado.");
      }

      const chave = process.env.CRYPTO_SECRET;
      if (!chave) throw new Error("CRYPTO_SECRET não definido.");

      const texto = descriptografarComMestra(conteudo, chave);
      console.log("🔓 Texto descriptografado:", texto);

      return {
        sucesso: true,
        conteudo: texto,
      };

    } catch (erro) {
      console.error("❌ Erro ao descriptografar:", erro);
      return {
        sucesso: false,
        erro: "Erro ao descriptografar arquivo. Verifique se ele foi salvo corretamente.",
      };
    }
    
  });
}

module.exports = {
  registrarLerArquivoHandler,
};
