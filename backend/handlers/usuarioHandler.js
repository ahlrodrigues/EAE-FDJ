// backend/usuarioHandler.js
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
      const conteudo = fs.readFileSync(USUARIO_PATH, "utf-8");
      return JSON.parse(conteudo);
    } catch (erro) {
      console.error("❌ Erro ao ler usuario.json:", erro);
      throw erro;
    }
  });
}

module.exports = { registrarUsuarioHandler };
