// backend/handlers/notas/listarAnotacoes.js
const fs = require("fs");
const path = require("path");
const os = require("os");

async function handleListarAnotacoes(_, emailHash) {
  try {
    const pastaNotas = path.join(
      os.homedir(),
      ".config",
      "escola-aprendizes",
      "notas",
      emailHash
    );

    if (!fs.existsSync(pastaNotas)) {
      console.warn("⚠️ Pasta de anotações não encontrada:", pastaNotas);
      return [];
    }

    const arquivos = await fs.promises.readdir(pastaNotas);
    console.log("📁 Lista de anotações carregada:", arquivos);
    return arquivos.filter(nome => nome.endsWith(".txt"));
  } catch (erro) {
    console.error("❌ Erro ao listar anotações:", erro.message);
    return [];
  }
}

module.exports = { handleListarAnotacoes };