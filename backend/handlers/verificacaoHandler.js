
const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const { decryptData } = require("../lib/criptografia");

function registrarVerificacaoHandler(ipcMain) {
  ipcMain.handle("verificar-email-existente", async (_, emailDigitado) => {
    try {
      console.log("🔍 Verificando se e-mail já está cadastrado:", emailDigitado);
      const caminho = USUARIO_PATH;
      if (!fs.existsSync(caminho)) {
        console.warn("📂 Arquivo usuarios.json não encontrado.");
        return false;
      }

      const usuarios = JSON.parse(fs.readFileSync(caminho, "utf8"));
      const chave = process.env.CRYPTO_SECRET;

      for (const usuario of usuarios) {
        try {
          const emailSalvo = decryptData(usuario.emailCriptografado, chave);
          if (emailSalvo.toLowerCase() === emailDigitado.toLowerCase()) {
            console.log("⚠️ E-mail já existente:", emailDigitado);
            return true;
          }
        } catch (erroInterno) {
          console.warn("Erro ao descriptografar e comparar e-mail:", erroInterno);
        }
      }

      return false;
    } catch (erro) {
      console.error("❌ Erro ao verificar e-mail existente:", erro);
      return false;
    }
  });
}

module.exports = registrarVerificacaoHandler;
