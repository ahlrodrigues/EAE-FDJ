// ✅ /backend/handlers/termoHandler.js

const path = require("path");
const fs = require("fs/promises");

function registrarTermoHandler(ipcMain) {
  ipcMain.handle("ler-termo-md", async (event, idioma) => {
    const idiomaFormatado = idioma.replace("_", "-");
    const filePath = path.join(__dirname, "../../frontend/locales", `termo_${idiomaFormatado}.md`);
    console.log("📄 Buscando termo em:", filePath);

    try {
      const conteudo = await fs.readFile(filePath, "utf8");
      return conteudo;
    } catch (erro) {
      console.error("❌ Erro ao ler termo markdown:", erro.message);
      throw new Error("Termo não encontrado para o idioma: " + idiomaFormatado);
    }
  });
}

module.exports = { registrarTermoHandler };
