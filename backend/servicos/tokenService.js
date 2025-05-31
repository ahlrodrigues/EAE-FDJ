const fs = require("fs");
const path = require("path");
const { descriptografarComMestra } = require("../lib/criptografia");
const { gerarToken } = require("../utils/gerarToken");
const { enviarEmail } = require("../lib/email");

const USUARIO_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE,
  ".config",
  "escola-aprendizes",
  "config",
  "usuario.json"
);

async function solicitarToken(emailDigitado) {
  if (!fs.existsSync(USUARIO_PATH)) {
    return { sucesso: false, erro: "Nenhum cadastro encontrado." };
  }

  const dados = JSON.parse(fs.readFileSync(USUARIO_PATH, "utf-8"));
  const usuario = dados.usuarios?.find((u) => {
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

  const token = gerarToken(6);
  const validade = Date.now() + 15 * 60 * 1000;
  usuario.tokenredefinir = token;
  usuario.tokenValidade = validade;

  fs.writeFileSync(USUARIO_PATH, JSON.stringify(dados, null, 2));

  const html = `
    <div style="font-family: Arial; text-align: center;">
      <h2>Código de Redefinição</h2>
      <p>Use o código abaixo para redefinir sua senha:</p>
      <p style="font-size: 24px; font-weight: bold;">${token}</p>
      <p>Este código expira em 15 minutos.</p>
    </div>
  `;

  await enviarEmail({
    to: emailDigitado,
    subject: "Código de redefinição de senha",
    html
  });

  return { sucesso: true };
}

module.exports = { solicitarToken };
