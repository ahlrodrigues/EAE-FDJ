/**
 * ============================================
 * PATH: backend/handlers/backupOAuthHandler.js
 * OBJ: Handler de OAuth (Google Drive) via IPC - MAIN PROCESS
 * Notas:
 * - Este módulo registra handlers do ipcMain.
 * - Foi reescrito para remover erro de sintaxe ("Unexpected token 'catch'")
 *   garantindo pares try/catch e chaves balanceadas.
 * - Logs detalhados em cada etapa.
 * - Integração com GoogleDriveClient (se existir) é opcional:
 *   mantenha adaptadores em ./lib/googleDriveClient.js.
 * ============================================
 */

const { ipcMain } = require("electron");
const path = require("path");
const os = require("os");
const dotenv = require("dotenv");
dotenv.config();

// 🔐 Variáveis de ambiente
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_OAUTH_DEVICE_ENDPOINT = "https://oauth2.googleapis.com/device/code";
const GOOGLE_OAUTH_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

// Evite fetch nativo em versões antigas do Node/Electron
const https = require("https");
const { URLSearchParams } = require("url");

// (Opcional) Se você já tem um cliente implementado:
// const { GoogleDriveClient } = require("../lib/googleDriveClient");

// 👉 Escopos mínimos para Drive (ajuste se precisar apenas drive.file):
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

/**
 * Helper: POST x-www-form-urlencoded via https
 */
function postForm(url, dataObj) {
  return new Promise((resolve, reject) => {
    try {
      const payload = new URLSearchParams(dataObj).toString();
      const u = new URL(url);

      const req = https.request(
        {
          method: "POST",
          hostname: u.hostname,
          path: u.pathname + (u.search || ""),
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Content-Length": Buffer.byteLength(payload),
          },
        },
        (res) => {
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => {
            try {
              const json = JSON.parse(body || "{}");
              if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve(json);
              } else {
                const err = new Error(
                  `HTTP ${res.statusCode} - ${json.error || "unknown_error"}`
                );
                err.response = json;
                reject(err);
              }
            } catch (parseErr) {
              reject(parseErr);
            }
          });
        }
      );

      req.on("error", reject);
      req.write(payload);
      req.end();
    } catch (outerErr) {
      reject(outerErr);
    }
  });
}

/**
 * Estado em memória da tentativa de OAuth (device flow)
 */
const oauthState = {
  device_code: null,
  user_code: null,
  verification_url: null,
  interval: 5,
  expires_in: 0,
  requested_at: 0,
};

/**
 * Inicia o fluxo Device Code
 */
async function iniciarDeviceCode() {
  console.log("[OAuth] ▶️ iniciarDeviceCode()");
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID ausente no .env");
  }
  // Para device flow, Google não exige client_secret
  const data = {
    client_id: GOOGLE_CLIENT_ID,
    scope: SCOPES.join(" "),
  };

  const resp = await postForm(GOOGLE_OAUTH_DEVICE_ENDPOINT, data);

  // Esperados no retorno:
  // device_code, user_code, verification_url, expires_in, interval
  oauthState.device_code = resp.device_code || null;
  oauthState.user_code = resp.user_code || null;
  oauthState.verification_url =
    resp.verification_url || resp.verification_uri || null;
  oauthState.interval = resp.interval || 5;
  oauthState.expires_in = resp.expires_in || 0;
  oauthState.requested_at = Date.now();

  console.log(
    "[OAuth] ✅ Device code OK | user_code=%s | url=%s | interval=%ss | expires_in=%ss",
    oauthState.user_code,
    oauthState.verification_url,
    oauthState.interval,
    oauthState.expires_in
  );

  return {
    user_code: oauthState.user_code,
    verification_url: oauthState.verification_url,
    interval: oauthState.interval,
    expires_in: oauthState.expires_in,
  };
}

/**
 * Faz polling do token enquanto o usuário autoriza
 */
