// === preload.js ===
// Exposição controlada de APIs para o renderer.
// Correções implementadas:
// - Removido uso direto de descriptografar/criptografar no preload (agora via IPC).
// - Nova API window.api.lerTema com suporte a (caminho absoluto) OU (emailHash, nomeArquivo).
// - Helper central para diretório de temas (compatível com decisão do projeto).
// - Logs detalhados e padronizados.
// - Resiliência quando handlers não existirem (mensagens claras).

const { contextBridge, ipcRenderer } = require("electron");
const fs = require("fs").promises;
const fsSync = require("fs"); // síncrono (uso pontual)
const path = require("path");
const os = require("os");
const dotenv = require("dotenv");
const crypto = require("crypto");
dotenv.config();

const CRYPTO_SECRET = process.env.CRYPTO_SECRET;

console.log("🔐 [PRELOAD] CRYPTO_SECRET definido?", Boolean(CRYPTO_SECRET));
console.log("🧠 [PRELOAD] preload.js carregado");

// ============================================================================
// 🔧 Helpers locais (NÃO expostos diretamente)
// ============================================================================

/** Retorna o primeiro usuário do objeto usuarios (o "registro ativo"). */
function obterPrimeiroUsuario(dados) {
  const chaves = Object.keys(dados?.usuarios || {});
  return dados?.usuarios?.[chaves[0]] || null;
}

/** Caminho do arquivo de configuração do usuário. */
function getUserConfigPath() {
  return path.join(os.homedir(), ".config", "escola-aprendizes", "config", "usuario.json");
}

/** Lê o emailHash (chave) do primeiro usuário no usuario.json. */
function obterEmailHashInterno() {
  try {
    const raw = fsSync.readFileSync(getUserConfigPath(), "utf-8");
    const dados = JSON.parse(raw);
    const chaves = Object.keys(dados.usuarios || {});
    const emailHash = chaves[0] || null;
    if (!emailHash) console.warn("⚠️ [PRELOAD] emailHash não encontrado no usuario.json.");
    return emailHash;
  } catch (erro) {
    console.error("❌ [PRELOAD] Erro ao obter emailHash:", erro.message);
    return null;
  }
}

/** Diretório de temas conforme padrão do projeto: ~/.config/escola-aprendizes/temas/<emailHash>/ */
function getTemasDir(emailHash) {
  const hash = String(emailHash || "").trim();
  return path.join(os.homedir(), ".config", "escola-aprendizes", "temas", hash);
}

/** Gera HMAC-SHA256 a partir do email com a CRYPTO_SECRET. */
function gerarEmailHashInterno(email) {
  try {
    return crypto.createHmac("sha256", CRYPTO_SECRET || "").update(email || "").digest("hex");
  } catch (e) {
    console.error("❌ [PRELOAD] Falha ao gerar emailHash:", e.message);
    return null;
  }
}

// ============================================================================
// 🌐 Canal termo-aceito (evento assíncrono vindo do main)
// ============================================================================
let callbackTermoAceito = null;
ipcRenderer.removeAllListeners("termo-aceito");
ipcRenderer.on("termo-aceito", (_evento, _dados) => {
  console.log("📥 [PRELOAD] Evento 'termo-aceito' recebido");
  if (typeof callbackTermoAceito === "function") {
    try {
      console.log("🧩 [PRELOAD] Executando callback para 'termo-aceito'");
      callbackTermoAceito();
    } catch (e) {
      console.error("❌ [PRELOAD] Erro no callback de 'termo-aceito':", e.message);
    }
  } else {
    console.warn("⚠️ [PRELOAD] Nenhum callback registrado para 'termo-aceito'.");
  }
});

