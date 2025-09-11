// backend/lib/emailer.js
const nodemailer = require("nodemailer");
const LOG = "✉️ [Email]";

function ensureEmailEnabled() {
  const enabled = String(process.env.EMAIL_ENABLED || "").toLowerCase() === "true";
  console.log(`${LOG} EMAIL_ENABLED?`, enabled);
  if (!enabled) throw new Error("Envio desabilitado (EMAIL_ENABLED != true).");
}

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  console.log(`${LOG} SMTP host=${host} port=${port} secure=${secure} user=${user ? "<definido>" : "<vazio>"}`);

  if (!host || !user || !pass) {
    throw new Error("SMTP incompleto (defina SMTP_HOST, SMTP_USER, SMTP_PASS).");
  }

  return nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
}

async function sendMail({ to, subject, text, html }) {
  ensureEmailEnabled();
  const from = process.env.EMAIL_FROM || "no-reply@localhost";
  console.log(`${LOG} Preparando e-mail | from=${from} → to=${to} | subject="${subject}"`);

  const transporter = createTransport();

  try {
    const info = await transporter.sendMail({ from, to, subject, text, html });
    console.log(`${LOG} ENVIADO → ${to} | id=${info.messageId}`);
    if (info?.response) console.log(`${LOG} SMTP response:`, info.response);
    return info;
  } catch (e) {
    console.error(`${LOG} FALHA no sendMail:`, e?.message || e);
    if (e?.code) console.error(`${LOG} SMTP code:`, e.code);
    if (e?.response) console.error(`${LOG} SMTP response:`, e.response);
    throw e;
  }
}

module.exports = { sendMail };
