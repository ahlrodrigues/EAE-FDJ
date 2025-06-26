const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { ipcMain } = require("electron");
const { descriptografarComMestra } = require("../lib/criptografia");
const { definirSessaoAtiva } = require("../lib/sessionStore");

require("dotenv").config();
const chaveMestra = process.env.CRYPTO_SECRET || "chavePadrao";

const caminhoArquivo = path.join(
  process.env.HOME || process.env.USERPROFILE,
  ".config",
  "escola-aprendizes",
  "config",
  "usuario.json"
);

function registrarLoginHandler(ipcMain) {
  ipcMain.handle("validar-login", async (_, emailDigitado, senhaDigitada) => {
    console.log("🔐 Validando login para:", emailDigitado);

    if (!fs.existsSync(caminhoArquivo)) {
      console.warn("⚠️ Arquivo usuario.json não encontrado.");
      return { sucesso: false, erro: "Nenhum usuário cadastrado." };
    }

    let dados;
    try {
      dados = JSON.parse(fs.readFileSync(caminhoArquivo, "utf-8"));
    } catch (erro) {
      console.error("❌ Erro ao ler usuario.json:", erro);
      return { sucesso: false, erro: "Erro ao ler os dados do usuário." };
    }

    if (typeof dados.usuarios !== "object" || dados.usuarios === null) {
      console.warn("⚠️ Formato inválido no JSON");
      return { sucesso: false, erro: "Formato de dados inválido." };
    }

    for (const [emailHash, usuario] of Object.entries(dados.usuarios)) {
      try {
        const emailDescriptografado = descriptografarComMestra(
          usuario.emailCriptografado,
          chaveMestra
        );

        console.log("📩 Email digitado:", emailDigitado.toLowerCase());
        console.log("📬 Email descriptografado:", emailDescriptografado.toLowerCase());

        if (emailDescriptografado.toLowerCase() === emailDigitado.toLowerCase()) {
          const senhaValida = await bcrypt.compare(senhaDigitada, usuario.senhaCriptografada);

          if (senhaValida) {
            console.log("✅ Login bem-sucedido para:", emailDescriptografado);
            definirSessaoAtiva(emailHash);
            return {
              sucesso: true,
              emailHash,
            };
          }
           else {
            console.warn("🔒 Senha incorreta para:", emailDescriptografado);
            return { sucesso: false, erro: "Senha incorreta." };
          }
        }
      } catch (erro) {
        console.error(`❌ Erro ao processar usuário ${emailHash}:`, erro.message);
      }
    }

    console.warn("❌ Nenhum e-mail correspondente encontrado.");
    return { sucesso: false, erro: "Usuário não encontrado." };
  });
}

module.exports = registrarLoginHandler;
