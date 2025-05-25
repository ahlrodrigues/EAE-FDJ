const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const {
  descriptografarComMestra,
  gerarHashEmailComMestra,
} = require("../lib/criptografia");
const {
  enviarEmailRedefinicao,
  enviarEmailConfirmacaoRedefinicao,
} = require("../lib/email");

const USUARIOS_PATH = path.resolve("config/usuario.json");
const CRYPTO_SECRET = process.env.CRYPTO_SECRET || "segredoAppSeguro";

// 🔐 Gera token com emailHash como payload
function gerarTokenJWT(emailHash) {
  const token = jwt.sign({ emailHash }, CRYPTO_SECRET, { expiresIn: "15m" });
  console.log(`🔐 Token gerado para hash ${emailHash}`);
  return token;
}

// 🛠 Atualiza a senha do usuário identificado por emailHash
function atualizarSenha(emailHash, novaSenhaCriptografada) {
  if (!fs.existsSync(USUARIOS_PATH)) return false;

  const dados = JSON.parse(fs.readFileSync(USUARIOS_PATH, "utf-8"));
  const usuario = dados.usuarios.find((u) => u.emailHash === emailHash);

  if (!usuario) return false;

  usuario.senhaCriptografada = novaSenhaCriptografada;
  fs.writeFileSync(USUARIOS_PATH, JSON.stringify(dados, null, 2));
  console.log(`🔁 Senha atualizada com sucesso para hash ${emailHash}`);
  return true;
}

// 🔍 Verifica token e retorna emailHash
function verificarTokenJWT(token) {
  try {
    const decoded = jwt.verify(token, CRYPTO_SECRET);
    console.log(`✅ Token válido para hash: ${decoded.emailHash}`);
    return decoded.emailHash;
  } catch (err) {
    console.warn("❌ Token inválido ou expirado.");
    return null;
  }
}

// 🚀 Registrador dos handlers
function registrarSenhaHandler(ipcMain) {
  ipcMain.handle("senha:solicitar-token", async (_, email) => {
    const dados = JSON.parse(fs.readFileSync(USUARIOS_PATH, "utf-8"));
    const emailNormalizado = email.trim().toLowerCase();

    // Encontra o usuário descriptografando
    const usuario = dados.usuarios.find((u) => {
      const emailDescriptografado = descriptografarComMestra(u.emailCriptografado);
      return emailDescriptografado === emailNormalizado;
    });

    if (!usuario) return { sucesso: false, erro: "Email não encontrado." };

    const token = gerarTokenJWT(usuario.emailHash);
    await enviarEmailRedefinicao(emailNormalizado, token);

    return { sucesso: true };
  });

  ipcMain.handle("senha:redefinir", async (_, { token, novaSenha }) => {
    const emailHash = verificarTokenJWT(token);
    if (!emailHash) return { sucesso: false, erro: "Token inválido ou expirado." };

    const senhaHash = await bcrypt.hash(CRYPTO_SECRET + novaSenha, 10);
    const atualizou = atualizarSenha(emailHash, senhaHash);

    if (!atualizou) return { sucesso: false, erro: "Usuário não encontrado." };

    // 🔁 Envia e-mail de confirmação
    const dados = JSON.parse(fs.readFileSync(USUARIOS_PATH, "utf-8"));
    const usuario = dados.usuarios.find((u) => u.emailHash === emailHash);
    if (usuario) {
      const email = descriptografarComMestra(usuario.emailCriptografado);
      await enviarEmailConfirmacaoRedefinicao(email);
    }

    return { sucesso: true };
  });
}

module.exports = registrarSenhaHandler;
