// === backend/handlers/temasHandler.js ===

const path = require("path");
const fs = require("fs/promises");
const { app } = require("electron");
const { criptografarComMestra } = require("../lib/criptografia");

function registrarTemasHandler(ipc) {
  // 📄 Lista arquivos salvos
  ipc.handle("listar-temas-salvos", async (event, emailHash) => {
    try {
      const temasDir = path.join(
        app.getPath("appData"),
        "escola-aprendizes",
        "temas",
        emailHash
      );

      const arquivos = await fs.readdir(temasDir);
      return arquivos.filter(nome => nome.endsWith(".txt"));
    } catch (erro) {
      console.warn("📁 Nenhum tema salvo encontrado ou erro ao ler diretório:", erro.message);
      return [];
    }
  });

  // 💾 Salvar tema criptografado
  ipc.handle("salvar-tema", async (event, emailHash, nomeArquivo, dados) => {
    try {
      const pasta = path.join(
        app.getPath("appData"),
        "escola-aprendizes",
        "temas",
        emailHash
      );
      await fs.mkdir(pasta, { recursive: true });

      const chaveMestra = process.env.CRYPTO_SECRET;
      const conteudoCriptografado = criptografarComMestra(JSON.stringify(dados), chaveMestra);
      console.log("🔐 Tema criptografado:", conteudoCriptografado);

      
      const caminho = path.join(pasta, nomeArquivo);

      await fs.writeFile(caminho, conteudoCriptografado, "utf-8");
      return { sucesso: true };
    } catch (erro) {
      console.error("Erro ao salvar tema:", erro);
      throw erro;
    }
  });
}

module.exports = { registrarTemasHandler };
