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
      if (!dados || !dados.email || !dados.senha || !dados.aluno) {
        return { sucesso: false, erro: "Campos obrigatórios ausentes." };
      }
  
      
      // Extração segura antes de modificar dados
      const emailNormalizado = String(dados.email).trim().toLowerCase();
      const senhaOriginal = String(dados.senha);

      // Cria cópia dos dados e remove email/senha
      const dadosSeguros = { ...dados };
      delete dadosSeguros.email;
      delete dadosSeguros.senha;

      // Criptografa individualmente
      const emailCriptografado = criptografarComMestra(emailNormalizado);
      const senhaCriptografada = criptografarComMestra(senhaOriginal);
      const conteudoCriptografado = criptografarComMestra(JSON.stringify(dadosSeguros));

      // Define o objeto final
      const novoUsuario = {
        emailCriptografado,
        senhaCriptografada,
        conteudoCriptografado
      };

  
      let lista = { usuarios: [] };
      if (fs.existsSync(USUARIO_PATH)) {
        try {
          lista = JSON.parse(fs.readFileSync(USUARIO_PATH, "utf8"));
        } catch (erroLeitura) {
          console.error("⚠️ Erro ao ler usuario.json:", erroLeitura);
        }
      }
  
      const jaExiste = lista.usuarios.some(
        (u) => u.emailCriptografado === emailCriptografado
      );
      if (jaExiste) {
        return { sucesso: false, erro: "E-mail já cadastrado." };
      }
  
      lista.usuarios.push(novoUsuario);
  
      fs.mkdirSync(path.dirname(USUARIO_PATH), { recursive: true });
      fs.writeFileSync(USUARIO_PATH, JSON.stringify(lista, null, 2), "utf8");
  
      console.log("✅ Usuário salvo com sucesso:", dados.email);
      return { sucesso: true };
     
    } catch (erro) {
      console.error("❌ Erro ao salvar cadastro:", erro);
      return { sucesso: false, erro: "Erro ao salvar cadastro." };
    }
  });
  
}

module.exports = registrarCadastroHandler;
