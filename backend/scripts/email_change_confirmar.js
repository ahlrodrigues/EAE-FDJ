require("dotenv").config();
const { validarLoginCore } = require("../handlers/loginHandler");
const { confirmarTrocaCore } = require("../handlers/emailChangeHandler");

(async () => {
  const [emailAtual, senhaAtual, token] = process.argv.slice(2);
  if (!emailAtual || !senhaAtual || !token) {
    console.error("Uso: node backend/scripts/email_change_confirmar.js <emailAtual> <senhaAtual> <token>");
    process.exit(1);
  }
  await validarLoginCore(emailAtual, senhaAtual);
  const r = await confirmarTrocaCore(token);
  console.log("[TEST] confirmarTroca =>", r);
})();
