// ============================================================================
// Caminho: frontend/js/backupUI.js
// Objetivo: UI do fluxo de conexão Google Drive via Device Code
// Alterações principais:
//  - Usa APENAS o botão #btnConectarGoogle, alternando rótulo e ação:
//      "Conectar no Google" / "Reconectar" / "Desconectar"
//  - Remove criação de botão extra; não há "Desconectar" na área de ações
//  - Modal de sucesso usa o modal padrão (sem alert)
//  - Cópia do código em todos os cliques; link abre no navegador externo
//  - Estado persistente ao entrar na página (testa token e ajusta botão)
// Logs: 🧭/📡/✅/⚠️/❌
// ============================================================================

console.log("🧭 [backupUI] carregado");

// ----------------------------
// Referências de elementos
// ----------------------------
const oauthRow   = document.getElementById("oauth-row");
const btnConectar = document.getElementById("btnConectarGoogle");
const oauthStatus = document.getElementById("oauth-status");
const authCard    = document.getElementById("authCodeCard");
const authUrl     = document.getElementById("authUrl");
const authCode    = document.getElementById("authCode");
const copiedHint  = document.getElementById("copiedHint");
const authStatus  = document.getElementById("authStatus");

// ----------------------------
// Estado interno
// ----------------------------
let isConectado = false;
let statusListenerBound = false;

// ----------------------------
// Helpers visuais
// ----------------------------
function setStatus(tipo, texto) {
  if (!oauthStatus) return;
  const classe =
    tipo === "conectado" ? "bolinha-conectado" :
    tipo === "pendente"  ? "bolinha-pendente"  :
    tipo === "erro"      ? "bolinha-erro"      :
                           "bolinha-desconectado";
  oauthStatus.innerHTML = `
    <span class="bolinha ${classe}" aria-hidden="true"></span>
    <strong>Status:</strong> ${texto}
  `;
}

function mostrarInstrucoes(mostrar) {
  if (!authCard) return;
  authCard.style.display = mostrar ? "block" : "none";
}

// States: connect | reconnect | pending | disconnect
function setBotaoModo(modo) {
  if (!btnConectar) return;
  btnConectar.dataset.modo = modo;
  if (modo === "disconnect") {
    btnConectar.textContent = "Desconectar";
    btnConectar.disabled = false;
    return;
  }
  if (modo === "pending") {
    btnConectar.textContent = "Aguardando autorização…";
    btnConectar.disabled = true;
    return;
  }
  if (modo === "reconnect") {
    btnConectar.textContent = "Reconectar";
    btnConectar.disabled = false;
    return;
  }
  // default
  btnConectar.textContent = "Conectar no Google";
  btnConectar.disabled = false;
}

function abrirModalSucessoOAuth() {
  const titulo = "Conectado ao Google Drive";
  const mensagem = "O acesso ao Google Drive foi autorizado e está pronto para uso.";
  tentarAbrirModalPadrao({ titulo, mensagem, tipo: "sucesso", icone: "✅", autoFecharMs: 3500 });
}

function tentarAbrirModalPadrao(opts, tentativas = 20) {
  if (window.modalAviso?.abrir) { try { window.modalAviso.abrir(opts); return; } catch {}
  } else if (typeof window.abrirModalAviso === "function") { try { window.abrirModalAviso(opts); return; } catch {} }
  if (tentativas > 0) setTimeout(() => tentarAbrirModalPadrao(opts, tentativas - 1), 100);
  else console.warn("⚠️ [backupUI] Modal padrão indisponível; nenhum alert será exibido.");
}

// ----------------------------
// Compat: APIs do preload
// ----------------------------
const hasNewAPI = !!window.api?.backup;

const iniciarConexaoGoogle = async () => {
  if (hasNewAPI) {
    console.log("🧩 [backupUI] API nova iniciarConexaoGoogle()");
    const resp = await window.api.backup.iniciarConexaoGoogle();
    if (resp?.error) throw new Error(resp.error_description || "Falha ao iniciar Device Code.");
    return {
      verification_uri: resp.verification_uri || "https://www.google.com/device",
      user_code: resp.user_code || "—",
      device_code: resp.device_code,
      interval: resp.interval || 5,
      _raw: resp,
    };
  } else if (typeof window.api?.conectarGoogle === "function") {
    console.log("🧩 [backupUI] API antiga conectarGoogle()");
    const resp = await window.api.conectarGoogle(); // { ok, url, code, ... }
    if (!resp?.ok) throw new Error(resp?.error || "Falha ao iniciar conexão.");
    return {
      verification_uri: resp.url || "https://www.google.com/device",
      user_code: resp.code || "—",
      device_code: resp.device_code,
      interval: resp.interval || 5,
      _raw: resp,
    };
  }
  throw new Error("API de backup não disponível no preload.");
};

