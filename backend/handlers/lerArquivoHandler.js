// handlers/lerArquivoHandler.js
const fs = require("fs").promises;
const { ipcMain } = require("electron");

function registrarLerArquivoHandler() {
  ipcMain.handle("ler-arquivo", async (_event, caminho) => {
    try {
      const conteudo = await fs.readFile(caminho, "utf8");
      console.log("📖 [MAIN] Arquivo lido com sucesso:", caminho);
      return conteudo;
    } catch (erro) {
      console.error("❌ [MAIN] Erro ao ler arquivo:", erro);
      throw erro;
    }
  });
}

module.exports = {
  registrarLerArquivoHandler,
};
