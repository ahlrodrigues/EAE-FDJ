// =============================================================================
// Caminho: backend/lib/incrementalAlunoPackage.js
// Objetivo: gerar payload incremental (aluno → dirigente) a partir de stores locais:
//  - temas (respostas do aluno)
//  - anotações
//  - testes (futuro; hoje lê diretório se existir)
//  - certificados (futuro; hoje lê diretório se existir)
//
// Importante:
//  - O payload retornado aqui é em claro (DEV). A criptografia por destinatário
//    deve encapsular este payload como ciphertext num passo posterior.
// =============================================================================

const fsp = require("fs/promises");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const { descriptografarComMestra } = require("./criptografia");

function homeDir() {
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

function baseConfigDir() {
  return path.join(homeDir(), ".config", "escola-aprendizes");
}

function dirFor(kind, emailHash) {
  const eh = String(emailHash || "").trim();
  if (!/^[a-f0-9]{64}$/i.test(eh)) throw new Error("emailHash inválido");
  return path.join(baseConfigDir(), kind, eh);
}

function notasDir(emailHash) {
  return dirFor("notas", emailHash);
}

function temasDir(emailHash) {
  return dirFor("temas", emailHash);
}

function testesDir(emailHash) {
  return dirFor("testes", emailHash);
}

function certificadosDir(emailHash) {
  return dirFor("certificados", emailHash);
}

function kdf(secret) {
  if (!secret) throw new Error("CRYPTO_SECRET ausente");
  return crypto.createHash("sha256").update(String(secret), "utf8").digest(); // 32 bytes
}

// Formato notas: base64("iv(12) | tag(16) | cipher")
function decifrarNotaB64(payloadB64, secret) {
  const key = kdf(secret);
  const buf = Buffer.from(String(payloadB64 || ""), "base64");
  if (buf.length < 12 + 16 + 1) throw new Error("nota criptografada inválida");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
}

function parseJsonSafe(s) {
  try { return JSON.parse(String(s || "")); } catch { return null; }
}

function isoFromMs(ms) {
  try { return new Date(ms).toISOString(); } catch { return null; }
}

async function listFiles(dir) {
  try {
    const ents = await fsp.readdir(dir, { withFileTypes: true });
    return ents.filter((e) => e.isFile()).map((e) => e.name);
  } catch (e) {
    if (e?.code === "ENOENT") return [];
    throw e;
  }
}

async function statSafe(p) {
  try { return await fsp.stat(p); } catch { return null; }
}

async function readText(p) {
  return await fsp.readFile(p, "utf8");
}

async function readBin(p) {
  return await fsp.readFile(p);
}

function isAfterCursor(mtimeMs, cursorISO) {
  if (!cursorISO) return true;
  const t = Date.parse(String(cursorISO));
  if (!Number.isFinite(t)) return true;
  return Number(mtimeMs || 0) > t;
}

async function exportTemas({ emailHash, cursorISO, cryptoSecret }) {
  const dir = temasDir(emailHash);
  const names = (await listFiles(dir)).filter((n) => n.toLowerCase().endsWith(".txt"));

  const out = [];
  for (const name of names) {
    const p = path.join(dir, name);
    const st = await statSafe(p);
    if (!st) continue;
    if (!isAfterCursor(st.mtimeMs, cursorISO)) continue;

    const raw = await readText(p);
    let plain = null;
    try {
      plain = descriptografarComMestra(raw, cryptoSecret);
    } catch {
      plain = raw;
    }
    const parsed = parseJsonSafe(plain);
    out.push({
      id: name,
      updatedAtISO: isoFromMs(st.mtimeMs),
      kind: parsed ? "json" : "text",
      data: parsed ?? plain,
    });
  }

  return out;
}

async function exportNotas({ emailHash, cursorISO, cryptoSecret }) {
  const dir = notasDir(emailHash);
  const names = (await listFiles(dir)).filter((n) => n.toLowerCase().endsWith(".txt"));
  const out = [];

  for (const name of names) {
    const p = path.join(dir, name);
    const st = await statSafe(p);
    if (!st) continue;
    if (!isAfterCursor(st.mtimeMs, cursorISO)) continue;

    const b64 = await readText(p);
    const texto = decifrarNotaB64(b64, cryptoSecret);
    out.push({
      id: name,
      updatedAtISO: isoFromMs(st.mtimeMs),
      data: texto,
    });
  }

  return out;
}

async function exportTestes({ emailHash, cursorISO }) {
  const dir = testesDir(emailHash);
  const names = await listFiles(dir);
  const out = [];

  for (const name of names) {
    const p = path.join(dir, name);
    const st = await statSafe(p);
    if (!st) continue;
    if (!isAfterCursor(st.mtimeMs, cursorISO)) continue;

    // DEV: aceita .json (texto) ou qualquer outro como base64
    if (name.toLowerCase().endsWith(".json")) {
      const raw = await readText(p);
      out.push({
        id: name,
        updatedAtISO: isoFromMs(st.mtimeMs),
        kind: "json",
        data: parseJsonSafe(raw) ?? raw,
      });
    } else {
      const buf = await readBin(p);
      out.push({
        id: name,
        updatedAtISO: isoFromMs(st.mtimeMs),
        kind: "bin_b64",
        data: Buffer.from(buf).toString("base64"),
      });
    }
  }

  return out;
}

async function exportCertificados({ emailHash, cursorISO, maxTotalBytes = 8 * 1024 * 1024 }) {
  const dir = certificadosDir(emailHash);
  const names = await listFiles(dir);
  const out = [];

  let total = 0;
  for (const name of names) {
    const p = path.join(dir, name);
    const st = await statSafe(p);
    if (!st) continue;
    if (!isAfterCursor(st.mtimeMs, cursorISO)) continue;
    if (st.size > maxTotalBytes) throw new Error(`certificado muito grande: ${name} (${st.size} bytes)`);
    total += st.size;
    if (total > maxTotalBytes) throw new Error("certificados excederam o limite total do pacote (DEV)");

    const buf = await readBin(p);
    out.push({
      id: name,
      updatedAtISO: isoFromMs(st.mtimeMs),
      fileName: name,
      size: st.size,
      dataB64: Buffer.from(buf).toString("base64"),
    });
  }

  return out;
}

async function buildAlunoIncrementalPayload({ emailHash, cursorFromISO = null }) {
  const cryptoSecret = process.env.CRYPTO_SECRET || process.env.APP_MASTER_KEY || "";
  if (!cryptoSecret) throw new Error("CRYPTO_SECRET ausente (necessário para exportar temas/notas).");

  const temas = await exportTemas({ emailHash, cursorISO: cursorFromISO, cryptoSecret });
  const notas = await exportNotas({ emailHash, cursorISO: cursorFromISO, cryptoSecret });
  const testes = await exportTestes({ emailHash, cursorISO: cursorFromISO });
  const certificados = await exportCertificados({ emailHash, cursorISO: cursorFromISO }).catch((e) => {
    // Certificados ainda não existem em muitos ambientes — não falhar por ENOENT
    if (String(e?.code || "") === "ENOENT") return [];
    throw e;
  });

  const hasAny = temas.length || notas.length || testes.length || certificados.length;
  const cursorToISO = new Date().toISOString();

  return {
    ok: true,
    hasAny,
    cursorFromISO: cursorFromISO || null,
    cursorToISO,
    payload: {
      schemaVersion: 1,
      type: "aluno_incremental_package",
      generatedAtISO: cursorToISO,
      cursorFromISO: cursorFromISO || null,
      cursorToISO,
      resources: { temas, notas, testes, certificados },
    },
  };
}

module.exports = { buildAlunoIncrementalPayload };

