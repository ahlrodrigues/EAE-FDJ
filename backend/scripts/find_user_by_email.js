#!/usr/bin/env node
// ============================================================================
// Localiza o arquivo do usuário a partir do e-mail (ou lista todos)
// - Procura em ~/.config/escola-aprendizes/config/usuarios/*.json
// - Se CRYPTO_SECRET estiver setado, tenta decifrar emailCriptografado p/ comparar
// Uso:
//   node backend/scripts/find_user_by_email.js <email>
//   node backend/scripts/find_user_by_email.js           (lista todos)
// ============================================================================

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

let descriptografarComMestra = null;
try {
  ({ descriptografarComMestra } = require("../lib/criptografia"));
} catch { /* ok sem decript se for só listar */ }

const LOG = "[FIND-USER]";
const BASE = path.join(process.env.HOME || os.homedir(), ".config", "escola-aprendizes", "config", "usuarios");
const emailArg = (process.argv[2] || "").trim();

function emailToHash(email) {
  const norm = String(email || "").trim().toLowerCase();
  if (!norm.includes("@")) return null;
  return crypto.createHash("sha256").update(norm, "utf8").digest("hex");
}
function listUserFiles() {
  try { return fs.readdirSync(BASE).filter(n => n.endsWith(".json")).map(n => path.join(BASE, n)); }
  catch { return []; }
}

const files = listUserFiles();
if (!files.length) {
  console.log(`${LOG} ⚠️ Nenhum arquivo de usuário em ${BASE}`);
  process.exit(2);
}

(async () => {
  const rows = [];
  for (const f of files) {
    try {
      const j = JSON.parse(fs.readFileSync(f, "utf-8"));
      const hash = path.basename(f, ".json");
      let dec = null;
      if (j.emailCriptografado && descriptografarComMestra && process.env.CRYPTO_SECRET) {
        try { dec = descriptografarComMestra(j.emailCriptografado, process.env.CRYPTO_SECRET); } catch {}
      }
      rows.push({ file: f, hash, email: dec });
    } catch (e) {
      console.warn(`${LOG} ⚠️ Ignorando ${f}: ${e.message}`);
    }
  }

  if (!emailArg) {
    console.log(`${LOG} Usuários encontrados (${rows.length}):`);
    for (const r of rows) {
      const shown = r.email ? (r.email[0] + "***@" + r.email.split("@")[1]) : "(email cifrado indisponível)";
      console.log(` - ${r.hash.slice(0,8)}…  ${shown}  → ${r.file}`);
    }
    process.exit(0);
  }

  const targetHash = emailToHash(emailArg);
  for (const r of rows) {
    const eq = r.email && r.email.trim().toLowerCase() === emailArg.trim().toLowerCase();
    if (eq || r.hash === targetHash) {
      console.log(`${LOG} ✅ Encontrado:
hash=${r.hash}
arquivo=${r.file}
email=${r.email || "(não verificado)"}`);
      process.exit(0);
    }
  }

  console.log(`${LOG} ❌ Não encontrado por e-mail. Hash esperado: ${targetHash}
Caminho esperado: ${path.join(BASE, `${targetHash}.json`)}
Dica: confira variações do e-mail (pontos/alias) e rode sem argumentos para listar todos.`);
  process.exit(3);
})();