const iniciarPolling = async (device_code, interval) => {
  if (hasNewAPI && typeof window.api.backup.iniciarPollingToken === "function") {
    console.log("🧩 [backupUI] iniciarPollingToken (no-op no backend)"); 
    await window.api.backup.iniciarPollingToken(device_code, interval);
  }
};

function registrarListenerStatus() {
  if (statusListenerBound) return;
  statusListenerBound = true;

  if (hasNewAPI && typeof window.api.backup.onAtualizacaoStatus === "function") {
    console.log("🧩 [backupUI] Registrando listener (API nova)");
    window.api.backup.onAtualizacaoStatus(onStatusPayload);
  } else if (typeof window.api?.ouvirDriveStatus === "function") {
    console.log("🧩 [backupUI] Registrando listener (API antiga)");
    window.api.ouvirDriveStatus(onStatusPayloadCompat);
    if (typeof window.api?.pedirReplayDriveCodigo === "function") window.api.pedirReplayDriveCodigo();
  }
}

// ----------------------------
// Callbacks de status
// ----------------------------
function onStatusPayload(payload) {
  console.log("📡 [backupUI] Status (novo):", payload);
  if (!payload) return;

  if (payload.state === "authorized") {
    isConectado = true;
    setStatus("conectado", "Conectado ao Google Drive");
    if (authStatus) authStatus.textContent = "Conexão autorizada com sucesso.";
    mostrarInstrucoes(false);
    setBotaoModo("disconnect");   // ← vira Desconectar
    abrirModalSucessoOAuth();
  } else if (payload.state === "pending") {
    isConectado = false;
    setStatus("pendente", "Aguardando autorização…");
    if (authStatus) authStatus.textContent = "Aguardando autorização no Google…";
    setBotaoModo("pending");
  } else if (payload.state === "expired") {
    isConectado = false;
    setStatus("desconectado", "Desconectado (código expirou). Clique em Reconectar.");
    if (authStatus) authStatus.textContent = "Código expirou. Refaça o processo.";
    mostrarInstrucoes(false);
    setBotaoModo("reconnect");    // ← vira Reconectar
  } else if (payload.state === "error") {
    isConectado = false;
    setStatus("erro", "Erro na conexão");
    if (authStatus) authStatus.textContent = `Erro: ${payload.message || "Falha na autorização."}`;
    mostrarInstrucoes(false);
    setBotaoModo("reconnect");    // ← vira Reconectar
  }
}

function onStatusPayloadCompat(payload) {
  console.log("📡 [backupUI] Status (antigo):", payload);
  if (!payload) return;

  if (payload.ok) {
    isConectado = true;
    setStatus("conectado", "Conectado ao Google Drive");
    if (authStatus) authStatus.textContent = "Conexão autorizada com sucesso.";
    mostrarInstrucoes(false);
    setBotaoModo("disconnect");   // ← vira Desconectar
    abrirModalSucessoOAuth();
  } else if (payload.message) {
    isConectado = false;
    if (/expirad/i.test(payload.message)) {
      setStatus("desconectado", "Desconectado (código expirou). Clique em Reconectar.");
      if (authStatus) authStatus.textContent = payload.message;
      mostrarInstrucoes(false);
      setBotaoModo("reconnect");  // ← vira Reconectar
    } else {
      setStatus("pendente", "Aguardando autorização…");
      if (authStatus) authStatus.textContent = `⚠️ ${payload.message}`;
      setBotaoModo("pending");
    }
  }
}

// ----------------------------
// Vínculos auxiliares
// ----------------------------
function bindExternalOpenOnLink(anchorEl) {
  if (!anchorEl || anchorEl._externalOpenBound) return;
  const handler = (ev) => {
    try {
      ev.preventDefault();
      const href = anchorEl.getAttribute("href");
      if (!href) return;
      console.log("🌐 [backupUI] Abrindo no navegador padrão:", href);
      window.api?.abrirLink?.(href);
    } catch (e) {
      console.error("❌ [backupUI] Falha ao abrir link externamente:", e);
    }
  };
  anchorEl.addEventListener("click", handler);
  anchorEl._externalOpenBound = true;
}

