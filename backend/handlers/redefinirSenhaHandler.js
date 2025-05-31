const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { criptografarComMestra, descriptografarComMestra } = require("../lib/criptografia");
const { redefinirSenha } = require("../servicos/redefinirSenhaService");

const USUARIO_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE,
  ".config",
  "escola-aprendizes",
  "config",
  "usuario.json"
);

function registrarRedefinirSenhaHandler(ipcMain) {
  ipcMain.handle("redefinir-senha", async (_, emailDigitado, tokenInformado, novaSenha) => {
    try {
      // Verifica se o arquivo de usuários existe
      if (!fs.existsSync(USUARIO_PATH)) {
        return { sucesso: false, erro: "Cadastro não encontrado." };
      }

      // Lê e parseia os dados do usuário
      const dados = JSON.parse(fs.readFileSync(USUARIO_PATH, "utf-8"));

      // Busca o usuário com base no e-mail descriptografado
      const usuario = dados.usuarios.find((u) => {
        try {
          const emailDescriptografado = descriptografarComMestra(
            u.emailCriptografado,
            process.env.CRYPTO_SECRET
          );
          return emailDescriptografado.toLowerCase() === emailDigitado.toLowerCase();
        } catch {
          return false;
        }
      });

      if (!usuario) {
        return { sucesso: false, erro: "E-mail não encontrado." };
      }

      // Verifica token e validade
      const agora = Date.now();
      if (
        usuario.tokenredefinir !== tokenInformado ||
        !usuario.tokenValidade ||
        agora > usuario.tokenValidade
      ) {
        return { sucesso: false, erro: "Token inválido ou expirado." };
      }

      // Valida a nova senha
      if (typeof novaSenha !== "string" || novaSenha.length < 6) {
        return { sucesso: false, erro: "Senha deve ter ao menos 6 caracteres." };
      }

      // Atualiza os dois campos de senha
      usuario.senha = await bcrypt.hash(novaSenha, 10); // usado no login
      usuario.senhaCriptografada = criptografarComMestra(novaSenha, process.env.CRYPTO_SECRET);

      // Remove o token após uso
      delete usuario.tokenredefinir;
      delete usuario.tokenValidade;

      // Salva de volta no arquivo
      fs.writeFileSync(USUARIO_PATH, JSON.stringify(dados, null, 2));
      return { sucesso: true };
    } catch (erro) {
      console.error("❌ Erro interno na redefinição de senha:", erro);
      return { sucesso: false, erro: "Erro interno na redefinição de senha." };
    }
  });
}

module.exports = { registrarRedefinirSenhaHandler };
