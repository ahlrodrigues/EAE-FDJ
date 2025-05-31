// === enviarTokenPorEmail.js ===
// Serviço de envio de token por e-mail usando Gmail e Nodemailer

require("dotenv").config();
const nodemailer = require("nodemailer");

/**
 * Envia um e-mail com o token de recuperação de senha
 * @param {string} to - Endereço de e-mail do destinatário
 * @param {string} token - Código de redefinição de senha
 */
async function enviarTokenPorEmail(to, token) {
  console.log("📬 Preparando envio para:", to);
  console.log("📧 GMAIL_USER:", process.env.GMAIL_USER);

  // Validações básicas
  if (!to) throw new Error("Destinatário (to) não definido");
  if (!token) throw new Error("Token não fornecido");

  // Configura o transporte com Gmail
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });

  // Corpo do e-mail em HTML
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; background-color: #f9f9f9; border-radius: 10px;">
      <h2 style="text-align: center; color: #28a745;">Escola de Aprendizes do Evangelho</h2>
      <p>Olá,</p>
      <p>Você solicitou a redefinição de sua senha. Use o token abaixo para continuar:</p>
      <div style="text-align: center; padding: 20px;">
        <strong style="font-size: 1.5rem; background: #fff; padding: 10px 20px; border-radius: 8px; box-shadow: 0 0 10px #ccc;">${token}</strong>
      </div>
      <p>Este código é válido por <strong>15 minutos</strong>.</p>
      <p style="margin-top: 30px;">Fraternalmente,</p>
      <p><em>Equipe EAE</em></p>
      <hr style="margin-top: 30px; border: none; border-top: 1px solid #ccc;" />
      <p style="font-size: 0.85rem; color: #777; text-align: center;">Este é um e-mail automático. Por favor, não responda.</p>
    </div>
  `;

  // Envia o e-mail
  await transporter.sendMail({
    from: `"Escola de Aprendizes" <${process.env.GMAIL_USER}>`,
    to,
    subject: "Recuperação de senha",
    html,
  });

  console.log(`✅ E-mail de token enviado com sucesso para: ${to}`);
}

module.exports = { enviarTokenPorEmail };
