// ============================================================================
// Caminho: preload.js
// Exposição controlada de APIs para o renderer.
// Mantém o preload enxuto, seguro e com logs consistentes.
// ============================================================================

// ----------------------------------------------------------------------------
// 📦 Imports
// ----------------------------------------------------------------------------
const { contextBridge, ipcRenderer } = require("electron");
const fs = require("fs").promises;          // assíncrono (promises)
const fsSync = require("fs");               // síncrono (uso pontual)
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const dotenv = require("dotenv");

// ----------------------------------------------------------------------------
dotenv.config();

// ----------------------------------------------------------------------------
const APP_MASTER_KEY = process.env.APP_MASTER_KEY;
const PRE = "🔌 [PRELOAD]";

/** Garante que um callback seja função antes de registrar ouvintes. */
function ensureFn(fn, nome) {
  if (typeof fn === "function") return true;
  console.warn(`${PRE} Callback inválido passado para ${nome}.`);
  return false;
}

console.log(`🔐 ${PRE} APP_MASTER_KEY definido?`, Boolean(APP_MASTER_KEY));
console.log(`🧠 ${PRE} preload.js carregado`);

// ============================================================================
// 🔧 Helpers locais (NÃO expostos diretamente)
// ============================================================================
function obterPrimeiroUsuario(dados) {
  const chaves = Object.keys(dados?.usuarios || {});
  return dados?.usuarios?.[chaves[0]] || null;
}
function getUserConfigPath() {
  return path.join(os.homedir(), ".config", "escola-aprendizes", "config", "usuario.json");
}
function obterEmailHashInterno() {
  try {
    const raw = fsSync.readFileSync(getUserConfigPath(), "utf-8");
    const dados = JSON.parse(raw);
    const chaves = Object.keys(dados.usuarios || {});
    const emailHash = chaves[0] || null;
    if (!emailHash) console.warn(`${PRE} emailHash não encontrado no usuario.json.`);
    return emailHash;
  } catch (erro) {
    console.error(`${PRE} Erro ao obter emailHash:`, erro.message);
    return null;
  }
}
function getTemasDir(emailHash) {
  const hash = String(emailHash || "").trim();
  return path.join(os.homedir(), ".config", "escola-aprendizes", "temas", hash);
}
function gerarEmailHashInterno(email) {
  try {
    return crypto.createHmac("sha256", APP_MASTER_KEY || "").update(email || "").digest("hex");
  } catch (e) {
    console.error(`${PRE} Falha ao gerar emailHash:`, e.message);
    return null;
  }
}

// ============================================================================
// 🌐 Canal termo-aceito (evento assíncrono vindo do main)
// ============================================================================
let callbackTermoAceito = null;
ipcRenderer.removeAllListeners("termo-aceito");
ipcRenderer.on("termo-aceito", (_evento, _dados) => {
  console.log(`📥 ${PRE} Evento 'termo-aceito' recebido`);
  if (typeof callbackTermoAceito === "function") {
    try {
      console.log(`${PRE} Executando callback para 'termo-aceito'`);
      callbackTermoAceito();
    } catch (e) {
      console.error(`${PRE} Erro no callback de 'termo-aceito':`, e.message);
    }
  } else {
    console.warn(`${PRE} Nenhum callback registrado para 'termo-aceito'.`);
  }
});

// ============================================================================
// 🧭 Logs auxiliares dos eventos de Drive (debug único)
// ============================================================================
let _driveListenersBound = false;
function _bindDriveLogListenersOnce() {
  if (_driveListenersBound) return;
  ipcRenderer.on("drive:codigo", (_e, payload) => {
    console.log(`${PRE} drive:codigo`, payload);
  });
  ipcRenderer.on("drive:codigo:status", (_e, payload) => {
    console.log(`${PRE} drive:codigo:status`, payload);
  });
  _driveListenersBound = true;
}

