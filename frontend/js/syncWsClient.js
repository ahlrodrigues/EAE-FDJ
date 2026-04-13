// =============================================================================
// Caminho: frontend/js/syncWsClient.js
// Objetivo:
//  - Conectar em WebSocket (opcional) para receber "updateAvailable".
//  - Não baixa nada automaticamente; só mostra banner e oferece botão "Atualizar".
//  - O download é via IPC: window.api.sync.pullNow().
//
// Config:
//  - Preferência: dados em `remoteSync` do usuário (ainda não há UI para isso)
//  - Fallback DEV: env vars via preload (getEnv):
//      SYNC_WS_URL, SYNC_TURMA_ID, SYNC_TOKEN
// =============================================================================

import { exibirAviso } from "./modalAviso.js";

const LOG = "🔔[syncWS]";
let _pulling = false;

function getEnv(key) {
  try { return window.nativo?.getEnv?.(key); } catch { return null; }
}

function envFlag(key) {
  const v = String(getEnv(key) || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function envInt(key, fallback) {
  const raw = String(getEnv(key) || "").trim();
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function getEls() {
  return {
    banner: document.getElementById("updateBanner"),
    text: document.getElementById("updateBannerText"),
    btn: document.getElementById("btnAtualizarConteudo"),
  };
}

function showBanner(msg) {
  const { banner, text } = getEls();
  if (!banner) return;
  if (text) text.textContent = msg || "Há atualizações disponíveis.";
  banner.style.display = "flex";
}

function hideBanner() {
  const { banner } = getEls();
  if (!banner) return;
  banner.style.display = "none";
}

async function pullNow() {
  if (_pulling) return;
  _pulling = true;
  try {
    const resp = await window.api?.sync?.pullNow?.();
    if (resp?.ok) {
      hideBanner();
      await exibirAviso({ tipo: "Atualização", mensagem: resp.changed ? "Conteúdo atualizado." : "Sem atualizações." });
      return;
    }
    throw new Error(resp?.erro || "Falha ao atualizar.");
  } catch (e) {
    console.error(`${LOG} pullNow falhou:`, e);
    await exibirAviso({ tipo: "Erro", mensagem: e?.message || "Falha ao atualizar conteúdo." });
  } finally {
    _pulling = false;
  }
}

function shouldAutoPullOnUpdateAvailable(rs) {
  // Padrão: auto-pull ligado (sem intervenção manual).
  // Desabilitar com:
  // - env: SYNC_AUTO_PULL_ON_UPDATE_AVAILABLE=0
  // - config: remoteSync.autoPullOnUpdateAvailable=false
  const envOverride = String(getEnv("SYNC_AUTO_PULL_ON_UPDATE_AVAILABLE") || "").trim().toLowerCase();
  if (envOverride === "0" || envOverride === "false" || envOverride === "off" || envOverride === "no") return false;
  if (rs && typeof rs === "object" && rs.autoPullOnUpdateAvailable === false) return false;
  return true;
}

async function devAutoPullOnce() {
  try {
    const resp = await window.api?.sync?.pullNow?.();
    console.log(`${LOG} DEV auto-pull`, resp);
  } catch (e) {
    console.warn(`${LOG} DEV auto-pull falhou`, e?.message || e);
  }
}

async function checkNow() {
  try {
    const resp = await window.api?.sync?.check?.();
    if (resp?.ok && resp.configured && resp.changed) {
      const ver = resp.remoteManifestVersion != null ? `v${resp.remoteManifestVersion}` : "";
      showBanner(`Há atualizações disponíveis ${ver}`.trim());
    }
    return resp;
  } catch (e) {
    console.warn(`${LOG} check falhou`, e?.message || e);
    return null;
  }
}

function todayISO() {
  const d = new Date();
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function autoPullIfTodayHasTheme() {
  try {
    const uResp = await window.usuarioAPI?.lerAtual?.();
    const u = uResp?.ok ? (uResp.dados || {}) : {};
    const rs = (u.remoteSync && typeof u.remoteSync === "object") ? u.remoteSync : {};
    const turmaId = String(rs.turmaId || "").trim();
    if (!turmaId) return;

    // Habilitado por padrão (para cumprir regra "hoje === data do tema → atualizar").
    // Desabilitar com:
    // - env: SYNC_AUTO_PULL_ON_THEME_DATE=0
    // - config: remoteSync.autoPullOnThemeDate=false
    const envOverride = String(getEnv("SYNC_AUTO_PULL_ON_THEME_DATE") || "").trim().toLowerCase();
    if (envOverride === "0" || envOverride === "false" || envOverride === "off" || envOverride === "no") return;
    if (rs.autoPullOnThemeDate === false) return;

    const schedResp = await window.api?.content?.getItem?.("tema_schedule", turmaId);
    if (!schedResp?.ok || !schedResp.item?.items) return;
    const items = Array.isArray(schedResp.item.items) ? schedResp.item.items : [];
    const today = todayISO();
    const hasToday = items.some((it) => String(it?.dataPublicacaoISO || "").trim() === today);
    if (!hasToday) return;

    const key = `sync:autoPull:temaDate:${turmaId}`;
    const last = String(localStorage.getItem(key) || "");
    if (last === today) return;

    localStorage.setItem(key, today);
    await pullNow();
  } catch (e) {
    console.warn(`${LOG} autoPullIfTodayHasTheme falhou`, e?.message || e);
  }
}

function bindUpdateButtonOnce() {
  const { btn } = getEls();
  if (!btn || btn._bound) return;
  btn.addEventListener("click", () => pullNow());
  btn._bound = true;
}

function parseJsonSafe(s) {
  try { return JSON.parse(s); } catch { return null; }
}

function wsUrlWithToken(base, token, turmaId) {
  const u = new URL(base);
  if (token) u.searchParams.set("token", token);
  if (turmaId) u.searchParams.set("turmaId", turmaId);
  return u.toString();
}

function deriveWsUrlFromHttpBase(httpBaseUrl) {
  const s = String(httpBaseUrl || "").trim();
  if (!s) return "";
  try {
    const u = new URL(s);
    u.protocol = (u.protocol === "https:") ? "wss:" : "ws:";
    // Convenção (ajustável no futuro): /ws
    u.pathname = "/ws";
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return "";
  }
}

export async function startSyncWsClient() {
  bindUpdateButtonOnce();

  let wsBase = "";
  let turmaId = "";
  let token = "";
  let httpBaseUrl = "";
  let rsCfg = {};

  // Preferir config do usuário (persistida) quando existir
  let checkIntervalMinutes = null;
  try {
    const resp = await window.usuarioAPI?.lerAtual?.();
    const u = resp?.ok ? (resp.dados || {}) : {};
    const rs = (u.remoteSync && typeof u.remoteSync === "object") ? u.remoteSync : {};
    rsCfg = rs;
    wsBase = String(rs.wsUrl || "").trim();
    turmaId = String(rs.turmaId || "").trim();
    token = String(rs.token || "").trim();
    httpBaseUrl = String(rs.httpBaseUrl || "").trim();
    if (rs.checkIntervalMinutes != null) checkIntervalMinutes = Number.parseInt(rs.checkIntervalMinutes, 10);
  } catch {}

  // Fallback DEV via env
  if (!wsBase) wsBase = (getEnv("SYNC_WS_URL") || "").trim();
  if (!turmaId) turmaId = (getEnv("SYNC_TURMA_ID") || "").trim();
  if (!token) token = (getEnv("SYNC_TOKEN") || "").trim();

  // Se WS não for informado, tenta derivar de httpBaseUrl (opcional)
  if (!wsBase) wsBase = deriveWsUrlFromHttpBase(httpBaseUrl || getEnv("SYNC_HTTP_BASE_URL"));

  const intervalMin = Number.isFinite(checkIntervalMinutes)
    ? checkIntervalMinutes
    : envInt("SYNC_CHECK_INTERVAL_MINUTES", 60);
  const shouldScheduleChecks = intervalMin > 0;
  const scheduleChecks = () => {
    if (!shouldScheduleChecks) return null;
    return setInterval(async () => {
      const st = await checkNow();
      if (st?.ok && st.configured && st.changed && shouldAutoPullOnUpdateAvailable(rsCfg)) {
        await pullNow();
      }
    }, intervalMin * 60_000);
  };

  // Se não houver WS, mantém apenas a ação manual de pull (botão escondido por padrão)
  if (!wsBase || !turmaId) {
    console.log(`${LOG} WS não configurado (SYNC_WS_URL/SYNC_TURMA_ID).`);
    // Mesmo sem WS, podemos checar via HTTP e mostrar banner
    const st = await checkNow();
    if (st?.ok && st.configured && st.changed && shouldAutoPullOnUpdateAvailable(rsCfg)) {
      await pullNow();
    }
    scheduleChecks();
    if (envFlag("SYNC_DEV_AUTO_PULL")) await devAutoPullOnce();
    await autoPullIfTodayHasTheme();
    return;
  }

  let ws = null;
  let backoffMs = 1500;
  let stopped = false;

  const connect = () => {
    if (stopped) return;
    const url = wsUrlWithToken(wsBase, token, turmaId);
    console.log(`${LOG} conectando…`, { url: url.replace(token, "***") });

    try {
      ws = new WebSocket(url);
    } catch (e) {
      console.warn(`${LOG} falha ao criar WebSocket:`, e?.message || e);
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      console.log(`${LOG} conectado`);
      backoffMs = 1500;
      // subscribe explícito (compat)
      try { ws.send(JSON.stringify({ type: "subscribe", turmaId })); } catch {}
    };

    ws.onmessage = async (ev) => {
      const data = (typeof ev.data === "string") ? parseJsonSafe(ev.data) : null;
      if (!data) return;
      if (data.type === "updateAvailable") {
        const ver = data.manifestVersion != null ? `v${data.manifestVersion}` : "";
        showBanner(`Há atualizações disponíveis ${ver}`.trim());
        if (shouldAutoPullOnUpdateAvailable(rsCfg)) {
          const key = `sync:autoPull:updateAvailable:${turmaId}`;
          const last = String(localStorage.getItem(key) || "");
          const marker = String(data.manifestVersion ?? data.updatedAtISO ?? "");
          if (marker && last === marker) return;
          if (marker) localStorage.setItem(key, marker);
          await pullNow();
        }
      }
    };

    ws.onerror = (err) => {
      console.warn(`${LOG} erro WS`, err);
    };

    ws.onclose = () => {
      console.warn(`${LOG} desconectado`);
      scheduleReconnect();
    };
  };

  const scheduleReconnect = () => {
    if (stopped) return;
    const wait = Math.min(backoffMs, 30000);
    backoffMs = Math.min(Math.floor(backoffMs * 1.7), 30000);
    setTimeout(connect, wait);
  };

  connect();

  // Fallback leve: checar status local e (opcionalmente) rodar pull manual
  try {
    const st = await window.api?.sync?.status?.();
    if (st?.ok && st.configured) {
      console.log(`${LOG} status local`, st);
    }
  } catch {}

  // Checagem HTTP (mostra banner sem depender de WS); auto-pull se habilitado
  const stHttp = await checkNow();
  if (stHttp?.ok && stHttp.configured && stHttp.changed && shouldAutoPullOnUpdateAvailable(rsCfg)) {
    await pullNow();
  }
  await autoPullIfTodayHasTheme();
  const intervalId = scheduleChecks();

  if (envFlag("SYNC_DEV_AUTO_PULL")) await devAutoPullOnce();

  return () => {
    stopped = true;
    try { if (intervalId) clearInterval(intervalId); } catch {}
    try { ws?.close?.(); } catch {}
  };
}
