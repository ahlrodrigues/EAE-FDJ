// backend/handlers/notas/excluirAnotacao.js
const fs = require("fs");
const path = require("path");
const os = require("os");

async function handleExcluirAnotacao(_, nomeArquivo) {
  try {
    const usuarioPath = path.join(os.homedir(), ".config", "escola-aprendizes", "config", "usuario.json");
    const dadosStr = await fs.promises.readFile(usuarioPath, "utf-8");
    const dados = JSON.parse(dadosStr);
    const usuario = dados.usuarios?.[0];

    if (!usuario?.emailHash) throw new Error("emailHash ausente");

    const caminho = path.join(os.homedir(), ".config", "escola-aprendizes", "notas", usuario.emailHash, nomeArquivo);
    await fs.promises.unlink(caminho);

    console.log("🗑️ Anotação excluída:", caminho);
    return { sucesso: true };
  } catch (erro) {
    console.error("❌ Erro ao excluir anotação:", erro.message);
    return { sucesso: false, erro: "Erro ao excluir anotação." };
  }
}

module.exports = { handleExcluirAnotacao };
