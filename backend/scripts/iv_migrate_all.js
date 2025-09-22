#!/usr/bin/env node
// ============================================================================
// Caminho: backend/scripts/iv_migrate_all.js
// Uso:     node backend/scripts/iv_migrate_all.js
// Pré-req: CRYPTO_SECRET no ambiente
// Ação:    Recriptografa (16 -> 12) tudo em notas/temas e campos cifrados em
//          config/usuarios/*.json, para TODOS os emailHash encontrados.
// Logs:    Mostra contagens por usuário e totais.
// ============================================================================


require("dotenv").config();

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const LOG = "[IV-MIG-ALL]";
const CRYPTO_SECRET = process.env.CRYPTO_SECRET;
if (!CRYPTO_SECRET) {
  console.error(`${LOG} ❌ CRYPTO_SECRET ausente no ambiente.`);
  process.exit(1);
}

// Ajuste conforme seus campos realmente cifrados:
const ENCRYPTED_KEYS = [
  "codigoTemas", "telefone", "nome", "endereco", "cidade", "estado"
];

function baseDir() {
  return path.join(process.env.HOME || os.homedir(), ".config", "escola-aprendizes");
}
function notasRoot() { return path.join(baseDir(), "notas"); }
function temasRoot() { return path.join(baseDir(), "temas"); }
function cfgRoot()   { return path.join(baseDir(), "config", "usuarios"); }

function listDirs(p) {
  try { return fs.readdirSync(p, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name); }
  catch { return []; }
}

function listFilesRec(dir) {
  const out = [];
  (function rec(d) {
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) rec(p); else out.push(p);
    }
  })(dir);
  return out;
}

function cipher12(plain) {
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash("sha256").update(CRYPTO_SECRET).digest();
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([c.update(String(plain), "utf8"), c.final()]);
  const tag = c.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function decipherCompat(b64) {
  const buf = Buffer.from(b64, "base64");
  const key = crypto.createHash("sha256").update(CRYPTO_SECRET).digest();
  const tryDec = (ivLen) => {
    const iv   = buf.subarray(0, ivLen);
    const tag  = buf.subarray(ivLen, ivLen + 16);
    const data = buf.subarray(ivLen + 16);
    const d = crypto.createDecipheriv("aes-256-gcm", key, iv);
    d.setAuthTag(tag);
    const out = Buffer.concat([d.update(data), d.final()]);
    return out.toString("utf8");
  };
  try { return { text: tryDec(12), ivLen: 12 }; } catch {}
  return { text: tryDec(16), ivLen: 16 };
}

function detectIvLen(b64) {
  try {
    const { ivLen } = decipherCompat(b64);
    return ivLen; // 12 ou 16
  } catch { return null; }
}

function probablyB64(s) {
  return typeof s === "string" && s.length > 30 && /^[A-Za-z0-9+/=\r\n]+$/.test(s.trim());
}

async function migrateUser(emailHash) {
  const notasDir = path.join(notasRoot(), emailHash);
  const temasDir = path.join(temasRoot(), emailHash);
  const cfgFile  = path.join(cfgRoot(), `${emailHash}.json`);

  const stats = { notas: {re:0, sk:0}, temas: {re:0, sk:0}, cfg: {re:0, sk:0} };

  // Notas
  if (fs.existsSync(notasDir)) {
    const files = listFilesRec(notasDir).filter(f => f.endsWith(".txt"));
    for (const f of files) {
      try {
        const raw = fs.readFileSync(f, "utf-8").trim();
        const ivLen = detectIvLen(raw);
        if (ivLen === 16) {
          const { text } = decipherCompat(raw);
          const novo = cipher12(text);
          fs.writeFileSync(f, novo, "utf-8");
          stats.notas.re++;
        } else {
          stats.notas.sk++;
        }
      } catch { stats.notas.sk++; }
    }
  }

  // Temas
  if (fs.existsSync(temasDir)) {
    const files = listFilesRec(temasDir).filter(f => f.endsWith(".txt"));
    for (const f of files) {
      try {
        const raw = fs.readFileSync(f, "utf-8").trim();
        const ivLen = detectIvLen(raw);
        if (ivLen === 16) {
          const { text } = decipherCompat(raw);
          const novo = cipher12(text);
          fs.writeFileSync(f, novo, "utf-8");
          stats.temas.re++;
        } else {
          stats.temas.sk++;
        }
      } catch { stats.temas.sk++; }
    }
  }

  // Config (campos cifrados)
  if (fs.existsSync(cfgFile)) {
    try {
      const json = JSON.parse(fs.readFileSync(cfgFile, "utf-8"));
      let changed = 0, skipped = 0;
      for (const k of ENCRYPTED_KEYS) {
        if (!(k in json)) { skipped++; continue; }
        const v = json[k];
        if (!probablyB64(v)) { skipped++; continue; }
        const ivLen = detectIvLen(v);
        if (ivLen === 16) {
          const { text } = decipherCompat(v);
          json[k] = cipher12(text);
          changed++;
        } else {
          skipped++;
        }
      }
      if (changed) fs.writeFileSync(cfgFile, JSON.stringify(json, null, 2), "utf-8");
      stats.cfg.re += changed;
      stats.cfg.sk += skipped;
    } catch { /* ignora */ }
  }

  return stats;
}

(async () => {
  const usersByNotas = listDirs(notasRoot());
  const usersByTemas = listDirs(temasRoot());
  const usersByCfg   = (function() {
    try { return fs.readdirSync(cfgRoot()).filter(n => n.endsWith(".json")).map(n => n.replace(/\.json$/, "")); }
    catch { return []; }
  })();

  const all = Array.from(new Set([...usersByNotas, ...usersByTemas, ...usersByCfg]));

  console.log(`${LOG} Usuários detectados: ${all.length}`);
  let total = { notas:0, temas:0, cfg:0 };

  for (const emailHash of all) {
    const s = await migrateUser(emailHash);
    console.log(`${LOG} ${emailHash} → notas(re=${s.notas.re},sk=${s.notas.sk}) temas(re=${s.temas.re},sk=${s.temas.sk}) cfg(re=${s.cfg.re},sk=${s.cfg.sk})`);
    total.notas += s.notas.re;
    total.temas += s.temas.re;
    total.cfg   += s.cfg.re;
  }

  console.log(`${LOG} ✅ Migração concluída. Recriptografados: notas=${total.notas}, temas=${total.temas}, cfg=${total.cfg}`);
})();
