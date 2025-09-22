#!/usr/bin/env node
// ============================================================================
// Reseta a senha de um usuário (bcrypt) no modelo novo (sem legado)
// - Encontra o usuário por --email=<email> (decifrando emailCriptografado) OU
//   diretamente por --hash=<sha256>.
// - Atualiza updatedAt e incrementa versao.
// Uso:
//   node backend/scripts/reset_password_user.js --email=<email> --newpass="<NovaSenha>"
//   node backend/scripts/reset_password_user.js --hash=<sha256hex> --newpass="<NovaSenha>"
// Requer: para --email, é recomendável CRYPTO_SECRET no .env para decifrar o e-mail.
// ============================================================================

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

let descriptografarComMestra = null;
try { ({ descriptografarComMestra } = require("../lib/criptografia")); } catch {}

const LOG = "[RESET-PW]";
const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, "").split("=");
  return [k, v ?? true];
}));

const emailArg = args.email ? String(args.email).trim() : null;
const hashArg  = args.hash ? String(args.hash).trim() : null;
const newPass  = args.newpass;

if (!newPass) {
  console.error(`${LOG} Uso:
  node backend/scripts/reset_password_user.js --email=<email> --newpass="<NovaSenha>"
  node backend/scripts/reset_password_user.js --hash=<sha256hex> --newpass="<NovaSenha>"`);
  process.exit(1);
}

function emailToHash(email) {
  const norm = String(email || "").trim().toLowerCase();
  if (!norm.includes("@")) return null;
  return crypto.createHash("sha256").update(norm, "utf8").digest("hex");
}
function userDir() {
  return path.join(process.env.HOME || os.homedir(), ".config", "escola-aprendizes", "config", "usuarios");
}
function userPath(hash) {
  return path.join(userDir(), `${hash}.json`);
}
function listUserFiles() {
  try { return fs.readdirSync(userDir()).filter(n => n.endsWith(".json")).map(n => path.join(userDir(), n)); }
  catch { return []; }
}

async function findByEmail(email) {
  const files = listUserFiles();
  const want = email.trim().toLowerCase();
  for (const f of files) {
    try {
      const j = JSON.parse(fs.readFileSync(f, "utf-8"));
      if (!j.emailCriptografado || !descriptografarComMestra || !process.env.CRYPTO_SECRET) continue;
      const dec = descriptografarComMestra(j.emailCriptografado, process.env.CRYPTO_SECRET);
      if (String(dec).trim().toLowerCase() === want) {
        return { file: f, hash: path.basename(f, ".json"), user: j };
      }
    } catch { /* continua */ }
  }
  return null;
}

(async () => {
  try {
    let target = null;

    if (hashArg) {
      const p = userPath(hashArg);
      if (!fs.existsSync(p)) {
        console.error(`${LOG} ❌ Usuário não encontrado por hash: ${p}`);
        process.exit(2);
      }
      target = { file: p, hash: hashArg, user: JSON.parse(fs.readFileSync(p, "utf-8")) };
    } else if (emailArg) {
      const found = await findByEmail(emailArg);
      if (!found) {
        const expected = emailToHash(emailArg);
        console.error(`${LOG} ❌ Usuário não encontrado por e-mail.
Hash esperado: ${expected}
Caminho esperado: ${userPath(expected)}
Dica: rode "node backend/scripts/find_user_by_email.js ${emailArg}" para localizar.`);
        process.exit(3);
      }
      target = found;
    } else {
      console.error(`${LOG} ❌ Informe --email ou --hash.`);
      process.exit(4);
    }

    const nowISO = new Date().toISOString();
    const newHash = await bcrypt.hash(newPass, 10);
    target.user.senhaCriptografada = newHash;
    target.user.updatedAt = nowISO;
    target.user.versao = typeof target.user.versao === "number" ? (target.user.versao + 1) : 1;

    fs.writeFileSync(target.file, JSON.stringify(target.user, null, 2), "utf-8");
    console.log(`${LOG} ✅ Senha resetada.
hash=${target.hash}
arquivo=${target.file}`);
  } catch (e) {
    console.error(`${LOG} ❌ Falha: ${e.message}`);
    process.exit(5);
  }
})();