// ============================================================================
// 🧭 Expor alguns módulos nativos de forma limitada (como você já fazia)
//  ⚠️ Atenção: expor fs/path/os amplia superfície — mantenha apenas o necessário.
// ============================================================================
contextBridge.exposeInMainWorld("nativo", {
  fs, // assíncrono (promises)
  path,
  os,
  getEnv: (chave) => process.env[chave] || null,

  gerarEmailHash: (email) => gerarEmailHashInterno(email),

  // 👉 Criptografia via IPC (NÃO direto no preload)
  criptografarComMestra: async (texto) => {
    try {
      const res = await ipcRenderer.invoke("criptografar-com-mestra", texto);
      return res;
    } catch (e) {
      console.error("❌ [PRELOAD] Falha ao criptografar via IPC:", e.message);
      throw e;
    }
  },

  arquivoExiste: async (caminhoRelativo) => {
    const completo = path.join(os.homedir(), ".config", "escola-aprendizes", "config", caminhoRelativo);
    try {
      await fs.access(completo);
      console.log("✅ [PRELOAD] Arquivo existe:", completo);
      return true;
    } catch {
      console.warn("❌ [PRELOAD] Arquivo não existe:", completo);
      return false;
    }
  },
});

// ============================================================================
// 🧾 Utilidades de usuário exibidas via API
// ============================================================================
/** Nome do usuário sem descriptografar (somente para casos não sensíveis). */
function obterNomeUsuarioPlano() {
  try {
    const raw = fsSync.readFileSync(getUserConfigPath(), "utf-8");
    const dados = JSON.parse(raw);
    const usuario = obterPrimeiroUsuario(dados);
    const nome = usuario?.aluno || "usuario";
    return String(nome).replace(/\s+/g, "_");
  } catch (e) {
    console.warn("⚠️ [PRELOAD] Não foi possível obter nome do usuário:", e.message);
    return null;
  }
}

/** Nome descriptografado do aluno (via IPC seguro). */
async function obterNomeAlunoDescriptografadoInterno() {
  try {
    const raw = fsSync.readFileSync(getUserConfigPath(), "utf-8");
    const dados = JSON.parse(raw);
    const usuario = obterPrimeiroUsuario(dados);

    if (!usuario?.aluno) {
      console.warn("⚠️ [PRELOAD] Campo 'aluno' não encontrado no usuario.json.");
      return null;
    }

    const descriptografado = await ipcRenderer.invoke("descriptografar-com-mestra", usuario.aluno);
    console.log("✅ [PRELOAD] Nome do aluno descriptografado (tamanho):", descriptografado?.length || 0);
    return descriptografado || null;
  } catch (erro) {
    console.error("❌ [PRELOAD] Erro ao obter nome do aluno:", erro.message);
    return null;
  }
}

