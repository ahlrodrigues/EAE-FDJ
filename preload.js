// ============================================================================
// Caminho: preload.js
// Exposição controlada de APIs para o renderer (NOVO MODELO).
// Ajustes aplicados:
//  • REMOVE dependência do legado ~/.config/escola-aprendizes/config/usuario.json
//  • Usa sessão ativa (IPC: session:emailHash) para obter o emailHash
//  • Gera emailHash = sha256(email.trim().toLowerCase()) — sem HMAC / APP_MASTER_KEY
//  • Evita logar dados sensíveis; mantém logs com prefixo e contexto
//  • Mantém APIs existentes, sem duplicidade; remove dotenv no preload
//  • Usa canais do Blog vindos do MAIN via process.env.BLOG_CHANNELS_JSON
// ============================================================================

const { contextBridge, ipcRenderer } = require("electron");
const fs = require("fs").promises;   // assíncrono
const fsSync = require("fs");        // uso pontual (controlado)
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const PRE = "🔌 [PRELOAD]";

function ensureFn(fn, nome) {
  if (typeof fn === "function") return true;
  console.warn(`${PRE} Callback inválido passado para ${nome}.`);
  return false;
}

console.log(`🧠 ${PRE} preload.js carregado`);

// ============================================================================
// 🔎 Canais do Blog (padronizados pelo MAIN)
// ============================================================================
let BLOG_CHANNELS = {};
try {
  BLOG_CHANNELS = JSON.parse(process.env.BLOG_CHANNELS_JSON || "{}");
} catch {
  BLOG_CHANNELS = {};
}
const BLOG_FETCH_LAST = BLOG_CHANNELS?.FETCH_LAST || "blog:buscarUltimaPublicacao";
const BLOG_PING       = BLOG_CHANNELS?.PING       || "blog:debugPing";

console.log(`${PRE} Blog channels:`, { BLOG_FETCH_LAST, BLOG_PING });

// ============================================================================
// 🔧 Helpers locais (NÃO expostos diretamente)
// ============================================================================
const CONFIG_BASE = path.join(os.homedir(), ".config", "escola-aprendizes", "config");
const NOTAS_BASE  = path.join(os.homedir(), ".config", "escola-aprendizes", "notas");
const TEMAS_BASE  = path.join(os.homedir(), ".config", "escola-aprendizes", "temas");

function configBaseDir() { return CONFIG_BASE; }
function notasDir(emailHash) { return path.join(NOTAS_BASE, String(emailHash || "").trim()); }
function temasDir(emailHash) { return path.join(TEMAS_BASE, String(emailHash || "").trim()); }

// sha256 puro (alinhado ao backend)
function gerarEmailHashSha256(email) {
  const norm = String(email || "").trim().toLowerCase();
  if (!norm.includes("@")) return null;
  return crypto.createHash("sha256").update(norm, "utf8").digest("hex");
}

// Caminho do arquivo do usuário logado (precisa do emailHash da sessão)
async function getUserFilePath() {
  const hash = await ipcRenderer.invoke("session:emailHash");
  if (!hash) {
    console.warn(`${PRE} getUserFilePath: emailHash ausente na sessão`);
    return null;
  }
  return path.join(configBaseDir(), "usuarios", `${hash}.json`);
}

