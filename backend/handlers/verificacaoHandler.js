const fs = require("fs");
const path = require("path");
const { descriptografarComMestra } = require("../lib/criptografia");

const USUARIO_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE,
  ".config",
  "escola-aprendizes",
  "config",
  "usuario.json"
);

/**
 * Handler para verificar se um e-mail já está cadastrado (criptografado)
 */
function registrarVerificacaoHandler(ipcMain) {
  ipcMain.handle("verificar-email-existente", async (_, emailDigitado) => {
    try {
      console.log("🔍 Verificando se e-mail já está cadastrado:", emailDigitado);

      if (!fs.existsSync(USUARIO_PATH)) {
        console.warn("📂 Arquivo usuario.json não encontrado.");
        return false;
      }

      const conteudo = JSON.parse(fs.readFileSync(USUARIO_PATH, "utf8"));
      const usuarios = Array.isArray(conteudo.usuarios) ? conteudo.usuarios : [];

      for (const usuario of usuarios) {
        try {
          const emailDescriptografado = descriptografarComMestra(usuario.emailCriptografado);

          if (emailDescriptografado?.toLowerCase() === emailDigitado.trim().toLowerCase()) {
            console.log("⚠️ E-mail já existente:", emailDigitado);
            return true;
          }
        } catch (erroDescriptografia) {
          console.warn("⚠️ Falha ao descriptografar e-mail de um usuário:", erroDescriptografia);
        }
      }

      console.log("✅ E-mail não encontrado. Cadastro permitido.");
      return false;

    } catch (erro) {
      console.error("❌ Erro ao verificar e-mail existente:", erro);
      return false;
    }
  });
}

module.exports = registrarVerificacaoHandler;
