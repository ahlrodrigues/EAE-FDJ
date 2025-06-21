// === preload.js ===
const { contextBridge, ipcRenderer } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");
const dotenv = require("dotenv");
dotenv.config();

// 🔐 Criptografia
const { criptografarComMestra, descriptografarComMestra } = require("./backend/lib/criptografia");

console.log("🧠 preload.js carregado");

// ✅ Expor acesso nativo ao sistema (útil para o renderer)
contextBridge.exposeInMainWorld("nativo", {
  fs,
  path,
  os,
  criptografarComMestra,
  descriptografarComMestra,
  getEnv: (chave) => process.env[chave] || null,
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
async function obterNomeAlunoDescriptografado() {
  try {
    const usuarioPath = path.join(
      os.homedir(),
      ".config",
      "escola-aprendizes",
      "config",
      "usuario.json"
    );

    if (!fs.existsSync(usuarioPath)) {
      console.warn("⚠️ usuario.json não encontrado.");
      return null;
    }

    const raw = fs.readFileSync(usuarioPath, "utf-8");
    const dados = JSON.parse(raw);
    const alunoCriptografado = dados.usuarios?.[0]?.aluno;

    if (!alunoCriptografado) {
      console.warn("⚠️ Campo 'aluno' está vazio ou ausente.");
      return null;
    }

    const descriptografado = await ipcRenderer.invoke("descriptografar-com-mestra", alunoCriptografado);
    return descriptografado?.replace(/[^\w\-]/g, "_") || "usuario";
  } catch (erro) {
    console.error("❌ Erro ao obter nome do aluno descriptografado:", erro);
    return null;
  }
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
      const json = await ipcRenderer.invoke("ler-usuario");
      const usuario = json?.usuarios?.[0];
      const emailHash = usuario?.emailHash;

      if (!emailHash) throw new Error("emailHash não encontrado");

      return await ipcRenderer.invoke("listar-arquivos-notas", emailHash);
    } catch (erro) {
      console.error("❌ Erro ao listar arquivos de anotações:", erro.message);
      return [];
    }
  },
});

console.log("🧪 preload pronto. APIs carregadas.");