// ============================================================================
// 🌐 Evento 'termo-aceito' vindo do MAIN
// ============================================================================
let callbackTermoAceito = null;
ipcRenderer.removeAllListeners("termo-aceito");
ipcRenderer.on("termo-aceito", () => {
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
// 🧭 Logs auxiliares dos eventos de Drive (bind único)
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
//   (atenção: expor fs/path/os aumenta superfície; mantenha apenas o necessário)
// ============================================================================
contextBridge.exposeInMainWorld("nativo", {
  fs, path, os,
  getEnv: (chave) => process.env[chave] || null,
  gerarEmailHash: (email) => gerarEmailHashSha256(email),

  criptografarComMestra: async (texto) => {
    try {
      return await ipcRenderer.invoke("criptografar-com-mestra", texto);
    } catch (e) {
      console.error(`${PRE} Falha ao criptografar via IPC:`, e.message);
      throw e;
    }
  },

  arquivoExiste: async (caminhoRelativo) => {
    const completo = path.join(configBaseDir(), caminhoRelativo);
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
// 👤 APIs de USUÁRIO (NOVO MODELO)
//   -> Sem usuario.json legado. Baseadas em IPC e arquivo por usuário.
//   -> Handlers esperados no MAIN: 'usuario:ler' e 'usuario:obterNomeAluno'.
// ============================================================================
async function _getSessionEmailHash() {
  const h = await ipcRenderer.invoke("session:emailHash");
  if (!h) console.warn(`${PRE} sessão sem emailHash`);
  return h;
}

contextBridge.exposeInMainWorld("usuarioAPI", {
  /** Ler cadastro do usuário da sessão atual */
  async lerAtual() {
    const emailHash = await _getSessionEmailHash();
    if (!emailHash) return { ok: false, erro: "Sessão sem emailHash" };
    return ipcRenderer.invoke("usuario:ler", emailHash);
  },

  /** Ler cadastro por emailHash específico */
  async lerPorHash(emailHash) {
    return ipcRenderer.invoke("usuario:ler", emailHash);
  },

  /** Obter nome do aluno descriptografado (sessão atual) */
  async obterNomeAlunoAtual() {
    const emailHash = await _getSessionEmailHash();
    if (!emailHash) return { ok: false, erro: "Sessão sem emailHash" };
    return ipcRenderer.invoke("usuario:obterNomeAluno", emailHash);
  },

  /** Caminho absoluto do JSON do usuário atual (novo modelo) */
  async getUserFilePath() {
    return getUserFilePath();
  },
});

// ============================================================================
// 🧾 API principal (window.api) — Mantida e atualizada p/ novo modelo
// ============================================================================
contextBridge.exposeInMainWorld("api", {
  // ---- Autenticação / sessão / cadastro
  validarLogin: (email, senha) => ipcRenderer.invoke("validar-login", email, senha),
  definirSessao: (emailHash) => ipcRenderer.send("sessao-definir", emailHash),
  salvarCadastro: (dados) => ipcRenderer.invoke("salvar-cadastro", dados),
  verificarEmailExistente: (email) => ipcRenderer.invoke("verificar-email-existente", email),

  // ---- Recuperação de senha (token + troca)
  solicitarToken: (email) => ipcRenderer.invoke("solicitar-token", email),
  redefinirSenha: (email, token, novaSenha) => ipcRenderer.invoke("redefinir-senha", email, token, novaSenha),

  // ---- Conteúdo/Blog (canais lidos do MAIN)
  buscarUltimaPublicacao: async () => {
    try {
      return await ipcRenderer.invoke(BLOG_FETCH_LAST);
    } catch (e) {
      console.warn("📰[PRELOAD] buscarUltimaPublicacao indisponível:", e?.message || e);
      return { ok: false, erro: e?.message || String(e) };
    }
  },

  // 🔎 Diagnóstico do feed (para DevTools do renderer)
  blogDebugPing: async () => {
    try {
      return await ipcRenderer.invoke(BLOG_PING);
    } catch (e) {
      console.warn("📰[PRELOAD] blogDebugPing falhou:", e?.message || e);
      return { ok: false, erro: e?.message || String(e) };
    }
  },

  // ---- Usuário (novo modelo)
  /** Lê o usuário da sessão atual (wrapper p/ novo IPC) */
  lerUsuario: async () => {
    const emailHash = await _getSessionEmailHash();
    if (!emailHash) return { ok: false, erro: "Sessão sem emailHash" };
    return ipcRenderer.invoke("usuario:ler", emailHash);
  },

  /** Salvar dados do usuário (mantém seu IPC existente no MAIN) */
  salvarUsuario: (dados) => ipcRenderer.invoke("salvar-usuario", dados),

  // ==== Troca de e-mail (novo fluxo) ====
  emailChange: {
    iniciarTroca: (novoEmail, senhaAtual) => ipcRenderer.invoke("email:iniciar-troca", novoEmail, senhaAtual),
    confirmarTroca: (token) => ipcRenderer.invoke("email:confirmar-troca", token),
  },

  // ---- Criptografia (sempre via MAIN)
  descriptografarComMestra: async (texto) => {
    try {
      return await ipcRenderer.invoke("descriptografar-com-mestra", texto);
    } catch (e) {
      console.error(`${PRE} Falha ao descriptografar via IPC:`, e);
      throw e;
    }
  },

  // ---- Drive/Backup (fluxo novo + compat)
  backup: {
    carregarConfiguracao: () => ipcRenderer.invoke("backup:carregar-config"),
    salvarConfiguracao: (cfg) => ipcRenderer.invoke("backup:salvar-config", cfg),
    testarConexao: (alvo) => ipcRenderer.invoke("backup:testar-conexao", alvo),
    executarAgora: () => ipcRenderer.invoke("backup:executar-agora"),
    desconectar: () => ipcRenderer.invoke("backup:desconectar"),

    // ===== Fluxo Device Code (sem abrir navegador automaticamente) =====
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
              interval: Number(payload?.interval || 5) || 5,
              _event: payload,
            });
          } catch (e) { reject(e); }
        };

        ipcRenderer.once("drive:codigo", onceCodigo);

        try {
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

    iniciarPollingToken: async (device_code, interval) => {
      console.log(`${PRE} backup.iniciarPollingToken (no-op): polling é interno à lib OAuth`, {
        hasDeviceCode: !!device_code,
        interval,
      });
      return { ok: true, message: "Polling conduzido no backend" };
    },

    onAtualizacaoStatus: (cb) => {
      if (!ensureFn(cb, "backup.onAtualizacaoStatus")) return;
      ipcRenderer.removeAllListeners("drive:codigo:status");
      ipcRenderer.on("drive:codigo:status", (_e, payload) => {
        if (payload && typeof payload.ok === "boolean") {
          if (payload.ok) return cb({ state: "authorized", message: payload.message || "Conexão autorizada." });
          const msg = String(payload.message || "").toLowerCase();
          if (msg.includes("expirad")) return cb({ state: "expired", message: payload.message });
          return cb({ state: "error", message: payload.message || "Falha na autorização." });
        }
        cb(payload);
      });
    },
  },

  // ==== Compat APIs antigas de Drive (mantidas, não duplicadas) ====
  conectarGoogle: async () => {
    try {
      console.log(`${PRE} conectarGoogle → backup:iniciar-oauth (google-drive)`);
      const resp = await ipcRenderer.invoke("backup:iniciar-oauth", "google-drive");
      if (!resp?.ok) console.warn(`${PRE} iniciar-oauth respondeu erro:`, resp?.error || resp?.erro);
      return resp;
    } catch (e) {
      console.error(`${PRE} invoke backup:iniciar-oauth falhou:`, e?.message || e);
      return { ok: false, error: e?.message || String(e) };
    }
  },

  testarConexaoGoogle: async () => {
    try {
      console.log(`${PRE} testarConexaoGoogle → backup:testar-conexao (google-drive)`);
      return await ipcRenderer.invoke("backup:testar-conexao", "google-drive");
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
    _bindDriveLogListenersOnce();
    ipcRenderer.on("drive:codigo:status", (_e, payload) => cb(payload));
  },

  pedirReplayDriveCodigo: () => {
    console.log(`${PRE} pedirReplayDriveCodigo → drive:codigo:request`);
    ipcRenderer.send("drive:codigo:request");
  },

  abrirLink: (url) => {
    if (!url) return;
    console.log(`${PRE} abrirLink`, url);
    ipcRenderer.send("abrirLink", url);
  },

  removerOuvintesDrive: () => {
    console.log(`${PRE} removerOuvintesDrive`);
    ipcRenderer.removeAllListeners("drive:codigo");
    ipcRenderer.removeAllListeners("drive:codigo:status");
    _driveListenersBound = false;
  },

  enviarCodePorEmail: async (email) => {
    console.log(`${PRE} enviarCodePorEmail →`, email);
    try {
      return await ipcRenderer.invoke("backup:enviar-code-email", email || "");
    } catch (e) {
      return { ok: false, error: e?.message || String(e) };
    }
  },

  // ---- Utilidades
  obterNomeUsuario: async () => {
    const r = await ipcRenderer.invoke("usuario:obterNomeAluno", await _getSessionEmailHash());
    return r?.ok ? (r.nome || null) : null;
  },

  obterNomeAlunoDescriptografado: async () => {
    const r = await ipcRenderer.invoke("usuario:obterNomeAluno", await _getSessionEmailHash());
    return r?.ok ? (r.nome || null) : null;
  },

  // ⚠️ Agora assíncrono: pega hash da sessão no MAIN (sem usuario.json legado)
  obterEmailHash: async () => _getSessionEmailHash(),

  // Caminho do arquivo do usuário atual (novo modelo)
  getUserFilePath: () => getUserFilePath(),

  // ---- UI utilitária
  exibirAviso: (msg) => ipcRenderer.invoke("exibir-aviso", msg),
  abrirJanelaTermo: () => ipcRenderer.invoke("abrir-janela-termo"),
  ouvirTermoAceito: (callback) => {
    if (ensureFn(callback, "ouvirTermoAceito")) {
      callbackTermoAceito = callback;
      console.log(`${PRE} Callback termo-aceito registrado.`);
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

  obterCaminhoCapaRevista: async () => {
    try {
      return await ipcRenderer.invoke("revista:obterCaminhoCapa");
    } catch (e) {
      console.warn("📖[PRELOAD][REVISTA] obterCaminhoCapaRevista falhou:", e?.message || e);
      return null;
    }
  },

  /** Debug opcional para inspecionar pasta/arquivos da revista */
  revistaDebugPing: async () => {
    try {
      return await ipcRenderer.invoke("revista:debugPing");
    } catch (e) {
      return { ok: false, erro: e?.message || String(e) };
    }
  },
});

console.log(`🧪 ${PRE} pronto. APIs expostas.`);
