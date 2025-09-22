#!/usr/bin/env node
// ============================================================================
// Caminho: backend/scripts/encrypt_plain_notes.js
// Objetivo: Converter arquivos plaintext em notas/ e temas/ para AES-256-GCM
//           com IV=12 (base64 no formato [iv||tag||ct]).
// Uso:
//   node backend/scripts/encrypt_plain_notes.js
//   node backend/scripts/encrypt_plain_notes.js --emailHash=<hash>
//   node backend/scripts/encrypt_plain_notes.js --all-ext
// Pré-requisitos: .env com CRYPTO_SECRET ou CRYPTO_SECRET exportado no ambiente.
// Logs: claros, com contagem de convertidos/pulados/erros.
// ============================================================================

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const LOG = "[ENC-PLAIN]";
const CRYPTO_SECRET = process.env.CRYPTO_SECRET;
if (!CRYPTO_SECRET) {
  console.error(`${LOG} ❌ CRYPTO_SECRET ausente. Defina no .env ou export.`);
  process.exit(1);
}

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);
const ONLY_HASH = args.emailHash || null;
const ALL_EXT = !!args["all-ext"];

const KEY = crypto.createHash("sha256").update(CRYPTO_SECRET).digest();

function baseDir() {
  return path.join(process.env.HOME || os.homedir(), ".config", "escola-aprendizes");
}
function notasRoot() { return path.join(baseDir(), "notas"); }
function temasRoot() { return path.join(baseDir(), "temas"); }

function listDirs(p) {
  try {
    return fs.readdirSync(p, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);
  } catch {
    return [];
  }
}
function listFilesRec(dir) {
  const out = [];
  (function rec(d){
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) rec(p); else out.push(p);
    }
  })(dir);
  return out;
}

// --- Criptografia (IV=12) ---
function encryptIv12(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function isProbablyBase64(s) {
  return typeof s === "string" && s.length > 30 && /^[A-Za-z0-9+/=\r\n]+$/.test(s.trim());
}
function isIv12Encrypted(b64) {
  try {
    const buf = Buffer.from(b64, "base64");
    if (buf.length < 12 + 16 + 1) return false;
    const iv  = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const dat = buf.subarray(28);
    const d = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
    d.setAuthTag(tag);
    d.update(dat);
    d.final(); // não lançou → ok
    return true;
  } catch {
    return false;
  }
}

function classify(raw) {
  const t = raw.trim();
  if (isProbablyBase64(t) && isIv12Encrypted(t)) return "iv12";
  if (t.startsWith("{") && /"(iv|nonce)".+("(ct|cipher|data)")/i.test(t)) return "json_crypto";
  return "plaintext";
}

function usersToProcess() {
  const uNotas = listDirs(notasRoot());
  const uTemas = listDirs(temasRoot());
  const all = Array.from(new Set([...uNotas, ...uTemas]));
  return ONLY_HASH ? all.filter(h => h === ONLY_HASH) : all;
}

async function convertDir(label, dir) {
  if (!fs.existsSync(dir)) return { converted: 0, skipped: 0, errors: 0 };
  const files = listFilesRec(dir).filter(f => ALL_EXT ? true : f.endsWith(".txt"));
  let converted = 0, skipped = 0, errors = 0;

  for (const f of files) {
    try {
      const raw = fs.readFileSync(f, "utf-8");
      const kind = classify(raw);

      if (kind === "iv12") {
        skipped++;
        continue;
      }
      if (kind === "json_crypto") {
        console.warn(`${LOG} ⚠️ ${label}: formato JSON cifrado não suportado por este script -> ${f}`);
        skipped++;
        continue;
      }
      // plaintext → cifrar
      const enc = encryptIv12(raw);
      fs.writeFileSync(f, enc, "utf-8");
      console.log(`${LOG} 🔒 ${label}: cifrado → ${f}`);
      converted++;
    } catch (e) {
      console.error(`${LOG} ❌ ${label}: erro em ${f}: ${e.message}`);
      errors++;
    }
  }
  return { converted, skipped, errors };
}

(async () => {
  const users = usersToProcess();
  if (!users.length) {
    console.log(`${LOG} Nada a converter (sem usuários em notas/temas).`);
    process.exit(0);
  }

  console.log(`${LOG} Usuários: ${users.length} ${ONLY_HASH ? `(filtrado por ${ONLY_HASH})` : ""}`);
  let total = { converted: 0, skipped: 0, errors: 0 };

  for (const hash of users) {
    const notasDir = path.join(notasRoot(), hash);
    const temasDir = path.join(temasRoot(), hash);

    console.log(`${LOG} ► ${hash}`);
    const s1 = await convertDir("notas", notasDir);
    const s2 = await convertDir("temas", temasDir);
    const sum = {
      converted: s1.converted + s2.converted,
      skipped:   s1.skipped   + s2.skipped,
      errors:    s1.errors    + s2.errors
    };
    console.log(`${LOG} ${hash} => conv=${sum.converted} skip=${sum.skipped} err=${sum.errors}`);

    total.converted += sum.converted;
    total.skipped   += sum.skipped;
    total.errors    += sum.errors;
  }

  console.log(`${LOG} ✅ Concluído. Total: conv=${total.converted} skip=${total.skipped} err=${total.errors}`);
})();
