/**
 * ============================================================================
 * Caminho: backend/lib/googleAuth.js
 * Objetivo: Fluxo OAuth 2.0 "Device Code" p/ Google Drive.
 *
 * Integrações legadas (UI antiga):
 *  - Emite:   "drive:codigo"         { url, code, expiresIn, issuedAt }
 *  - Emite:   "drive:codigo:status"  { ok, message }
 *  - Recebe:  "drive:codigo:request" (reenvia último código à UI)
 *
 * Integração com backupHandler (novo fluxo):
 *  - exporta startDeviceAuth()        → { device_code, user_code, verification_uri, interval, expires_in }
 *  - exporta pollDeviceToken(device_code) → { state, tokens?, message? }
 *
 * Retrocompat:
 *  - exporta startDeviceCode()        (alias p/ startDeviceAuth)
 *  - exporta pollDeviceTokens()       (alias p/ pollDeviceToken)
 *  - exporta startDeviceFlow()        → solicita + poll e retorna tokens
 *  - exporta getAuthorizedClient()    → { credentials: tokens }
 *
 * Importante:
 *  - ❌ NÃO abrimos a URL automaticamente.
 *  - ✅ A UI deve chamar window.api.abrirLink(url) ao clicar no link mostrado.
 * ============================================================================
 */

const { BrowserWindow, ipcMain /*, shell */ } = require("electron");
const axios = require("axios");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

// ========================= Constantes e Estado ===============================
const LOG = "🔐 [OAuth]";
const APP_DIR = path.join(process.env.HOME || process.env.USERPROFILE, ".config", "escola-aprendizes");
const TOKENS_PATH = path.join(APP_DIR, "tokens");
const DRIVE_TOKEN_FILE = path.join(TOKENS_PATH, "google-drive.json");

let lastDeviceAuth = null;        // guarda último device_code gerado (para replay na UI)
let replayIpcRegistered = false;  // para não registrar callback 2x

// Axios preparado para x-www-form-urlencoded
const http = axios.create({
  timeout: 15000,
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
});

// ========================= Utils ============================================
function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function saveTokens(t) {
  ensureDirSync(APP_DIR);
  ensureDirSync(TOKENS_PATH);
  await fsp.writeFile(DRIVE_TOKEN_FILE, JSON.stringify(t, null, 2), "utf-8");
  console.log(`${LOG} Tokens salvos em: ${DRIVE_TOKEN_FILE}`);
}

function getMainWindow() {
  const wins = BrowserWindow.getAllWindows?.() || [];
  return wins[0] || null;
}

function sendToRenderer(channel, payload) {
  const win = getMainWindow();
  if (win) {
    win.webContents.send(channel, payload);
    return true;
  }
  console.warn(`${LOG} Nenhuma janela para enviar: ${channel}`);
  return false;
}

function assertEnv() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const sec = process.env.GOOGLE_CLIENT_SECRET; // opcional no Device Flow
  console.log(`${LOG} ENV client_id definido?`, Boolean(id), "| client_secret definido?", Boolean(sec));
  if (!id) throw new Error("Falta GOOGLE_CLIENT_ID no .env (OAuth Client 'Desktop' no Google Cloud).");
  return { client_id: id, client_secret: sec };
}

function getScopes() {
  const raw = process.env.GOOGLE_SCOPES || "https://www.googleapis.com/auth/drive.file";
  const scopes = raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
  console.log(`${LOG} Scopes:`, scopes);
  return scopes;
}

// ========================= Fluxo Device Code (API nova) =====================
/**
 * Solicita o device code ao Google e NÃO abre automaticamente o navegador.
 * A UI receberá o link e o usuário abrirá manualmente pelo botão/link.
 */
async function startDeviceAuth() {
  console.log(`${LOG} startDeviceAuth() → requisitando device code…`);
  const { client_id } = assertEnv();
  const scopes = getScopes();

  const body = new URLSearchParams({ client_id, scope: scopes.join(" ") }).toString();
  const resp = await http.post("https://oauth2.googleapis.com/device/code", body);

  const {
    device_code,
    user_code,
    verification_url,
    verification_uri,
    expires_in,
    interval,
  } = resp.data || {};

  const url = verification_url || verification_uri || "https://www.google.com/device";
  const issuedAt = Date.now();

  if (!device_code || !user_code) {
    throw new Error("Resposta inválida: device_code/user_code ausentes.");
  }

  lastDeviceAuth = {
    url,
    code: user_code,
    device_code,
    expiresIn: Number(expires_in || 1800),
    interval: Number(interval || 5),
    issuedAt,
  };

  console.log(
    `${LOG} Device code OK | user_code=${user_code} | url=${url} | exp=${expires_in}s | interval=${interval}s`
  );

  // UI legada: envia cartão (para exibir instruções)
  sendToRenderer("drive:codigo", {
    url,
    code: user_code,
    expiresIn: lastDeviceAuth.expiresIn,
    issuedAt,
  });

  // ❌ Não abrir automaticamente (sem shell.openExternal)
  // A UI abrirá pelo link com window.api.abrirLink(url)

  return {
    device_code,
    user_code,
    verification_uri: url,
    expires_in: Number(expires_in || 1800),
    interval: Number(interval || 5),
  };
}

