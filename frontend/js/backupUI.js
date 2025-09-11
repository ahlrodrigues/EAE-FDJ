console.log("🧭 [backupUI] carregado");

const btnConectar = document.getElementById("btnConectarGoogle");
const oauthStatus = document.getElementById("oauth-status");
const authCard = document.getElementById("authCodeCard");
const authUrl = document.getElementById("authUrl");
const authCode = document.getElementById("authCode");
const copiedHint = document.getElementById("copiedHint");
const authStatus = document.getElementById("authStatus");

// ———————————————————————————————————————————————————————————————
// Modal de sucesso (usa seu modalAviso.js se disponível; fallback = alert)
// ———————————————————————————————————————————————————————————————
function abrirModalSucessoOAuth() {
  const titulo = "Conta Google conectada com sucesso";
  const mensagem = "O acesso ao Google Drive foi autorizado e está pronto para uso.";
  console.log("🧭 [backupUI] Abrindo modal de sucesso…");

  try {
    // 1) API global comum (ex.: window.abrirModalAviso)
    if (typeof window.abrirModalAviso === "function") {
      window.abrirModalAviso({
        titulo,
        mensagem,
        tipo: "sucesso",
        icone: "✅",
        autoFecharMs: 3500,
      });
      return;
    }
    // 2) Namespace modalAviso (ex.: window.modalAviso.abrir)
    if (window.modalAviso && typeof window.modalAviso.abrir === "function") {
      window.modalAviso.abrir({
        titulo,
        mensagem,
        tipo: "sucesso",
        icone: "✅",
        autoFecharMs: 3500,
      });
      return;
    }
  } catch (e) {
    console.warn("🧭 [backupUI] Falha ao abrir modal customizado:", e?.message || e);
  }

  // 3) Fallback simples
  alert("✅ " + titulo + "\n\n" + mensagem);
}

// ———————————————————————————————————————————————————————————————
// Ações
// ———————————————————————————————————————————————————————————————

// Botão conectar
btnConectar?.addEventListener("click", async () => {
  console.log("🧭 [backupUI] Clique em Conectar Google");
  const resp = await window.api.conectarGoogle();
  if (resp?.ok) {
    oauthStatus.textContent = "Aguardando autorização…";
    if (authUrl) {
      authUrl.href = resp.url;
      authUrl.onclick = (ev) => {
        ev.preventDefault();
        window.api.abrirLink?.(resp.url);
      };
    }
    if (authCode) authCode.textContent = resp.code;
    if (authCard) authCard.style.display = "block";
  } else {
    oauthStatus.textContent = "Erro ao iniciar conexão";
    console.error("❌ [backupUI] Erro:", resp?.error);
  }
});

// Copiar código ao clicar
authCode?.addEventListener("click", async () => {
  const text = (authCode.textContent || "").trim();
  if (!text || text === "—") return;
  try {
    await navigator.clipboard.writeText(text);
    if (copiedHint) {
      copiedHint.style.display = "inline";
      setTimeout(() => (copiedHint.style.display = "none"), 1200);
    }
    console.log("✅ [backupUI] Código copiado:", text);
  } catch (e) {
    console.error("❌ [backupUI] Falha ao copiar:", e);
  }
});

// Status do backend (polling)
window.api.ouvirDriveStatus((payload) => {
  console.log("🧭 [backupUI] Status recebido:", payload);
  if (payload?.ok) {
    if (oauthStatus) oauthStatus.textContent = "✅ Conectado ao Google Drive";
    if (authStatus) authStatus.textContent = "Conexão autorizada com sucesso.";
    abrirModalSucessoOAuth(); // ✅ só aqui disparamos o modal
  } else if (payload?.message) {
    if (authStatus) authStatus.textContent = `⚠️ ${payload.message}`;
  }
});

// Replay do código caso listener seja registrado depois
window.api.pedirReplayDriveCodigo?.();
