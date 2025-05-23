const fs = require("fs");
const path = require("path");
const os = require("os");
const bcrypt = require("bcryptjs");
const { app } = require("electron");
const { decryptData } = require("../lib/criptografia");

function registrarLoginHandler(ipcMain) {
  console.log("📥 loginHandler.js carregado");

  const usuarioPath = path.join(
    os.homedir(),
    ".config",
    "escola-aprendizes",
    "config",
    "usuario.json"
  );

  console.log("📄 Caminho resolvido do usuario.json:", usuarioPath);
  console.log("📄 Arquivo existe?", fs.existsSync(usuarioPath));

  // Handler de login
  ipcMain.handle("validar-login", async (_, emailDigitado, senhaDigitada) => {
    console.log("🔐 Validando login para:", emailDigitado);

    if (!fs.existsSync(usuarioPath)) {
      return { sucesso: false, erro: "Nenhum usuário cadastrado." };
    }

    let dados;
    try {
      dados = JSON.parse(fs.readFileSync(usuarioPath, "utf-8"));
    } catch (erro) {
      return { sucesso: false, erro: "Erro ao ler os dados do usuário." };
    }

    if (!Array.isArray(dados.usuarios)) {
      return { sucesso: false, erro: "Formato de dados inválido." };
    }

    for (const usuario of dados.usuarios) {
      try {
        const emailSalvo = decryptData(usuario.emailCriptografado, process.env.CRYPTO_SECRET);
        if (emailSalvo.toLowerCase() === emailDigitado.toLowerCase()) {
          const senhaSalva = decryptData(usuario.senhaCriptografada, process.env.CRYPTO_SECRET);
          const senhaOk = await bcrypt.compare(senhaDigitada, senhaSalva);
          if (senhaOk) {
            console.log("✅ Login autorizado para:", emailSalvo);
            return { sucesso: true };
          } else {
            return { sucesso: false, erro: "Senha incorreta." };
          }
        }
      } catch (erroInterno) {
        console.warn("⚠️ Erro ao comparar credenciais:", erroInterno);
      }
    }

    return { sucesso: false, erro: "E-mail não encontrado." };
  });
}
module.exports = registrarLoginHandler;