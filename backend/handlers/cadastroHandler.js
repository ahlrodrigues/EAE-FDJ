const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { criptografarComMestra, gerarHashEmailComMestra } = require("../lib/criptografia");

// 📍 Caminho absoluto do arquivo onde os dados dos usuários são armazenados
const USUARIO_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE,
  ".config",
  "escola-aprendizes",
  "config",
  "usuario.json"
);

/**
 * Handler para salvar ou atualizar o cadastro de usuário
 */
function registrarCadastroHandler(ipcMain) {
  ipcMain.handle("salvar-cadastro", async (_, dados) => {
    console.log("📝 Iniciando salvamento de cadastro...");

    try {
      // 🚫 Verificação de campos obrigatórios
      if (!dados?.email || !dados?.senha || !dados?.aluno) {
        console.warn("⚠️ Campos obrigatórios ausentes:", dados);
        return {
          sucesso: false,
          erro: "Preencha todos os campos obrigatórios.",
        };
      }

      // 🔐 Hash do e-mail para identificação anônima e hash da senha com bcrypt
      const emailHash = gerarHashEmailComMestra(dados.email.trim().toLowerCase());
      const senhaHash = await bcrypt.hash(dados.senha, 10);

      // 🔒 Criptografia individual dos campos sensíveis
      const usuarioCriptografado = {
        emailHash,
        senha: senhaHash,
        idioma: dados.idioma || "pt_BR", // idioma fica aberto
        emailCriptografado: criptografarComMestra(dados.email),
        aluno: criptografarComMestra(dados.aluno),
        codigoTemas: criptografarComMestra(dados.codigoTemas || ""),
        casaEspírita: criptografarComMestra(dados.casaEspírita || ""),
        numeroTurma: criptografarComMestra(dados.numeroTurma || ""),
        dirigente: criptografarComMestra(dados.dirigente || ""),
        emailDirigente: criptografarComMestra(dados.emailDirigente || ""),
        secretarios: criptografarComMestra(dados.secretarios || ""),
        telefone: criptografarComMestra(dados.telefone || "")
      };

      // 📦 Carrega usuários existentes (se houver)
      let usuarios = [];
      if (fs.existsSync(USUARIO_PATH)) {
        try {
          const conteudo = fs.readFileSync(USUARIO_PATH, "utf8");
          const json = JSON.parse(conteudo);
          usuarios = Array.isArray(json.usuarios) ? json.usuarios : [];
          console.log(`📂 ${usuarios.length} usuário(s) carregado(s) do arquivo.`);
        } catch (erroLeitura) {
          console.error("❌ Erro ao ler ou parsear usuario.json:", erroLeitura);
          return {
            sucesso: false,
            erro: "Não foi possível acessar os dados salvos.",
          };
        }
      }

      // 🔁 Atualiza ou adiciona novo usuário
      const indexExistente = usuarios.findIndex(u => u.emailHash === emailHash);
      if (indexExistente !== -1) {
        console.log("♻️ Usuário já existente. Atualizando informações...");
        usuarios[indexExistente] = usuarioCriptografado;
      } else {
        console.log("🆕 Novo usuário adicionado.");
        usuarios.push(usuarioCriptografado);
      }

      // 💾 Garante que a pasta existe e salva o novo arquivo
      fs.mkdirSync(path.dirname(USUARIO_PATH), { recursive: true });
      fs.writeFileSync(USUARIO_PATH, JSON.stringify({ usuarios }, null, 2), "utf8");

      console.log("✅ Cadastro salvo com sucesso.");
      return { sucesso: true };

    } catch (erro) {
      console.error("❌ Erro inesperado ao salvar cadastro:", erro);
      return {
        sucesso: false,
        erro: "Erro interno ao salvar os dados do usuário.",
      };
    }
  });
}

module.exports = { registrarCadastroHandler };