// ============================================================================
// 🧩 API principal exposta para o renderer (window.api)
// ============================================================================
contextBridge.exposeInMainWorld("api", {
  // ---- Autenticação / sessão / cadastro
  validarLogin: (email, senha) => ipcRenderer.invoke("validar-login", email, senha),
  definirSessao: (emailHash) => ipcRenderer.send("sessao-definir", emailHash),
  salvarCadastro: (dados) => ipcRenderer.invoke("salvar-cadastro", dados),
  verificarEmailExistente: (email) => ipcRenderer.invoke("verificar-email-existente", email),

  // ---- Recuperação de senha
  solicitarToken: (email) => ipcRenderer.invoke("solicitar-token", email),
  redefinirSenha: (email, token, novaSenha) => ipcRenderer.invoke("redefinir-senha", email, token, novaSenha),

  // ---- Conteúdo/Blog
  buscarUltimaPublicacao: () => ipcRenderer.invoke("blog:buscarUltimaPublicacao"),

  // ---- Usuário
  lerUsuario: () => ipcRenderer.invoke("ler-usuario"),
  salvarUsuario: (dados) => ipcRenderer.invoke("salvar-usuario", dados),

  // ---- Criptografia (sempre via MAIN)
  descriptografarComMestra: (texto) => ipcRenderer.invoke("descriptografar-com-mestra", texto),

  // ---- Anotações
  salvarAnotacao: (conteudo, nomeArquivo) => ipcRenderer.invoke("salvar-anotacao", conteudo, nomeArquivo),
  lerArquivo: (caminho) => ipcRenderer.invoke("ler-arquivo", caminho),
  listarArquivosNotas: async () => {
    try {
      const dados = await ipcRenderer.invoke("ler-usuario");
      const usuario = obterPrimeiroUsuario(dados);
      const emailHash = usuario?.emailHash || obterEmailHashInterno();
      if (!emailHash) throw new Error("emailHash não encontrado");

      const pastaNotas = path.join(os.homedir(), ".config", "escola-aprendizes", "notas", emailHash);
      const nomes = await fs.readdir(pastaNotas);
      const caminhos = nomes.map((nome) => path.join(pastaNotas, nome));
      console.log("📂 [PRELOAD] Caminhos absolutos das anotações:", caminhos.length);
      return caminhos;
    } catch (erro) {
      console.error("❌ [PRELOAD] Erro ao listar arquivos de notas:", erro.message);
      return [];
    }
  },

  // ---- Revista
  obterCaminhoCapaRevista: () => ipcRenderer.invoke("revista:obter-caminho-capa"),

  // ---- Temas (NOVO fluxo robusto)
  /**
   * Lista temas salvos para um emailHash.
   * Retorno esperado do MAIN:
   * { ok, dir, itens: [{nome, caminho, tamanho, mtime, ctime}] }
   * (Mas aceitamos array simples de nomes para compat.)
   */
  listarTemasSalvos: (emailHash) => ipcRenderer.invoke("listar-temas-salvos", emailHash),

  /**
   * Salvar tema criptografado via MAIN.
   * @param {string} emailHash
   * @param {string} nomeArquivo
   * @param {{data,numero,titulo,texto}} dados
   */
  salvarTema: (emailHash, nomeArquivo, dados) => ipcRenderer.invoke("salvar-tema", emailHash, nomeArquivo, dados),

  /**
   * Ler tema (descriptografado).
   * Uso preferencial: lerTema(caminhoAbsoluto)
   * Compat legado:   lerTema(emailHash, nomeArquivo)
   */
  lerTema: async (...args) => {
    try {
      if (args.length === 1) {
        const caminhoAbs = args[0];
        console.log("🛰️ [PRELOAD] lerTema(caminhoAbs) →", caminhoAbs);
        return await ipcRenderer.invoke("ler-tema", caminhoAbs);
      }
      if (args.length >= 2) {
        const [emailHash, nomeArquivo] = args;
        const caminho = path.join(getTemasDir(emailHash), nomeArquivo);
        console.log("🛰️ [PRELOAD] lerTema(emailHash,nomeArquivo) →", { caminho });
        return await ipcRenderer.invoke("ler-tema", caminho);
      }
      throw new Error("Parâmetros inválidos para lerTema.");
    } catch (e) {
      console.error("❌ [PRELOAD] Falha em lerTema:", e.message);
      throw e;
    }
  },

  // ---- Utilidades
  obterNomeUsuario: () => obterNomeUsuarioPlano(),
  obterNomeAlunoDescriptografado: () => obterNomeAlunoDescriptografadoInterno(),
  obterEmailHash: () => obterEmailHashInterno(),
  obterDiretorioTemas: (emailHash) => getTemasDir(emailHash || obterEmailHashInterno()),

  // ---- UI utilitária
  exibirAviso: (msg) => ipcRenderer.invoke("exibir-aviso", msg),
  abrirJanelaTermo: () => ipcRenderer.invoke("abrir-janela-termo"),
  ouvirTermoAceito: (callback) => {
    if (typeof callback === "function") {
      callbackTermoAceito = callback;
      console.log("👂 [PRELOAD] Callback termo-aceito registrado.");
    } else {
      console.warn("⚠️ [PRELOAD] Callback inválido passado para ouvirTermoAceito.");
    }
  },

  // ---- FS utilitário controlado
  salvarArquivo: async (caminho, conteudo) => {
    try {
      await fs.writeFile(caminho, conteudo, "utf-8");
      console.log("💾 [PRELOAD] Arquivo salvo:", caminho);
      return { sucesso: true };
    } catch (erro) {
      console.error("❌ [PRELOAD] Erro ao salvar arquivo:", erro.message);
      return { sucesso: false, erro: erro.message };
    }
  },

  // ---- Caminho do usuário (mantido para compat)
  getUserConfigPath: () => getUserConfigPath(),
});

console.log("🧪 [PRELOAD] pronto. APIs expostas.");
