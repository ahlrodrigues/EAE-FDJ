require("dotenv").config();
const { validarLoginCore } = require("../handlers/loginHandler");
const { iniciarTrocaCore } = require("../handlers/emailChangeHandler");

(async () => {
  const [emailAtual, senhaAtual, novoEmail] = process.argv.slice(2);
  if (!emailAtual || !senhaAtual || !novoEmail) {
    console.error("Uso: node backend/scripts/email_change_iniciar.js <emailAtual> <senhaAtual> <novoEmail>");
    process.exit(1);
  }
  const login = await validarLoginCore(emailAtual, senhaAtual);
  console.log("[TEST] login =>", login);
  const r = await iniciarTrocaCore(novoEmail, senhaAtual);
  console.log("[TEST] iniciarTroca =>", r);
})();
