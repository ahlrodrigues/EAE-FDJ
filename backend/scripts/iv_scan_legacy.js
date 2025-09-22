#!/usr/bin/env node
// Lista tudo que ainda parece IV=16 (legado)

require("dotenv").config();


const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const CRYPTO_SECRET = process.env.CRYPTO_SECRET;
if (!CRYPTO_SECRET) { console.error("CRYPTO_SECRET ausente."); process.exit(1); }

function baseDir() { return path.join(process.env.HOME || os.homedir(), ".config", "escola-aprendizes"); }
function listDirs(p) {
  try { return fs.readdirSync(p, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name); }
  catch { return []; }
}
function listFilesRec(dir) {
  const out = [];
  (function rec(d) {
    let ents=[]; try { ents=fs.readdirSync(d,{withFileTypes:true}); } catch { return; }
    for (const e of ents) {
      const p = path.join(d,e.name);
      if (e.isDirectory()) rec(p); else out.push(p);
    }
  })(dir);
  return out;
}

function tryIvLen(raw) {
  const buf = Buffer.from(raw, "base64");
  const key = crypto.createHash("sha256").update(CRYPTO_SECRET).digest();

  const tryDec = (ivLen) => {
    const iv=buf.subarray(0,ivLen), tag=buf.subarray(ivLen,ivLen+16), data=buf.subarray(ivLen+16);
    const d=crypto.createDecipheriv("aes-256-gcm", key, iv); d.setAuthTag(tag);
    d.update(data); d.final(); return ivLen;
  };

  try { return tryDec(12); } catch {}
  try { return tryDec(16); } catch {}
  return null;
}

function scan() {
  const out = [];
  const roots = [
    path.join(baseDir(),"notas"),
    path.join(baseDir(),"temas"),
  ];
  for (const r of roots) {
    const users = listDirs(r);
    for (const u of users) {
      const files = listFilesRec(path.join(r,u)).filter(f => f.endsWith(".txt"));
      for (const f of files) {
        try {
          const raw = fs.readFileSync(f,"utf-8").trim();
          const len = tryIvLen(raw);
          if (len === 16) out.push(f);
        } catch {}
      }
    }
  }
  // Configs
  const cfgRoot = path.join(baseDir(),"config","usuarios");
  let cfgFiles = []; try { cfgFiles = fs.readdirSync(cfgRoot).filter(n=>n.endsWith(".json")).map(n=>path.join(cfgRoot,n)); } catch {}
  for (const cf of cfgFiles) {
    try {
      const j = JSON.parse(fs.readFileSync(cf,"utf-8"));
      for (const [k,v] of Object.entries(j)) {
        if (typeof v === "string" && v.length>30 && /^[A-Za-z0-9+/=\r\n]+$/.test(v.trim())) {
          const len = tryIvLen(v);
          if (len === 16) out.push(`${cf}::${k}`);
        }
      }
    } catch {}
  }
  return out;
}

const legacy = scan();
if (!legacy.length) {
  console.log("✅ Nenhum IV=16 encontrado.");
} else {
  console.log("⚠️ Restos IV=16:");
  for (const p of legacy) console.log(" -", p);
  process.exit(2);
}
