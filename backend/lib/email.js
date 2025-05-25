const nodemailer = require("nodemailer");

const GMAIL_USER = process.env.GMAIL_USER || "eae.cpct@gmail.com";
const GMAIL_PASS = process.env.GMAIL_PASS || "eoevzkvgnijmsxyx";

const URL_IMAGEM_TREVO = "https://geea.com.br/imagem/trevo.png";

//Email de troca de senha
async function enviarEmailRedefinicao(emailDestino, token) {
  console.log(`📤 Enviando token para ${emailDestino}...`);

  const transport = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_PASS,
    },
  });

  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
      <div style="text-align: center; margin-bottom: 20px;">
        <img src="${URL_IMAGEM_TREVO}" alt="Trevo" style="max-width: 100px;" />
      </div>

      <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
        <h2 style="margin-top: 0;">Redefinição de Senha</h2>
        <p>Você solicitou a redefinição de senha da Escola de Aprendizes.</p>
        <p>Use o seguinte token para redefinir sua senha:</p>

        <div style="background-color: #ecfae0; padding: 16px; font-size: 24px; font-weight: bold; text-align: center; border-radius: 8px; border: 1px dashed #28a745;">
          ${token}
        </div>

        <p style="margin-top: 20px;">Este token expira em 15 minutos.</p>
        <p>Se você não solicitou, pode ignorar este e-mail.</p>
      </div>

      <p style="text-align: center; font-size: 12px; color: #888; margin-top: 30px;">
        Escola de Aprendizes do Evangelho
      </p>
    </div>
  `;

  const info = await transport.sendMail({
    from: `"Escola de Aprendizes" <${GMAIL_USER}>`,
    to: emailDestino,
    subject: "Token de Redefinição de Senha",
    html,
  });

  console.log(`✅ E-mail enviado: ${info.messageId}`);
}

//Email de confirmação de troca de senha
async function enviarEmailConfirmacaoRedefinicao(emailDestino) {
    console.log(`📤 Enviando e-mail de confirmação para ${emailDestino}...`);
  
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="${URL_IMAGEM_TREVO}" alt="Trevo" style="max-width: 100px;" />
        </div>
  
        <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
          <h2 style="margin-top: 0;">Senha Redefinida com Sucesso</h2>
          <p>Sua senha foi alterada com sucesso para a Escola de Aprendizes.</p>
  
          <div style="background-color: #d4edda; padding: 16px; font-size: 18px; text-align: center; border-radius: 8px; border: 1px solid #28a745; color: #155724;">
            Agora você já pode acessar com sua nova senha!
          </div>
  
          <p style="margin-top: 20px;">Se não foi você quem solicitou essa mudança, por favor entre em contato imediatamente.</p>
        </div>
  
        <p style="text-align: center; font-size: 12px; color: #888; margin-top: 30px;">
          Escola de Aprendizes do Evangelho
        </p>
      </div>
    `;
  
    const info = await transport.sendMail({
      from: `"Escola de Aprendizes" <${GMAIL_USER}>`,
      to: emailDestino,
      subject: "Senha Redefinida com Sucesso",
      html,
    });
  
    console.log(`✅ E-mail de confirmação enviado: ${info.messageId}`);
}
  
module.exports = {
    enviarEmailRedefinicao,
    enviarEmailConfirmacaoRedefinicao
};
  