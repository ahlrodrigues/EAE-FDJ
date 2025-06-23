// === preload.js ===
const { contextBridge, ipcRenderer } = require("electron");
const fs = require("fs").promises;
const path = require("path");
const os = require("os");
const dotenv = require("dotenv");
dotenv.config();
const crypto = require("crypto");

const CRYPTO_SECRET = process.env.CRYPTO_SECRET;

// 🔐 Criptografia
const { criptografarComMestra, descriptografarComMestra } = require("./backend/lib/criptografia");
console.log("🔐 CRYPTO_SECRET usado no preload:", process.env.CRYPTO_SECRET);
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
      .createHmac('sha256', CRYPTO_SECRET)
      .update(email)
      .digest('hex');
  }   
});

// 🧾 Função auxiliar para obter o nome do aluno (não criptografado)
function obterNomeUsuario() {
  try {
    const usuarioPath = path.join(
      os.homedir(),
      ".config",
      "escola-aprendizes",
      "config",
      "usuario.json"
    );
    const raw = fs.readFileSync(usuarioPath, "utf-8");
    const dados = JSON.parse(raw);
    const nome = dados.usuarios?.[0]?.aluno || "usuario";
    return nome.replace(/\s+/g, "_");
  } catch (e) {
    console.warn("⚠️ Não foi possível obter nome do usuário:", e.message);
    return null;
  }
}

// 🔐 Função que usa o handler do main para descriptografar o nome do aluno
// 🔐 Função que usa a chave mestra para descriptografar o nome do aluno
function obterNomeAlunoDescriptografado() {
  const fsSync = require("fs"); // usamos 'fsSync' para evitar conflito com 'fs' async
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
    const usuario = dados.usuarios?.[0];

    if (usuario?.aluno) {
      console.log("🔐 Campo 'aluno' criptografado:", usuario.aluno);
      try {
        const nome = descriptografarComMestra(usuario.aluno);
        console.log("✅ Nome do aluno descriptografado:", nome);
        return nome;
      } catch (erroDesc) {
        console.error("❌ Erro ao descriptografar aluno:", erroDesc.message);
      }
    } else {
      console.warn("⚠️ Campo 'aluno' não encontrado.");
    }
  } catch (erro) {
    console.error("❌ Erro ao acessar usuario.json:", erro.message);
  }

  return null;
}

// ✅ Expor API de comunicação segura com o processo principal
contextBridge.exposeInMainWorld("api", {
  // Autenticação e cadastro
  validarLogin: (email, senha) => ipcRenderer.invoke("validar-login", email, senha),
  salvarCadastro: (dados) => ipcRenderer.invoke("salvar-cadastro", dados),
  verificarEmailExistente: (email) => ipcRenderer.invoke("verificar-email-existente", email),

  // Recuperação de senha
  solicitarToken: (email) => ipcRenderer.invoke("solicitar-token", email),
  redefinirSenha: (email, token, novaSenha) => ipcRenderer.invoke("redefinir-senha", email, token, novaSenha),

  // Conteúdo e dados
  buscarUltimaPublicacao: () => ipcRenderer.invoke("blog:buscarUltimaPublicacao"),
  lerUsuario: () => ipcRenderer.invoke("ler-usuario"),

  // Criptografia
  descriptografarComMestra: (texto) => ipcRenderer.invoke("descriptografar-com-mestra", texto),

  // Notas
  salvarAnotacao: (conteudo, nomeArquivo) => ipcRenderer.invoke("salvar-anotacao", conteudo, nomeArquivo),
  lerArquivo: (caminho) => ipcRenderer.invoke("ler-arquivo", caminho),

  // Utilitários internos
  obterNomeUsuario: () => obterNomeUsuario(),
  obterNomeAlunoDescriptografado: () => obterNomeAlunoDescriptografado(),

  // Listagem de arquivos da pasta de anotações
  listarArquivosNotas: async () => {
    try {
      const usuario = await ipcRenderer.invoke("ler-usuario");
      const emailHash = usuario?.usuarios?.[0]?.emailHash;

      if (!emailHash) throw new Error("❌ emailHash não encontrado");

      const pastaNotas = path.join(
        os.homedir(),
        ".config",
        "escola-aprendizes",
        "notas",
        emailHash
      );

      const nomes = await fs.readdir(pastaNotas); // ✅ sem callback
      const caminhos = nomes.map(nome => path.join(pastaNotas, nome));

      console.log("📂 Caminhos absolutos das anotações:", caminhos);
      return caminhos;
    } catch (erro) {
      console.error("❌ Erro ao listar arquivos de notas:", erro);
      return [];
    }
  },
});

console.log("🧪 preload pronto. APIs carregadas.");