async function pollToken() {
  console.log("[OAuth] 🔁 pollToken()");
  if (!oauthState.device_code) {
    throw new Error("Fluxo não iniciado. Chame 'backup:oauth:start' antes.");
  }

  const elapsed = (Date.now() - oauthState.requested_at) / 1000;
  if (oauthState.expires_in && elapsed > oauthState.expires_in) {
    throw new Error("Device code expirado. Reinicie o fluxo.");
  }

  const data = {
    client_id: GOOGLE_CLIENT_ID,
    // Para device flow, alguns cenários aceitam client_secret vazio.
    // Se o seu projeto estiver configurado como Desktop app, mantenha vazio.
    // Se for Web app, pode ser necessário o secret:
    ...(GOOGLE_CLIENT_SECRET ? { client_secret: GOOGLE_CLIENT_SECRET } : {}),
    device_code: oauthState.device_code,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
  };

  try {
    const resp = await postForm(GOOGLE_OAUTH_TOKEN_ENDPOINT, data);
    // Se deu certo, resp terá access_token / refresh_token
    console.log("[OAuth] ✅ Token recebido.");
    // Exemplo: persistir tokens (adicione sua store segura)
    // await usuarioStore.salvarTokens(resp);

    // Reset estado em memória
    const out = { ...resp };
    oauthState.device_code = null;
    oauthState.user_code = null;
    oauthState.verification_url = null;

    return out;
  } catch (err) {
    const code = err?.response?.error;
    if (code === "authorization_pending") {
      console.log("[OAuth] ⏳ Aguardando autorização do usuário…");
      return { pending: true };
    }
    if (code === "slow_down") {
      console.log("[OAuth] 🐢 Servidor pediu para reduzir a frequência.");
      return { slow_down: true };
    }
    if (code === "expired_token" || code === "expired_token_error") {
      console.warn("[OAuth] ⛔ Device code expirado.");
      throw new Error("Device code expirado. Reinicie o fluxo.");
    }
    console.error("[OAuth] ❌ Erro no polling:", err?.response || err);
    throw err;
  }
}

/**
 * (Opcional) Enviar user_code por e-mail
 * Você pode integrar com seu emailHandler ou nodemailer local.
 */
async function enviarCodePorEmail({ para }) {
  console.log("[OAuth] ✉️ enviarCodePorEmail()", { para });
  if (!oauthState.user_code || !oauthState.verification_url) {
    throw new Error("Sem user_code ativo. Inicie o OAuth antes de enviar e-mail.");
  }

  // 👉 Integre aqui com seu handler de e-mail, ex:
  // await emailHandler.enviar({
  //   to: para,
  //   subject: "Código para conectar ao Google Drive",
  //   text: `Use o código ${oauthState.user_code} em ${oauthState.verification_url}`,
  // });

  // Por enquanto, apenas loga (para não travar fluxo em dev)
  console.log(
    "[OAuth] (SIMULADO) E-mail enviado para %s com código %s e URL %s",
    para,
    oauthState.user_code,
    oauthState.verification_url
  );

  return { ok: true };
}

/**
 * Cancela o fluxo atual
 */
function cancelarFluxo() {
  console.log("[OAuth] 🛑 Fluxo de device code cancelado.");
  oauthState.device_code = null;
  oauthState.user_code = null;
  oauthState.verification_url = null;
  oauthState.interval = 5;
  oauthState.expires_in = 0;
  oauthState.requested_at = 0;
  return { ok: true };
}

/**
 * Registra os IPCs
 */
function registrarBackupOAuthHandler() {
  console.log("🧭 [backupOAuthHandler] Registro de IPCs…");

  // Iniciar Device Code
  ipcMain.handle("backup:oauth:start", async () => {
    try {
      return await iniciarDeviceCode();
    } catch (err) {
      console.error("[OAuth] ❌ Falha ao iniciar OAuth (device code):", err);
      return {
        error: true,
        message:
          err?.message ||
          "Falha ao iniciar OAuth (device code). Verifique o .env e as credenciais.",
        details: err?.response || null,
      };
    }
  });

  // Polling para token
  ipcMain.handle("backup:oauth:poll", async () => {
    try {
      return await pollToken();
    } catch (err) {
      return {
        error: true,
        message: err?.message || "Falha no polling do token.",
        details: err?.response || null,
      };
    }
  });

  // Enviar código por e-mail
  ipcMain.handle("backup:enviar-code-email", async (_event, payload) => {
    try {
      const { para } = payload || {};
      if (!para) {
        throw new Error("Parâmetro 'para' é obrigatório.");
      }
      return await enviarCodePorEmail({ para });
    } catch (err) {
      console.error("[OAuth] ❌ Falha ao enviar código por e-mail:", err);
      return {
        error: true,
        message: err?.message || "Falha ao enviar o código por e-mail.",
      };
    }
  });

  // Cancelar fluxo
  ipcMain.handle("backup:oauth:cancel", async () => {
    try {
      return cancelarFluxo();
    } catch (err) {
      return { error: true, message: err?.message || "Falha ao cancelar fluxo." };
    }
  });
}

module.exports = {
  registrarBackupOAuthHandler,
};