function ensureCopyOnEveryClick(codeEl, hintEl) {
  if (!codeEl || codeEl._copyHandlerBound) return;
  const handler = async () => {
    const text = (codeEl.textContent || "").trim();
    if (!text || text === "—") return;
    try {
      await navigator.clipboard.writeText(text);
      if (hintEl) {
        hintEl.style.display = "inline";
        setTimeout(() => (hintEl.style.display = "none"), 1200);
      }
      console.log("✅ [backupUI] Código copiado:", text);
    } catch (e) {
      console.error("❌ [backupUI] Falha ao copiar:", e);
    }
  };
  codeEl.addEventListener("click", handler);
  codeEl._copyHandlerBound = true;
}

// ----------------------------
// Clique no botão único (Conectar/Reconectar/Desconectar)
// ----------------------------
btnConectar?.addEventListener("click", async () => {
  const modo = btnConectar?.dataset?.modo || "connect";

  if (modo === "disconnect") {
    // Desconectar
    try {
      console.log("🧭 [backupUI] Clique: Desconectar");
      const resp = await window.api?.backup?.desconectar?.();
      if (!resp?.ok) throw new Error(resp?.erro || "Falha ao desconectar.");
      isConectado = false;
      setStatus("desconectado", "Desconectado");
      if (authStatus) authStatus.textContent = "Conta Google desconectada.";
      setBotaoModo("connect");
      mostrarInstrucoes(false);
      tentarAbrirModalPadrao({
        titulo: "Desconectado do Google Drive",
        mensagem: resp?.message || "Você pode reconectar quando quiser.",
        tipo: "info",
        icone: "ℹ️",
        autoFecharMs: 2500,
      });
    } catch (e) {
      console.error("❌ [backupUI] Erro ao desconectar:", e);
      tentarAbrirModalPadrao({ titulo: "Erro ao desconectar", mensagem: e?.message || String(e), tipo: "erro", icone: "❌" });
    }
    return;
  }

  // Conectar/Reconectar
  try {
    console.log("🧭 [backupUI] Clique: Conectar/Reconectar");
    setBotaoModo("pending");
    setStatus("pendente", "Iniciando conexão…");

    const resp = await iniciarConexaoGoogle();
    console.log("🔑 [backupUI] Device code response:", resp?._raw || resp);

    if (authUrl) {
      authUrl.href = resp.verification_uri || "https://www.google.com/device";
      bindExternalOpenOnLink(authUrl);
    }
    if (authCode) {
      authCode.textContent = resp.user_code || "—";
      ensureCopyOnEveryClick(authCode, copiedHint);
    }
    mostrarInstrucoes(true);

    registrarListenerStatus();

    if (resp.device_code) {
      await iniciarPolling(resp.device_code, resp.interval || 5);
      console.log("⏱️ [backupUI] Polling solicitado ao backend.");
    } else {
      console.log("ℹ️ [backupUI] device_code ausente — polling é interno (API antiga).");
    }

    if (authStatus) authStatus.textContent = "Aguardando autorização no Google…";
    setStatus("pendente", "Aguardando autorização…");
  } catch (err) {
    console.error("❌ [backupUI] Erro ao iniciar conexão:", err);
    setStatus("erro", "Erro ao iniciar conexão");
    if (authStatus) authStatus.textContent = `Erro: ${err.message || String(err)}`;
    setBotaoModo("reconnect");
  }
});

// ----------------------------
// Estado inicial (persistência)
// ----------------------------
(async function initFromPersisted() {
  try {
    setStatus("desconectado", "Desconectado");
    setBotaoModo("connect");
    if (!window.api?.backup?.carregarConfiguracao) return;

    const cfg = await window.api.backup.carregarConfiguracao();
    const servGoogle = (cfg?.servico || "") === "google-drive";
    const temToken = !!cfg?.oauthTokenEnc;

    if (!servGoogle || !temToken) {
      mostrarInstrucoes(false);
      return;
    }

    let r = null;
    if (window.api?.testarConexaoGoogle) r = await window.api.testarConexaoGoogle();
    else if (window.api?.backup?.testarConexao) r = await window.api.backup.testarConexao("google-drive");

    if (r?.ok) {
      isConectado = true;
      setStatus("conectado", "Conectado ao Google Drive");
      if (authStatus) authStatus.textContent = "Conexão ativa.";
      setBotaoModo("disconnect");  // ← já entra como Desconectar
      mostrarInstrucoes(false);
    } else {
      isConectado = false;
      setStatus("desconectado", "Desconectado");
      setBotaoModo("connect");
      mostrarInstrucoes(false);
    }
  } catch (e) {
    console.warn("⚠️ [backupUI] Falha ao verificar persistência:", e?.message || e);
    setStatus("desconectado", "Desconectado");
    setBotaoModo("connect");
    mostrarInstrucoes(false);
  }
})();
