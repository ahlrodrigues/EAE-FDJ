const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { descriptografarComMestra } = require("../lib/criptografia");
const { enviarTokenPorEmail } = require("../lib/email");

const USUARIO_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE,
  ".config",
  "escola-aprendizes",
  "config",
  "usuario.json"
);

function registrarSolicitarTokenHandler(ipcMain) {
  ipcMain.handle("solicitar-token", async (_, emailDigitado) => {
    console.log("📨 Solicitando token para:", emailDigitado);

    try {
      if (!fs.existsSync(USUARIO_PATH)) {
        console.warn("📂 Arquivo usuario.json não encontrado.");
        return { sucesso: false, erro: "Cadastro não encontrado." };
      }

      const dados = JSON.parse(fs.readFileSync(USUARIO_PATH, "utf8"));

      const usuario = dados.usuarios.find((u, i) => {
        try {
          const email = descriptografarComMestra(u.emailCriptografado, process.env.CRYPTO_SECRET);
          console.log(`🔍 Comparando com usuário[${i}]: ${email}`);
          return email.toLowerCase() === emailDigitado.toLowerCase();
        } catch (erro) {
          console.warn(`⚠️ Falha ao descriptografar e-mail do usuário[${i}]`, erro);
          return false;
        }
      });

      if (!usuario) {
        return { sucesso: false, erro: "E-mail não encontrado." };
      }

      const token = crypto.randomBytes(4).toString("hex");
      const validade = Date.now() + 15 * 60 * 1000;

      usuario.tokenredefinir = token;
      usuario.tokenValidade = validade;

      fs.writeFileSync(USUARIO_PATH, JSON.stringify(dados, null, 2));
      console.log("💾 Token salvo com sucesso. Enviando e-mail...");

      await enviarTokenPorEmail(emailDigitado, token);
      console.log("✅ E-mail enviado com sucesso.");

      return { sucesso: true };
    } catch (erro) {
      console.error("❌ Erro ao gerar token:", erro);
      return { sucesso: false, erro: "Erro ao gerar token." };
    }
  });
}

module.exports = { registrarSolicitarTokenHandler };