// ============================================================================
// 🧭 Expor alguns módulos nativos de forma limitada
// ============================================================================
contextBridge.exposeInMainWorld("nativo", {
  fs, path, os,
  getEnv: (chave) => process.env[chave] || null,
  gerarEmailHash: (email) => gerarEmailHashInterno(email),

  criptografarComMestra: async (texto) => {
    try {
      const res = await ipcRenderer.invoke("criptografar-com-mestra", texto);
      return res;
    } catch (e) {
      console.error(`${PRE} Falha ao criptografar via IPC:`, e.message);
      throw e;
    }
  },

  arquivoExiste: async (caminhoRelativo) => {
    const completo = path.join(os.homedir(), ".config", "escola-aprendizes", "config", caminhoRelativo);
    try {
      await fs.access(completo);
      console.log(`✅ ${PRE} Arquivo existe:`, completo);
      return true;
    } catch {
      console.warn(`❌ ${PRE} Arquivo não existe:`, completo);
      return false;
    }
  },
});

// ============================================================================
// 🧾 Utilidades de usuário exibidas via API
// ============================================================================
function obterNomeUsuarioPlano() {
  try {
    const raw = fsSync.readFileSync(getUserConfigPath(), "utf-8");
    const dados = JSON.parse(raw);
    const usuario = obterPrimeiroUsuario(dados);
    const nome = usuario?.aluno || "usuario";
    return String(nome).replace(/\s+/g, "_");
  } catch (e) {
    console.warn(`${PRE} Não foi possível obter nome do usuário:`, e.message);
    return null;
  }
}
async function obterNomeAlunoDescriptografadoInterno() {
  try {
    const raw = fsSync.readFileSync(getUserConfigPath(), "utf-8");
    const dados = JSON.parse(raw);
    const usuario = obterPrimeiroUsuario(dados);

    if (!usuario?.aluno) {
      console.warn(`${PRE} Campo 'aluno' não encontrado no usuario.json.`);
      return null;
    }

    const descriptografado = await ipcRenderer.invoke("descriptografar-com-mestra", usuario.aluno);
    console.log(`✅ ${PRE} Nome do aluno descriptografado (tamanho):`, descriptografado?.length || 0);
    return descriptografado || null;
  } catch (erro) {
    console.error(`${PRE} Erro ao obter nome do aluno:`, erro.message);
    return null;
  }
}

