const { ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
const dotenv = require("dotenv");
dotenv.config();

const { descriptografarComMestra } = require("../lib/criptografia");
const CRYPTO_SECRET = process.env.CRYPTO_SECRET;

const USUARIO_PATH = path.join(
  os.homedir(),
  ".config",
  "escola-aprendizes",
  "config",
  "usuario.json"
);

function registrarUsuarioHandler() {
  // 📖 Lê o conteúdo do usuario.json
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

  // 🔐 Retorna o nome descriptografado do aluno
  ipcMain.handle("obter-nome-aluno", async () => {
    try {
      const raw = fs.readFileSync(USUARIO_PATH, "utf-8");
      const dados = JSON.parse(raw);
      const chaves = Object.keys(dados.usuarios || {});
      const usuario = dados.usuarios?.[chaves[0]];

      if (usuario?.aluno) {
        const nome = descriptografarComMestra(usuario.aluno, CRYPTO_SECRET);
        return nome;
      } else {
        return null;
      }
    } catch (erro) {
      console.error("❌ Erro ao obter nome do aluno:", erro.message);
      return null;
    }
  });
}

module.exports = { registrarUsuarioHandler };
