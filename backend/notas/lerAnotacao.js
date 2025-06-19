// backend/handlers/notas/lerAnotacao.js
const fs = require("fs");
const path = require("path");
const os = require("os");
const { descriptografarComMestra } = require("../lib/criptografia");

async function handleLerAnotacao(_, nomeArquivo) {
  try {
    const usuarioPath = path.join(os.homedir(), ".config", "escola-aprendizes", "config", "usuario.json");
    const dadosStr = await fs.promises.readFile(usuarioPath, "utf-8");
    const dados = JSON.parse(dadosStr);
    const usuario = dados.usuarios?.[0];

    if (!usuario?.emailHash) throw new Error("emailHash ausente");

    const caminho = path.join(os.homedir(), ".config", "escola-aprendizes", "notas", usuario.emailHash, nomeArquivo);
    const conteudoCriptografado = await fs.promises.readFile(caminho, "utf-8");
    const conteudo = descriptografarComMestra(conteudoCriptografado, process.env.CRYPTO_SECRET);

    console.log("📖 Anotação lida com sucesso:", nomeArquivo);
    return { sucesso: true, conteudo };
  } catch (erro) {
    console.error("❌ Erro ao ler anotação:", erro.message);
    return { sucesso: false, erro: "Erro ao ler anotação." };
  }
}

module.exports = { handleLerAnotacao };