// ============================================================================
// 🧩 API principal exposta para o renderer (window.api)
//   - Compat com API antiga de Drive (drive:codigo / drive:codigo:status)
//   - API de backup com Device Code (sem abrir navegador automaticamente)
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
  descriptografarComMestra: async (texto) => {
    try {
      return await ipcRenderer.invoke("descriptografar-com-mestra", texto);
    } catch (e) {
      console.error(`${PRE} Falha ao descriptografar via IPC:`, e);
      throw e;
    }
  },

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
      console.log(`📂 ${PRE} Caminhos absolutos das anotações:`, caminhos.length);
      return caminhos;
    } catch (erro) {
      console.error(`${PRE} Erro ao listar arquivos de notas:`, erro.message);
      return [];
    }
  },

  // ---- Revista
  obterCaminhoCapaRevista: () => ipcRenderer.invoke("revista:obter-caminho-capa"),

  // ---- Temas
  listarTemasSalvos: (emailHash) => ipcRenderer.invoke("listar-temas-salvos", emailHash),
  salvarTema: (emailHash, nomeArquivo, dados) => ipcRenderer.invoke("salvar-tema", emailHash, nomeArquivo, dados),
  lerTema: async (...args) => {
    try {
      if (args.length === 1) {
        const caminhoAbs = args[0];
        console.log(`${PRE} lerTema(caminhoAbs) →`, caminhoAbs);
        return await ipcRenderer.invoke("ler-tema", caminhoAbs);
      }
      if (args.length >= 2) {
        const [emailHash, nomeArquivo] = args;
        const caminho = path.join(getTemasDir(emailHash), nomeArquivo);
        console.log(`${PRE} lerTema(emailHash,nomeArquivo) →`, { caminho });
        return await ipcRenderer.invoke("ler-tema", caminho);
      }
      throw new Error("Parâmetros inválidos para lerTema.");
    } catch (e) {
      console.error(`${PRE} Falha em lerTema:`, e.message);
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
      console.log(`${PRE} Callback termo-aceito registrado.`);
    } else {
      console.warn(`${PRE} Callback inválido passado para ouvirTermoAceito.`);
    }
  },

  // ---- FS utilitário controlado
  salvarArquivo: async (caminho, conteudo) => {
    try {
      await fs.writeFile(caminho, conteudo, "utf-8");
      console.log(`💾 ${PRE} Arquivo salvo:`, caminho);
      return { sucesso: true };
    } catch (erro) {
      console.error(`❌ ${PRE} Erro ao salvar arquivo:`, erro.message);
      return { sucesso: false, erro: erro.message };
    }
  },

  // ---- Caminho do usuário (mantido para compat)
  getUserConfigPath: () => getUserConfigPath(),

  // ---- Bloqueio por inatividade
  bloquearApp: () => ipcRenderer.send("bloquear-app"),

  // ========================================================================
  // 🔁 Backup – API principal
  // ========================================================================
  backup: {
    carregarConfiguracao: () => ipcRenderer.invoke("backup:carregar-config"),
    salvarConfiguracao: (cfg) => ipcRenderer.invoke("backup:salvar-config", cfg),
    testarConexao: (alvo) => ipcRenderer.invoke("backup:testar-conexao", alvo),
    executarAgora: () => ipcRenderer.invoke("backup:executar-agora"),
    desconectar: () => ipcRenderer.invoke("backup:desconectar"),

    // ===== Fluxo Device Code (sem abrir navegador automaticamente) =====
    /**
     * Inicia o Device Flow e resolve COM os dados de UI (url/código) quando
     * o backend emitir 'drive:codigo'. Se o backend não retornar ok, rejeita.
     */
    iniciarConexaoGoogle: () => {
      console.log(`${PRE} backup.iniciarConexaoGoogle → startDeviceAuth (aguardando drive:codigo)…`);
      _bindDriveLogListenersOnce();

      return new Promise(async (resolve, reject) => {
        const onceCodigo = (_evt, payload) => {
          try {
            console.log(`${PRE} [Device] drive:codigo recebido`, payload);
            resolve({
              verification_uri: payload?.url || "https://www.google.com/device",
              user_code: payload?.code || "—",
              // device_code não é enviado ao renderer por padrão; polling é interno
              interval: Number(payload?.interval || 5) || 5,
              _event: payload,
            });
          } catch (e) {
            reject(e);
          }
        };

        ipcRenderer.once("drive:codigo", onceCodigo);

        try {
          // Alias compat já implementado no backend; inicia o flow (lib emite eventos)
          const resp = await ipcRenderer.invoke("backup:google:startDeviceAuth");
          if (resp?.ok === false) {
            ipcRenderer.removeListener("drive:codigo", onceCodigo);
            return reject(new Error(resp?.erro || "Falha ao iniciar OAuth"));
          }
        } catch (e) {
          ipcRenderer.removeListener("drive:codigo", onceCodigo);
          reject(e);
        }
      });
    },

    /**
     * No nosso backend o polling é conduzido pela lib OAuth.
     * Mantemos a função por compat, com log claro.
     */
    iniciarPollingToken: async (device_code, interval) => {
      console.log(`${PRE} backup.iniciarPollingToken (no-op): polling é interno à lib OAuth`, {
        hasDeviceCode: !!device_code,
        interval,
      });
      return { ok: true, message: "Polling conduzido no backend" };
    },

    /**
     * Listener de status unificado:
     * Mapeia 'drive:codigo:status' → estados ('authorized' | 'pending' | 'expired' | 'error').
     */
    onAtualizacaoStatus: (cb) => {
      if (!ensureFn(cb, "backup.onAtualizacaoStatus")) return;
      ipcRenderer.removeAllListeners("drive:codigo:status");
      ipcRenderer.on("drive:codigo:status", (_e, payload) => {
        // Compat: se vier { ok:true/false, message }
        if (payload && typeof payload.ok === "boolean") {
          if (payload.ok) {
            return cb({ state: "authorized", message: payload.message || "Conexão autorizada." });
          }
          const msg = String(payload.message || "").toLowerCase();
          if (msg.includes("expirad")) {
            return cb({ state: "expired", message: payload.message });
          }
          // Sem sinal claro de expiração → erro genérico
          return cb({ state: "error", message: payload.message || "Falha na autorização." });
        }
        // Já normalizado? repassa
        cb(payload);
      });
    },
  },

  // ========================================================================
  // 🔁 Google Drive OAuth – API antiga (retrocompat)
  // ========================================================================
  conectarGoogle: async () => {
    try {
      console.log(`${PRE} conectarGoogle → backup:iniciar-oauth (google-drive)`);
      const resp = await ipcRenderer.invoke("backup:iniciar-oauth", "google-drive");
      if (!resp?.ok) {
        console.warn(`${PRE} iniciar-oauth respondeu erro:`, resp?.error || resp?.erro);
      }
      return resp;
    } catch (e) {
      console.error(`${PRE} invoke backup:iniciar-oauth falhou:`, e?.message || e);
      return { ok: false, error: e?.message || String(e) };
    }
  },

  testarConexaoGoogle: async () => {
    try {
      console.log(`${PRE} testarConexaoGoogle → backup:testar-conexao (google-drive)`);
      const resp = await ipcRenderer.invoke("backup:testar-conexao", "google-drive");
      return resp; // { ok, user } | { ok:false, erro }
    } catch (e) {
      console.error(`${PRE} invoke backup:testar-conexao falhou:`, e?.message || e);
      return { ok: false, error: e?.message || String(e) };
    }
  },

  ouvirDriveCodigo: (cb) => {
    if (!ensureFn(cb, "ouvirDriveCodigo")) return;
    _bindDriveLogListenersOnce();
    ipcRenderer.on("drive:codigo", (_e, payload) => cb(payload));
  },
  ouvirDriveStatus: (cb) => {
    if (!ensureFn(cb, "ouvirDriveStatus")) return;
    ipcRenderer.on("drive:codigo:status", (_e, payload) => cb(payload));
  },

  // 🔁 Replay do cartão (quando a UI montar depois do evento)
  pedirReplayDriveCodigo: () => {
    console.log(`${PRE} pedirReplayDriveCodigo → drive:codigo:request`);
    ipcRenderer.send("drive:codigo:request");
  },

  // Abrir link no navegador padrão (Main → shell.openExternal)
  abrirLink: (url) => {
    if (!url) return;
    console.log(`${PRE} abrirLink`, url);
    ipcRenderer.send("abrirLink", url);
  },

  // Helpers para limpar ouvintes ao desmontar telas (evita vazamento de listeners)
  removerOuvintesDrive: () => {
    console.log(`${PRE} removerOuvintesDrive`);
    ipcRenderer.removeAllListeners("drive:codigo");
    ipcRenderer.removeAllListeners("drive:codigo:status");
    _driveListenersBound = false;
  },

  // (opcional) enviar code por e-mail (se existir no main)
  enviarCodePorEmail: async (email) => {
    console.log(`${PRE} enviarCodePorEmail →`, email);
    try {
      return await ipcRenderer.invoke("backup:enviar-code-email", email || "");
    } catch (e) {
      return { ok: false, error: e?.message || String(e) };
    }
  },
});

console.log(`🧪 ${PRE} pronto. APIs expostas.`);
