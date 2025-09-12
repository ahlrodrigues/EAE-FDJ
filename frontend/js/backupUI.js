// ============================================================================
// Caminho: frontend/js/backupUI.js
// Objetivo: UI do fluxo de conexão Google Drive via Device Code
// Mudanças:
//  - Copiar código (#authCode) em TODOS os cliques (não só no primeiro)
//  - Vínculo de ouvintes idempotente (evita handlers duplicados)
//  - Link de verificação sempre abre no navegador externo
// Logs padronizados: 🧭/📡/✅/⚠️/❌
// ============================================================================

console.log("🧭 [backupUI] carregado");

// ----------------------------
// Referências de elementos
// ----------------------------
const btnConectar = document.getElementById("btnConectarGoogle");
const oauthRow = document.getElementById("oauth-row");
const oauthStatus = document.getElementById("oauth-status");
const authCard = document.getElementById("authCodeCard");
const authUrl = document.getElementById("authUrl");
const authCode = document.getElementById("authCode");
const copiedHint = document.getElementById("copiedHint");
const authStatus = document.getElementById("authStatus");

// ----------------------------
// Estado interno
// ----------------------------
let statusListenerBound = false;

// ----------------------------
// Util: Atualizar status visual
// ----------------------------
function setStatus(tipo, texto) {
  if (!oauthStatus) return;
  const classe =
    tipo === "conectado" ? "bolinha-conectado"
    : tipo === "pendente" ? "bolinha-pendente"
    : tipo === "erro" ? "bolinha-erro"
    : "bolinha-desconectado";

  oauthStatus.innerHTML = `
    <span class="bolinha ${classe}" aria-hidden="true"></span>
    <strong>Status:</strong> ${texto}
  `;
}

// ----------------------------
// Modal sucesso (usa modalAviso quando disponível)
// ----------------------------
function abrirModalSucessoOAuth() {
  const titulo = "Conectado ao Google Drive";
  const mensagem = "Tudo certo! Você já pode configurar e executar os backups.";

  console.log("✅ [backupUI] Exibindo modal de sucesso…");
  try {
    if (typeof window.abrirModalAviso === "function") {
      window.abrirModalAviso({ titulo, mensagem, tipo: "sucesso", icone: "✅", autoFecharMs: 3500 });
      return;
    }
    if (window.modalAviso?.abrir) {
      window.modalAviso.abrir({ titulo, mensagem, tipo: "sucesso", icone: "✅", autoFecharMs: 3500 });
      return;
    }
  } catch (e) {
    console.warn("⚠️ [backupUI] Falha ao abrir modal customizado:", e?.message || e);
  }
  alert("✅ " + titulo + "\n\n" + mensagem);
}

// ----------------------------
// Compat: APIs disponíveis no preload
// ----------------------------
const hasNewAPI = !!window.api?.backup;

const iniciarConexaoGoogle = async () => {
  if (hasNewAPI) {
    console.log("🧩 [backupUI] Usando API nova window.api.backup.iniciarConexaoGoogle()");
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
    console.log("🧩 [backupUI] Usando API antiga window.api.conectarGoogle()");
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
    console.log("🧩 [backupUI] Iniciando polling pela API nova…");
    await window.api.backup.iniciarPollingToken(device_code, interval);
  } else {
    console.log("🧩 [backupUI] API antiga: polling é gerenciado no main/handler.");
  }
};

const registrarListenerStatus = () => {
  if (statusListenerBound) return; // evita múltiplos binds
  statusListenerBound = true;

  if (hasNewAPI && typeof window.api.backup.onAtualizacaoStatus === "function") {
    console.log("🧩 [backupUI] Registrando listener de status (API nova) …");
    window.api.backup.onAtualizacaoStatus(onStatusPayload);
  } else if (typeof window.api?.ouvirDriveStatus === "function") {
    console.log("🧩 [backupUI] Registrando listener de status (API antiga) …");
    window.api.ouvirDriveStatus(onStatusPayloadCompat);
    if (typeof window.api?.pedirReplayDriveCodigo === "function") {
      window.api.pedirReplayDriveCodigo();
    }
  } else {
    console.warn("⚠️ [backupUI] Nenhuma API de status encontrada.");
  }
};

