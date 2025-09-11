/**
 * ============================================
 * PATH: backend/lib/googleAuth.js
 * OBJ: Fluxo OAuth 2.0 "Device Code" p/ Google Drive (processo principal).
 * Integra com a UI via IPC:
 *  - Emite:   "drive:codigo"         { url, code, expiresIn, issuedAt }
 *  - Emite:   "drive:codigo:status"  { ok, message }
 *  - Recebe:  "drive:codigo:request" (reenvia último código à UI)
 *  - Handle:  "system:open-external" → abre URL no navegador (fallback)
 *
 * Compatibilidade com backupHandler:
 *  - exporta startDeviceFlow()        → retorna tokens (flow completo)
 *  - exporta getAuthorizedClient()    → { credentials: tokens }
 *  - exporta startDeviceCode(), pollDeviceTokens() (uso direto, se preferir)
 *
 * .env necessário:
 *  - GOOGLE_CLIENT_ID (obrigatório; tipo "Desktop")
 *  - GOOGLE_CLIENT_SECRET (opcional no Device Flow)
 *  - GOOGLE_SCOPES (opcional; default: https://www.googleapis.com/auth/drive.file)
 * ============================================
 */

const { BrowserWindow, ipcMain, shell } = require("electron");
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
  if (!id) throw new Error("Falta GOOGLE_CLIENT_ID no .env (crie OAuth Client do tipo 'Desktop' no Google Cloud).");
  return { client_id: id, client_secret: sec };
}

function getScopes() {
  const raw = process.env.GOOGLE_SCOPES || "https://www.googleapis.com/auth/drive.file";
  const scopes = raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
  console.log(`${LOG} Scopes:`, scopes);
  return scopes;
}

// ========================= Fluxo Device Code ================================
async function startDeviceCode() {
  console.log(`${LOG} startDeviceCode() → requisitando device code...`);
  const { client_id } = assertEnv();
  const scopes = getScopes();

  const body = new URLSearchParams({ client_id, scope: scopes.join(" ") }).toString();
  const resp = await http.post("https://oauth2.googleapis.com/device/code", body);

  const {
    device_code,
    user_code,
    verification_url,
    verification_uri, // fallback
    expires_in,
    interval,
  } = resp.data || {};

  const url = verification_url || verification_uri || "https://www.google.com/device"; // fallback final
  const issuedAt = Date.now();

  // guarda estado para replay
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

  // envia para UI pintar cartão
  sendToRenderer("drive:codigo", {
    url,
    code: user_code,
    expiresIn: lastDeviceAuth.expiresIn,
    issuedAt,
  });

  // tenta abrir automaticamente o navegador
  try {
    console.log(`${LOG} Abrindo navegador padrão em: ${url}`);
    await shell.openExternal(url);
  } catch (e) {
    console.warn(`${LOG} Não consegui abrir automaticamente:`, e?.message || e);
    // avisa a UI para abrir manualmente
    sendToRenderer("drive:codigo:status", {
      ok: false,
      message: "Não consegui abrir automaticamente. Clique no link ou copie/cole no navegador.",
    });
  }

  return lastDeviceAuth;
}

async function pollDeviceTokens(device_code) {
  console.log(`${LOG} pollDeviceTokens() → start | device_code=${String(device_code).slice(0, 6)}...`);
  const { client_id, client_secret } = assertEnv();

  const start = Date.now();
  const ttl = (lastDeviceAuth?.expiresIn || 1800) * 1000;
  let waitMs = Math.max(3000, (lastDeviceAuth?.interval || 5) * 1000);

  while (Date.now() - start < ttl) {
    await new Promise((r) => setTimeout(r, waitMs));

    try {
      const body = new URLSearchParams({
        client_id,
        device_code,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        // client_secret é opcional no Device Flow; inclua apenas se existir
        ...(client_secret ? { client_secret } : {}),
      }).toString();

      const tok = await http.post("https://oauth2.googleapis.com/token", body);

      console.log(`${LOG} ✅ Autorizado. access_token (tamanho):`, (tok.data?.access_token || "").length);

      await saveTokens(tok.data);
      sendToRenderer("drive:codigo:status", { ok: true, message: "Conexão autorizada." });
      return tok.data;
    } catch (err) {
      const data = err.response?.data;
      if (data?.error === "authorization_pending") {
        console.log(`${LOG} ...authorization_pending`);
        continue;
      }
      if (data?.error === "slow_down") {
        waitMs += 2000;
        console.log(`${LOG} ...slow_down | novo intervalo(ms)=`, waitMs);
        continue;
      }
      if (data?.error === "access_denied" || data?.error === "expired_token") {
        console.warn(`${LOG} ${data.error} — status de falha emitido.`);
        sendToRenderer("drive:codigo:status", { ok: false, message: "Código expirado ou acesso negado." });
        throw new Error(data.error);
      }
      console.error(`${LOG} Erro no polling:`, data || err.message);
      throw err;
    }
  }

  console.warn(`${LOG} ⏰ Tempo expirou no device flow — status fail.`);
  sendToRenderer("drive:codigo:status", { ok: false, message: "Tempo expirado. Gere um novo código." });
  throw new Error("Tempo expirado no device flow.");
}

// ========================= Compat com backupHandler ==========================
/**
 * Executa o fluxo completo: solicita device code, faz polling e retorna tokens.
 */
async function startDeviceFlow() {
  const auth = await startDeviceCode();
  return pollDeviceTokens(auth.device_code);
}

/**
 * Retorna objeto no formato { credentials: <tokens> }.
 */
async function getAuthorizedClient() {
  const tokens = await startDeviceFlow();
  return { credentials: tokens };
}

// ========================= Estado / utilidades ===============================
function getLastDeviceAuth() { return lastDeviceAuth; }
function clearLastDeviceAuth() { lastDeviceAuth = null; }

// ========================= IPC auxiliares (replay/abrir link) ===============
function registerReplayIpcOnce() {
  if (replayIpcRegistered) return;
  replayIpcRegistered = true;

  // Reenvia o cartão com o último código quando a UI pedir
  ipcMain.on("drive:codigo:request", () => {
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

  // Fallback: abrir URL externa via IPC
  if (!ipcMain.listenerCount("system:open-external")) {
    ipcMain.handle("system:open-external", async (_evt, { url }) => {
      try {
        if (!url) throw new Error("URL vazia.");
        console.log(`${LOG} [IPC] system:open-external →`, url);
        await shell.openExternal(url);
        return { ok: true };
      } catch (err) {
        console.error(`${LOG} Falha ao abrir URL externa:`, err?.message || err);
        return { ok: false, erro: err?.message || "Falha ao abrir URL" };
      }
    });
  }
}
registerReplayIpcOnce();

// ========================= Exports ==========================================
module.exports = {
  // Fluxo base
  startDeviceCode,
  pollDeviceTokens,

  // Compat com backupHandler
  startDeviceFlow,
  getAuthorizedClient,

  // Estado / utilidades
  getLastDeviceAuth,
  clearLastDeviceAuth,
  DRIVE_TOKEN_FILE,
};
