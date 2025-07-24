const { ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");

const USUARIO_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE,
  ".config",
  "escola-aprendizes",
  "config",
  "usuario.json"
);

function registrarUsuarioHandler() {
  ipcMain.handle("ler-usuario", async () => {
    try {
      const conteudo = await fs.promises.readFile(USUARIO_PATH, "utf-8");
      const json = JSON.parse(conteudo);
      console.log("🧾 Usuário lido com sucesso:", json);
      return json;
    } catch (erro) {
      console.error("❌ Erro ao ler usuario.json:", erro.message);
      return null;
    }
  });
}

ipcMain.handle("salvar-aceite", async () => {
  try {
    const usuarioPath = path.join(configPath, "usuario.json");

    let dados = {};
    try {
      const conteudo = await fs.readFile(usuarioPath, "utf8");
      dados = JSON.parse(conteudo);
    } catch (erroLeitura) {
      console.warn("📂 usuário.json não encontrado. Criando novo...");
    }

    dados.aceiteTermos = true;

    await fs.writeFile(usuarioPath, JSON.stringify(dados, null, 2), "utf8");
    console.log("✅ Aceite salvo com sucesso em usuario.json");
    return true;

  } catch (erro) {
    console.error("❌ Erro ao salvar aceite dos termos:", erro);
    throw new Error("Falha ao salvar o aceite dos termos.");
  }
});


module.exports = { registrarUsuarioHandler };

