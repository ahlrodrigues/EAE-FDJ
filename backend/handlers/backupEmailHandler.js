/**
 * ============================================================================
 * Caminho: backend/handlers/backupEmailHandler.js
 * Responsável por registrar o IPC para enviar o device code por e‑mail.
 *
 * Canal (invoke):
 *  - "backup:enviar-code-email" → envia o code por e‑mail.
 *      Payload aceito:
 *        - string (email destino), ou
 *        - objeto { to?: string }
 *
 * Retorno:
 *  - { ok: true, message }     em caso de sucesso
 *  - { ok: false, error }      em caso de erro
 *
 * Dependências:
 *  - ../lib/googleAuth: getLastDeviceAuth()  (para recuperar { url, code, expiresIn })
 *  - ../lib/emailer:    sendMail()           (SMTP via .env)
 *
 * Observações:
 *  - Se "to" não for informado, tenta ler e-mail do usuario.json (primeiro usuário).
 *  - NÃO dispara modal de sucesso; é responsabilidade da UI.
 *  - Logs detalhados para diagnóstico.
 * ============================================================================
 */

const { ipcMain } = require("electron");
const path = require("path");
const os = require("os");
const fsp = require("fs/promises");

const { getLastDeviceAuth } = require("../lib/googleAuth");
const { sendMail } = require("../lib/emailer");

const LOG = "✉️ [Email-IPC]";

// Utilitário: obtem e-mail do primeiro usuário cadastrado
async function getEmailCadastrado() {
  try {
    const usuarioPath = path.join(
      os.homedir(),
      ".config",
      "escola-aprendizes",
      "config",
      "usuario.json"
    );
    const raw = await fsp.readFile(usuarioPath, "utf-8");
    const dados = JSON.parse(raw);
    const key = Object.keys(dados?.usuarios || {})[0];
    const email = dados?.usuarios?.[key]?.email || null;
    console.log(`${LOG} email do usuario.json:`, email || "<vazio>");
    return email;
  } catch (e) {
    console.warn(`${LOG} falha ao ler usuario.json:`, e?.message || e);
    return null;
  }
}

function normalizaDestino(arg) {
  if (!arg) return "";
  if (typeof arg === "string") return arg.trim();
  if (typeof arg === "object" && arg.to) return String(arg.to || "").trim();
  return "";
}

function montarMensagens(dc) {
  const minutos = Math.round((dc.expiresIn || 1800) / 60);
  const subject = "Seu código de autorização do Google (Device Code)";
  const text = `Abra ${dc.url}
e digite o código:

${dc.code}

Este código expira em ~${minutos} minutos.`;
  const html = `<p>Abra <a href="${dc.url}" target="_blank" rel="noopener">${dc.url}</a> e digite o código:</p>
<p style="font-size:18px;"><b>${dc.code}</b></p>
<p>Este código expira em ~${minutos} minutos.</p>`;
  return { subject, text, html };
}

function registrarBackupEmailHandler() {
  if (registrarBackupEmailHandler.__registered) {
    console.log(`${LOG} já registrado (skip).`);
    return;
  }
  registrarBackupEmailHandler.__registered = true;

  ipcMain.handle("backup:enviar-code-email", async (_e, payload) => {
    try {
      console.log(`${LOG} invoke backup:enviar-code-email | payload=`, payload);

      // 1) Code atual precisa existir
      const dc = getLastDeviceAuth();
      if (!dc?.code || !dc?.url) {
        console.warn(`${LOG} nenhum device code ativo. peça "Conectar Google" primeiro.`);
        return { ok: false, error: "Nenhum código gerado. Clique em Conectar Google primeiro." };
      }

      // 2) Resolve destino
      let to = normalizaDestino(payload);
      if (!to) {
        to = await getEmailCadastrado();
      }
      console.log(`${LOG} destino final:`, to || "<vazio>");
      if (!to) return { ok: false, error: "Informe um e‑mail válido." };

      // 3) Monta mensagens e envia
      const { subject, text, html } = montarMensagens(dc);
      await sendMail({ to, subject, text, html });

      console.log(`${LOG} enviado com sucesso →`, to);
      return { ok: true, message: `Código enviado para ${to}` };
    } catch (e) {
      console.error(`${LOG} falha no envio:`, e?.message || e);
      return { ok: false, error: e?.message || String(e) };
    }
  });

  console.log(`${LOG} handler registrado: backup:enviar-code-email`);
}

module.exports = { registrarBackupEmailHandler };
