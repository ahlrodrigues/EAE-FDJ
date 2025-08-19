// === backend/lib/googleOAuth.js ===
const axios = require("axios");
const open = require("open");
const { SCOPES } = require("./googleDriveClient");

const GOOGLE_OAUTH_DEVICE_CODE_ENDPOINT = "https://oauth2.googleapis.com/device/code";
const GOOGLE_OAUTH_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente ausente: ${name}`);
  return v;
}

async function startDeviceFlow() {
  const client_id = requireEnv("GOOGLE_CLIENT_ID");
  const client_secret = requireEnv("GOOGLE_CLIENT_SECRET");

  const scope = SCOPES.join(" ");
  let deviceResp;
  try {
    deviceResp = await axios.post(
      GOOGLE_OAUTH_DEVICE_CODE_ENDPOINT,
      new URLSearchParams({ client_id, scope }).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
  } catch (err) {
    const details = err?.response?.data || err.message;
    console.error("❌ [OAuth] Erro ao pedir device_code:", details);
    throw new Error(
      `Falha ao iniciar OAuth (device code). Detalhes: ${typeof details === "string" ? details : JSON.stringify(details)}`
    );
  }

  const { device_code, user_code, verification_url, expires_in, interval } = deviceResp.data || {};
  if (!device_code || !verification_url) {
    throw new Error("Resposta inválida do endpoint de device_code.");
  }

  console.log("🔐 [OAuth] Autorize no navegador:", verification_url, " | Código:", user_code);
  try { await open(verification_url); } catch (_) {}

  const pollInterval = Math.max(5, Number(interval || 5));
  const deadline = Date.now() + Number(expires_in || 1800) * 1000;

  while (Date.now() < deadline) {
    await sleep(pollInterval * 1000);
    try {
      const tokenResp = await axios.post(
        GOOGLE_OAUTH_TOKEN_ENDPOINT,
        new URLSearchParams({
          client_id,
          client_secret,
          device_code,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }).toString(),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      const t = tokenResp.data || {};
      const now = Date.now();
      const expiry_date = t.expires_in ? now + Number(t.expires_in) * 1000 : undefined;

      if (!t.access_token) throw new Error("Token não trouxe access_token.");

      console.log("✅ [OAuth] Autorizado com sucesso.");
      return {
        access_token: t.access_token,
        refresh_token: t.refresh_token,
        scope: t.scope,
        token_type: t.token_type,
        expiry_date,
      };
    } catch (err) {
      const e = err?.response?.data || {};
      if (e.error === "authorization_pending") continue;
      if (e.error === "slow_down") { await sleep(pollInterval * 1000); continue; }
      // erros comuns explicados:
      if (e.error === "unauthorized_client") {
        throw new Error(
          "Cliente OAuth não autorizado para Device Code. No Cloud Console, crie Client do tipo 'Desktop' ou 'TVs and Limited Input devices' e use suas credenciais."
        );
      }
      if (e.error === "access_denied") throw new Error("Acesso negado pelo usuário.");
      if (e.error === "expired_token") throw new Error("Tempo de autorização expirou. Tente novamente.");
      console.error("❌ [OAuth] Falha no polling:", e || err.message);
      throw new Error(`Falha no polling do token: ${e.error_description || e.error || err.message}`);
    }
  }

  throw new Error("Tempo para autorização expirou. Tente novamente.");
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { startDeviceFlow };
