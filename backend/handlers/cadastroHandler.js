
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { criptografarComMestra } = require("../lib/criptografia");
const { app } = require("electron");

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
      console.log("📝 Iniciando salvamento de cadastro...");

      if (!dados || !dados.email || !dados.senha || !dados.aluno) {
        console.warn("⚠️ Dados incompletos recebidos:", dados);
        return {
          sucesso: false,
          erro: "Preencha todos os campos obrigatórios: e-mail, senha e aluno.",
        };
      }

      const emailNormalizado = String(dados.email).trim().toLowerCase();
      const senhaOriginal = String(dados.senha);

      // Remove dados sensíveis da versão a ser criptografada como conteúdo
      const dadosSeguros = { ...dados };
      delete dadosSeguros.email;
      delete dadosSeguros.senha;

      // Criptografa individualmente
      const emailCriptografado = criptografarComMestra(emailNormalizado);
      const senhaCriptografada = criptografarComMestra(senhaOriginal);
      const conteudoCriptografado = criptografarComMestra(JSON.stringify(dadosSeguros));

      const novoUsuario = {
        emailVisivel: emailNormalizado, // usado para verificação
        emailCriptografado,
        senhaCriptografada,
        conteudoCriptografado,
      };

      let lista = { usuarios: [] };

      if (fs.existsSync(USUARIO_PATH)) {
        try {
          lista = JSON.parse(fs.readFileSync(USUARIO_PATH, "utf8"));
          console.log("📁 Lista de usuários carregada com", lista.usuarios.length, "usuário(s).");
        } catch (erroLeitura) {
          console.error("⚠️ Erro ao ler usuario.json:", erroLeitura);
          return { sucesso: false, erro: "Erro ao ler os dados existentes." };
        }
      }

      // Verifica se já existe pelo campo em texto plano
      const jaExiste = lista.usuarios.some((u) => {
        if (!u.emailVisivel) {
          console.warn("⚠️ Usuário no JSON não possui emailVisivel:", u);
          return false;
        }

        const comparado = u.emailVisivel.trim().toLowerCase();
        const atual = emailNormalizado;
        console.log("🔍 Comparando:", comparado, "<->", atual);
        return comparado === atual;
      });

      if (jaExiste) {
        console.warn("❌ Tentativa de cadastro com e-mail já existente:", emailNormalizado);
        return { sucesso: false, erro: "E-mail já cadastrado." };
      }

      // Cria diretório se não existir
      fs.mkdirSync(path.dirname(USUARIO_PATH), { recursive: true });

      // Salva novo usuário
      lista.usuarios.push(novoUsuario);
      fs.writeFileSync(USUARIO_PATH, JSON.stringify(lista, null, 2), "utf8");

      console.log("✅ Usuário salvo com sucesso:", emailNormalizado);
      return { sucesso: true };

    } catch (erro) {
      console.error("❌ Erro inesperado ao salvar cadastro:", erro);
      return { sucesso: false, erro: "Erro ao salvar cadastro." };
    }
  });
}

module.exports = registrarCadastroHandler;
