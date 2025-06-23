const { ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const {
  criptografarComMestra,
  criptografarCamposUsuario
} = require("../lib/criptografia");

// 🧪 Carrega .env e chave de criptografia
dotenv.config();
const chaveMestra = process.env.CRYPTO_SECRET || "chavePadrao";

if (!process.env.CRYPTO_SECRET) {
  console.warn("⚠️ Variável CRYPTO_SECRET não definida. Usando chaveMestra padrão.");
}
console.log("🔐 CRYPTO_SECRET recebido:", chaveMestra);

// 📁 Caminho do JSON
const pastaConfig = path.join(
  process.env.HOME || process.env.USERPROFILE,
  ".config/escola-aprendizes/config"
);
const caminhoArquivo = path.join(pastaConfig, "usuario.json");

// ✅ Função principal de cadastro
function registrarCadastroHandler() {
  ipcMain.handle("salvar-cadastro", async (event, dados) => {
    try {
      console.log("📥 Dados recebidos para cadastro:", dados);

      if (!dados.emailHash) {
        throw new Error("Campo 'emailHash' ausente");
      }

      // 🔐 Criptografa o e-mail
      dados.emailCriptografado = criptografarComMestra(dados.email, chaveMestra);
      delete dados.email;

      // 🔒 Hash da senha
      dados.senhaCriptografada = await bcrypt.hash(dados.senha, 10);
      delete dados.senha;

      // 🔐 Criptografa os demais campos sensíveis
      const dadosCriptografados = await criptografarCamposUsuario(dados, chaveMestra);
      console.log("🔐 Dados criptografados:", dadosCriptografados);

      // 📂 Garante que a pasta existe
      fs.mkdirSync(pastaConfig, { recursive: true });

      // 📄 Lê arquivo existente se houver
      let dadosExistentes = {};
      if (fs.existsSync(caminhoArquivo)) {
        console.log("📄 Lendo arquivo existente...");
        dadosExistentes = JSON.parse(fs.readFileSync(caminhoArquivo, "utf-8"));
      }

      // 📦 Inicializa estrutura se necessário
      if (!dadosExistentes.usuarios) {
        console.log("📁 Criando estrutura inicial de usuários...");
        dadosExistentes.usuarios = {};
      }

      // 💾 Salva novo usuário
      dadosExistentes.usuarios[dados.emailHash] = dadosCriptografados;
      const jsonFinal = JSON.stringify(dadosExistentes, null, 2);
      fs.writeFileSync(caminhoArquivo, jsonFinal, "utf-8");

      console.log("✅ Usuário salvo com sucesso:", dados.emailHash);
      return { sucesso: true };
    } catch (erro) {
      console.error("❌ Erro ao salvar usuário:", erro);
      return { sucesso: false, erro: erro.message };
    }
  });
}

module.exports = { registrarCadastroHandler };