/**
 * Faz uma tentativa de polling e retorna estado normalizado:
 *   - { state: 'authorized', tokens }
 *   - { state: 'pending' }
 *   - { state: 'expired' }
 *   - { state: 'error', message }
 */
async function pollDeviceToken(device_code) {
  console.log(`${LOG} pollDeviceToken() → start | device_code=${String(device_code).slice(0, 6)}…`);
  const { client_id, client_secret } = assertEnv();

  if (!device_code) {
    console.warn(`${LOG} device_code ausente.`);
    return { state: "error", message: "device_code ausente." };
  }

  const ttlMs = (lastDeviceAuth?.expiresIn || 1800) * 1000;
  const startedAt = Date.now();

  try {
    const body = new URLSearchParams({
      client_id,
      device_code,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      ...(client_secret ? { client_secret } : {}),
    }).toString();

    const tok = await http.post("https://oauth2.googleapis.com/token", body);

    console.log(`${LOG} ✅ Autorizado. access_token (tamanho):`, (tok.data?.access_token || "").length);

    await saveTokens(tok.data);
    sendToRenderer("drive:codigo:status", { ok: true, message: "Conexão autorizada." });

    return { state: "authorized", tokens: tok.data };
  } catch (err) {
    const data = err.response?.data;

    if (data?.error === "authorization_pending") {
      if (Date.now() - startedAt > ttlMs) {
        sendToRenderer("drive:codigo:status", { ok: false, message: "Tempo expirado. Gere um novo código." });
        return { state: "expired" };
      }
      return { state: "pending" };
    }

    if (data?.error === "slow_down") {
      console.log(`${LOG} ...slow_down sugerido (handler ajusta intervalo, se quiser).`);
      return { state: "pending" };
    }

    if (data?.error === "access_denied" || data?.error === "expired_token") {
      console.warn(`${LOG} ${data.error} — status de falha emitido.`);
      sendToRenderer("drive:codigo:status", { ok: false, message: "Código expirado ou acesso negado." });
      return { state: "expired" };
    }

    console.error(`${LOG} Erro no polling:`, data || err.message);
    return { state: "error", message: data?.error_description || data?.error || err.message || String(err) };
  }
}

// ========================= Retrocompat / Fluxo completo =====================
async function startDeviceFlow() {
  const first = await startDeviceAuth();
  const deadline = Date.now() + (first.expires_in || 1800) * 1000;
  let intervalMs = Math.max(3000, (first.interval || 5) * 1000);

  while (Date.now() < deadline) {
    const res = await pollDeviceToken(first.device_code);
    if (res.state === "authorized") return res.tokens;
    if (res.state === "expired") throw new Error("expired_token");
    if (res.state === "error") throw new Error(res.message || "Erro no device flow");
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Tempo expirado no device flow.");
}

async function getAuthorizedClient() {
  const tokens = await startDeviceFlow();
  return { credentials: tokens };
}

// ========================= Estado / utilidades ===============================
function getLastDeviceAuth() { return lastDeviceAuth; }
function clearLastDeviceAuth() { lastDeviceAuth = null; }

// ========================= IPC auxiliares (replay p/ UI antiga) =============
function registerReplayIpcOnce(ipc = ipcMain) {
  if (replayIpcRegistered) return;
  if (!ipc || typeof ipc.on !== "function") {
    console.warn(`${LOG} IPC indisponível para registrar replay (drive:codigo:request).`);
    return;
  }
  replayIpcRegistered = true;

  ipc.on("drive:codigo:request", () => {
    console.log(`${LOG} Replay solicitado → drive:codigo`);
    if (lastDeviceAuth) {
      sendToRenderer("drive:codigo", {
        url: lastDeviceAuth.url,
        code: lastDeviceAuth.code,
        expiresIn: lastDeviceAuth.expiresIn,
        issuedAt: lastDeviceAuth.issuedAt,
      });
    }
  });
}
// Evita efeitos colaterais em importações fora do Electron main.
registerReplayIpcOnce();

// ========================= Exports ==========================================
module.exports = {
  // Nova API usada pelo handler
  startDeviceAuth,
  pollDeviceToken,

  // Retrocompat (aliases)
  startDeviceCode: startDeviceAuth,
  pollDeviceTokens: pollDeviceToken,

  // Fluxo completo (compat)
  startDeviceFlow,
  getAuthorizedClient,

  // Estado / utilidades
  getLastDeviceAuth,
  clearLastDeviceAuth,
  DRIVE_TOKEN_FILE,

  // IPC auxiliar
  registerReplayIpcOnce,
};
