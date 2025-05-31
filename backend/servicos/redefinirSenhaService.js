
const fs = require("fs");
const path = require("path");
const { descriptografarComMestra, criptografarComMestra } = require("../lib/criptografia");

const USUARIO_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE,
  ".config",
  "escola-aprendizes",
  "config",
  "usuario.json"
);

async function redefinirSenha(emailDigitado, tokenInformado, novaSenha) {
  if (!fs.existsSync(USUARIO_PATH)) {
    return { sucesso: false, erro: "Cadastro não encontrado." };
  }

  const dados = JSON.parse(fs.readFileSync(USUARIO_PATH, "utf-8"));

  const usuario = dados.usuarios.find((u) => {
    try {
      const emailDescriptografado = descriptografarComMestra(u.emailCriptografado, process.env.CRYPTO_SECRET);
      return emailDescriptografado.toLowerCase() === emailDigitado.toLowerCase();
    } catch {
      return false;
    }
  });

  if (!usuario) {
    return { sucesso: false, erro: "E-mail não encontrado." };
  }

  const agora = Date.now();
  if (!usuario.tokenredefinir || !usuario.tokenValidade || agora > usuario.tokenValidade || usuario.tokenredefinir !== tokenInformado) {
    return { sucesso: false, erro: "Token inválido ou expirado." };
  }

  console.log("🔐 Substituindo senha de:", emailDigitado);

  usuario.senhaCriptografada = criptografarComMestra(novaSenha, process.env.CRYPTO_SECRET);
  delete usuario.tokenredefinir;
  delete usuario.tokenValidade;

  fs.writeFileSync(USUARIO_PATH, JSON.stringify(dados, null, 2));
  console.log("✅ Senha redefinida com sucesso.");
  return { sucesso: true };
}

module.exports = { redefinirSenha };