// ----------------------------
// Callbacks de status
// ----------------------------
function onStatusPayload(payload) {
  console.log("📡 [backupUI] Status (novo):", payload);
  if (!payload) return;

  if (payload.state === "authorized") {
    setStatus("conectado", "Conectado ao Google Drive");
    if (authStatus) authStatus.textContent = "Conexão autorizada com sucesso.";
    abrirModalSucessoOAuth();
    btnConectar && (btnConectar.disabled = false);
  } else if (payload.state === "pending") {
    setStatus("pendente", "Aguardando autorização…");
    if (authStatus) authStatus.textContent = "Aguardando autorização no Google…";
  } else if (payload.state === "expired") {
    setStatus("desconectado", "Desconectado (código expirou). Clique em Conectar novamente.");
    if (authStatus) authStatus.textContent = "Código expirou. Refaça o processo.";
    btnConectar && (btnConectar.disabled = false);
  } else if (payload.state === "error") {
    setStatus("erro", "Erro na conexão");
    if (authStatus) authStatus.textContent = `Erro: ${payload.message || "Falha na autorização."}`;
    btnConectar && (btnConectar.disabled = false);
  }
}

function onStatusPayloadCompat(payload) {
  console.log("📡 [backupUI] Status (antigo):", payload);
  if (!payload) return;

  if (payload.ok) {
    setStatus("conectado", "Conectado ao Google Drive");
    if (authStatus) authStatus.textContent = "Conexão autorizada com sucesso.";
    abrirModalSucessoOAuth();
    btnConectar && (btnConectar.disabled = false);
  } else if (payload.message) {
    if (/expirad/i.test(payload.message)) {
      setStatus("desconectado", "Desconectado (código expirou). Clique em Conectar novamente.");
      btnConectar && (btnConectar.disabled = false);
    } else {
      setStatus("pendente", "Aguardando autorização…");
    }
    if (authStatus) authStatus.textContent = `⚠️ ${payload.message}`;
  }
}

// ----------------------------
// Vínculo: abrir EXTERNO no link de verificação (sempre)
// ----------------------------
function bindExternalOpenOnLink(anchorEl) {
  if (!anchorEl) return;
  if (anchorEl._externalOpenBound) return; // evita binds duplicados
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
  anchorEl.addEventListener("click", handler); // funciona em todos os cliques
  anchorEl._externalOpenBound = true;
}

// ----------------------------
// Vínculo: copiar código em TODOS os cliques (idempotente)
// ----------------------------
function ensureCopyOnEveryClick(codeEl, hintEl) {
  if (!codeEl) return;
  if (codeEl._copyHandlerBound) return; // evita binds duplicados
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
  codeEl.addEventListener("click", handler); // <- sem { once: true }
  codeEl._copyHandlerBound = true;
}

// ----------------------------
// Clique em "Conectar Google"
// ----------------------------
btnConectar?.addEventListener("click", async () => {
  try {
    console.log("🧭 [backupUI] Clique em Conectar Google");
    btnConectar.disabled = true;
    setStatus("pendente", "Iniciando conexão…");

    // 1) Iniciar device flow (sem abrir navegador automaticamente)
    const resp = await iniciarConexaoGoogle();
    console.log("🔑 [backupUI] Device code response:", resp?._raw || resp);

    // 2) Exibir instruções e dados
    if (authUrl) {
      authUrl.href = resp.verification_uri || "https://www.google.com/device";
      bindExternalOpenOnLink(authUrl); // abre no navegador externo (todos os cliques)
    }
    if (authCode) {
      authCode.textContent = resp.user_code || "—";
      ensureCopyOnEveryClick(authCode, copiedHint); // <- cópia a cada clique
    }
    if (authCard) authCard.style.display = "block";

    // 3) Registrar listener de status (uma única vez)
    registrarListenerStatus();

    // 4) Iniciar polling (quando disponível)
    if (resp.device_code) {
      await iniciarPolling(resp.device_code, resp.interval || 5);
      console.log("⏱️ [backupUI] Polling solicitado ao backend.");
    } else {
      console.log("ℹ️ [backupUI] device_code ausente — polling deve estar no backend (API antiga).");
    }

    if (authStatus) authStatus.textContent = "Aguardando autorização no Google…";
    setStatus("pendente", "Aguardando autorização…");

  } catch (err) {
    console.error("❌ [backupUI] Erro no fluxo de conexão:", err);
    setStatus("erro", "Erro ao iniciar conexão");
    if (authStatus) authStatus.textContent = `Erro: ${err.message || String(err)}`;
    btnConectar && (btnConectar.disabled = false);
  }
});

// ----------------------------
// Estado inicial (garantia visual)
// ----------------------------
if (oauthRow && oauthRow.style.display !== "none") {
  setStatus("desconectado", "Desconectado");
}
