const fs = require("fs").promises;
const { ipcMain } = require("electron");
const { descriptografarComMestra } = require("../lib/criptografia");

// 📄 Retorna conteúdo bruto (JSON, texto, etc)
function registrarLerArquivoHandler() {
  ipcMain.handle("ler-arquivo", async (_, caminho) => {
    try {
      console.log("📥 [ler-arquivo] Lendo arquivo:", caminho);
      const conteudo = await fs.readFile(caminho, "utf-8");
      return conteudo; // ✅ retorna como string — sem parse e sem descriptografar
    } catch (erro) {
      console.error("❌ [ler-arquivo] Erro:", erro);
      throw erro;
    }
  });

  // 🔐 Apenas para arquivos criptografados de anotações .txt
  ipcMain.handle("ler-anotacao-descriptografada", async (_, caminho) => {
    try {
      console.log("📥 [ler-anotacao-descriptografada] Arquivo:", caminho);
      const conteudo = await fs.readFile(caminho, "utf-8");

      const chave = process.env.CRYPTO_SECRET;
      if (!chave) throw new Error("CRYPTO_SECRET não definido.");

      const texto = descriptografarComMestra(conteudo, chave);
      console.log("🔓 Conteúdo descriptografado com sucesso.");
      return texto;
    } catch (erro) {
      console.error("❌ [ler-anotacao-descriptografada] Erro:", erro);
      return null;
    }
  });

  // 📚 Carrega múltiplas anotações brutas (sem descriptografar)
  ipcMain.handle("ler-anotacoes-selecionadas", async (event, caminhos) => {
    try {
      const resultados = await Promise.all(
        caminhos.map(async (caminho) => {
          const conteudo = await fs.readFile(caminho, "utf-8");
          return conteudo;
        })
      );
      return resultados;
    } catch (erro) {
      console.error("❌ Erro ao ler anotações selecionadas:", erro);
      throw erro;
    }
  });
}

module.exports = {
  registrarLerArquivoHandler,
};
