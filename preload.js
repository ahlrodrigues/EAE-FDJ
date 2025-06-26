const { contextBridge, ipcRenderer } = require("electron");
const fs = require("fs").promises;
const fsSync = require("fs"); // síncrono para leitura rápida
const path = require("path");
const os = require("os");
const dotenv = require("dotenv");
dotenv.config();
const crypto = require("crypto");

const CRYPTO_SECRET = process.env.CRYPTO_SECRET;

// 🔐 Criptografia
const {
  criptografarComMestra,
  descriptografarComMestra
} = require("./backend/lib/criptografia");

console.log("🔐 CRYPTO_SECRET usado no preload:", CRYPTO_SECRET);
console.log("🧠 preload.js carregado");

// ✅ Expor acesso nativo ao sistema (útil para o renderer)
contextBridge.exposeInMainWorld("nativo", {
  fs,
  path,
  os,
  criptografarComMestra,
  descriptografarComMestra,
  getEnv: (chave) => process.env[chave] || null,

  gerarEmailHash: (email) => {
    return crypto
      .createHmac("sha256", CRYPTO_SECRET)
      .update(email)
      .digest("hex");
  },

  arquivoExiste: async (caminhoRelativo) => {
    const completo = path.join(
      os.homedir(),
      ".config",
      "escola-aprendizes",
      "config",
      caminhoRelativo
    );
    try {
      await fs.access(completo);
      console.log("✅ Arquivo existe:", completo);
      return true;
    } catch {
      console.warn("❌ Arquivo não existe:", completo);
      return false;
    }
  },
});

// 🧾 Função auxiliar para obter o nome do primeiro usuário (key do objeto)
function obterPrimeiroUsuario(dados) {
  const chaves = Object.keys(dados.usuarios || {});
  return dados.usuarios?.[chaves[0]] || null;
}

// ✅ Nome do usuário sem descriptografar (ex: salvar nome de arquivo)
function obterNomeUsuario() {
  try {
    const usuarioPath = path.join(
      os.homedir(),
      ".config",
      "escola-aprendizes",
      "config",
      "usuario.json"
    );
    const raw = fsSync.readFileSync(usuarioPath, "utf-8");
    const dados = JSON.parse(raw);
    const usuario = obterPrimeiroUsuario(dados);

    const nome = usuario?.aluno || "usuario";
    return nome.replace(/\s+/g, "_");
  } catch (e) {
    console.warn("⚠️ Não foi possível obter nome do usuário:", e.message);
    return null;
  }
}

function obterEmailHash() {
  const usuarioPath = path.join(
    os.homedir(),
    ".config",
    "escola-aprendizes",
    "config",
    "usuario.json"
  );

  try {
    const raw = fsSync.readFileSync(usuarioPath, "utf-8");
    const dados = JSON.parse(raw);
    const chaves = Object.keys(dados.usuarios || {});

    return chaves[0] || null;
  } catch (erro) {
    console.error("❌ Erro ao obter emailHash:", erro.message);
    return null;
  }
}

// 🔐 Nome descriptografado do aluno
function obterNomeAlunoDescriptografado() {
  const usuarioPath = path.join(
    os.homedir(),
    ".config",
    "escola-aprendizes",
    "config",
    "usuario.json"
  );

  try {
    const raw = fsSync.readFileSync(usuarioPath, "utf-8");
    const dados = JSON.parse(raw);
    const usuario = obterPrimeiroUsuario(dados);

    if (usuario?.aluno) {
      console.log("🔐 Campo 'aluno' criptografado:", usuario.aluno);
      const nome = descriptografarComMestra(usuario.aluno, CRYPTO_SECRET);
      console.log("✅ Nome do aluno descriptografado:", nome);
      return nome;
    } else {
      console.warn("⚠️ Campo 'aluno' não encontrado.");
    }
  } catch (erro) {
    console.error("❌ Erro ao acessar usuario.json:", erro.message);
  }

  return null;
}

// ✅ API principal exposta para o renderer
contextBridge.exposeInMainWorld("api", {
  validarLogin: (email, senha) => ipcRenderer.invoke("validar-login", email, senha),
  definirSessao: (emailHash) => ipcRenderer.send("sessao-definir", emailHash),
  salvarCadastro: (dados) => ipcRenderer.invoke("salvar-cadastro", dados),
  verificarEmailExistente: (email) => ipcRenderer.invoke("verificar-email-existente", email),

  solicitarToken: (email) => ipcRenderer.invoke("solicitar-token", email),
  redefinirSenha: (email, token, novaSenha) => ipcRenderer.invoke("redefinir-senha", email, token, novaSenha),

  buscarUltimaPublicacao: () => ipcRenderer.invoke("blog:buscarUltimaPublicacao"),
  lerUsuario: () => ipcRenderer.invoke("ler-usuario"),

  descriptografarComMestra: (texto) => ipcRenderer.invoke("descriptografar-com-mestra", texto),

  salvarAnotacao: (conteudo, nomeArquivo) => ipcRenderer.invoke("salvar-anotacao", conteudo, nomeArquivo),
  lerArquivo: (caminho) => ipcRenderer.invoke("ler-arquivo", caminho),

  obterNomeUsuario: () => obterNomeUsuario(),
  obterNomeAlunoDescriptografado: () => obterNomeAlunoDescriptografado(),
  obterEmailHash: () => obterEmailHash(),

  listarArquivosNotas: async () => {
    try {
      const dados = await ipcRenderer.invoke("ler-usuario");
      const usuario = obterPrimeiroUsuario(dados);
      const emailHash = usuario?.emailHash;

      if (!emailHash) throw new Error("❌ emailHash não encontrado");

      const pastaNotas = path.join(
        os.homedir(),
        ".config",
        "escola-aprendizes",
        "notas",
        emailHash
      );

      const nomes = await fs.readdir(pastaNotas);
      const caminhos = nomes.map((nome) => path.join(pastaNotas, nome));
      console.log("📂 Caminhos absolutos das anotações:", caminhos);
      return caminhos;
    } catch (erro) {
      console.error("❌ Erro ao listar arquivos de notas:", erro);
      return [];
    }
  },
});

console.log("🧪 preload pronto. APIs carregadas.");
