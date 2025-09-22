#!/usr/bin/env node
// ============================================================================
// Scanner VERBOSE de notas/temas para detectar formato de criptografia
// - Varre ~/.config/escola-aprendizes*, incluindo .bak* e "-final"
// - Classifica arquivos: iv12, iv16, json_crypto, plaintext, b64_unknown
// - Requer CRYPTO_SECRET para tentativa de decriptação (para validar iv12/iv16)
// Uso:
//   node backend/scripts/iv_scan_verbose.js [--all-ext]
// ============================================================================

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const LOG = "[IV-SCAN-VERBOSE]";
const CRYPTO_SECRET = process.env.CRYPTO_SECRET;
if (!CRYPTO_SECRET) {
  console.error(`${LOG} ❌ CRYPTO_SECRET ausente no ambiente (.env).`);
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const ALL_EXT = args.has("--all-ext"); // por padrão só .txt

const KEY = crypto.createHash("sha256").update(CRYPTO_SECRET).digest();

function listConfigRoots() {
  const baseCfg = path.join(process.env.HOME || os.homedir(), ".config");
  let dirs = [];
  try {
    dirs = fs.readdirSync(baseCfg, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => path.join(baseCfg, e.name));
  } catch {}
  // pegar tudo que começa com "escola-aprendizes"
  return dirs.filter(d => /\/escola-aprendizes/.test(d));
}

function listFilesRec(dir) {
  const out = [];
  (function rec(d) {
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) rec(p);
      else out.push(p);
    }
  })(dir);
  return out;
}

function isProbablyBase64(s) {
  return typeof s === "string" && s.length > 30 && /^[A-Za-z0-9+/=\r\n]+$/.test(s.trim());
}

function decryptTry(b64, ivLen) {
  const buf = Buffer.from(b64, "base64");
  const iv  = buf.subarray(0, ivLen);
  const tag = buf.subarray(ivLen, ivLen + 16);
  const dat = buf.subarray(ivLen + 16);
  const d = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  d.setAuthTag(tag);
  d.update(dat);
  d.final();
  return true;
}

function classifyContent(raw) {
  const t = raw.trim();

  // JSON crypto? (ex.: {"iv":"...","ct":"...","tag":"..."})
  if (t.startsWith("{") && /"(iv|nonce)".+("(ct|cipher|data)")/i.test(t)) {
    return "json_crypto";
  }

  // Base64? tenta iv12 → iv16
  if (isProbablyBase64(t)) {
    const buf = Buffer.from(t, "base64");
    if (buf.length >= 12 + 16 + 1) {
      try { if (decryptTry(t, 12)) return "iv12"; } catch {}
      if (buf.length >= 16 + 16 + 1) {
        try { if (decryptTry(t, 16)) return "iv16"; } catch {}
      }
      return "b64_unknown";
    }
    return "b64_unknown";
  }

  // Se não é base64 e não parece JSON -> provavelmente texto puro
  return "plaintext";
}

function scanRoot(root) {
  const result = {};
  const candidatos = ["notas", "temas"];
  for (const sub of candidatos) {
    const base = path.join(root, sub);
    if (!fs.existsSync(base)) continue;

    // usuários (subpastas por hash)
    let users = [];
    try {
      users = fs.readdirSync(base, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => e.name);
    } catch {}

    for (const u of users) {
      const dir = path.join(base, u);
      const files = listFilesRec(dir).filter(f => ALL_EXT ? true : f.endsWith(".txt"));

      for (const f of files) {
        let cls = "unknown";
        try {
          const raw = fs.readFileSync(f, "utf-8");
          cls = classifyContent(raw);
        } catch (e) {
          cls = `err:${e.code || "read"}`;
        }
        result[root] ||= {};
        result[root][sub] ||= {};
        result[root][sub][u] ||= {};
        result[root][sub][u][cls] = (result[root][sub][u][cls] || 0) + 1;
      }
    }
  }
  return result;
}

(function main(){
  const roots = listConfigRoots(); // pega todos "escola-aprendizes*"
  if (!roots.length) {
    console.log(`${LOG} Nenhum diretório "escola-aprendizes*" encontrado em ~/.config`);
    process.exit(0);
  }

  console.log(`${LOG} Raízes detectadas:`);
  for (const r of roots) console.log(" -", r);

  let any = false;
  for (const r of roots) {
    const res = scanRoot(r);
    const buckets = res[r] || {};
    const subs = Object.keys(buckets);
    if (!subs.length) continue;

    any = true;
    console.log(`\n${LOG} ▶ ${r}`);
    for (const sub of subs) {
      const users = Object.keys(buckets[sub]);
      console.log(`  ${sub}/  (users=${users.length})`);
      for (const u of users) {
        const classes = buckets[sub][u];
        const summary = Object.entries(classes).map(([k,v]) => `${k}:${v}`).join(", ");
        console.log(`    - ${u}: ${summary}`);
      }
    }
  }

  if (!any) {
    console.log(`${LOG} Nada para relatar (sem notas/temas encontradas).`);
  }

  console.log(`\n${LOG} Dicas: use "--all-ext" se seus arquivos não forem .txt`);
})();
