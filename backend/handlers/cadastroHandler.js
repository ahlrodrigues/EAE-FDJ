// === handlers/cadastroHandler.js ===
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { criptografarComMestra } = require("../lib/criptografia");

const USUARIO_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE,
  ".config",
  "escola-aprendizes",
  "config",
  "usuario.json"
);

function registrarCadastroHandler(ipcMain) {
  ipcMain.handle("salvar-cadastro", async (_, dados) => {
    try {
      const senhaHash = await bcrypt.hash(dados.senha, 10);
      delete dados.senha;

      const conteudoCriptografado = criptografarComMestra(JSON.stringify(dados));

      const novoUsuario = {
        email: dados.email,
        senha: senhaHash,
        conteudoCriptografado,
      };

      let lista = { usuarios: [] };
      if (fs.existsSync(USUARIO_PATH)) {
        console.log("📁 Criando novo arquivo de usuarios...");
        try {
          lista = JSON.parse(fs.readFileSync(USUARIO_PATH, "utf8"));
        } catch (erroLeitura) {
          console.error("⚠️ Erro ao ler usuario.json:", erroLeitura);
        }
      }

      const jaExiste = lista.usuarios.some((u) => u.email.toLowerCase() === novoUsuario.email.toLowerCase());
      if (jaExiste) {
        return { sucesso: false, erro: "E-mail já cadastrado." };
      }

      if (!dados.email || !dados.aluno) {
        return { sucesso: false, erro: "Campos obrigatórios ausentes." };
      }
      
      lista.usuarios.push(novoUsuario);

      fs.mkdirSync(path.dirname(USUARIO_PATH), { recursive: true });
      fs.writeFileSync(USUARIO_PATH, JSON.stringify(lista, null, 2), "utf8");

      console.log("✅ Usuário salvo com sucesso:", novoUsuario.email);
      return { sucesso: true };
    } catch (erro) {
      console.error("❌ Erro ao salvar cadastro:", erro);
      return { sucesso: false, erro: "Falha ao salvar cadastro." };
    }
  });
}

module.exports = registrarCadastroHandler;
