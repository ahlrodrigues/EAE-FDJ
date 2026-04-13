// =============================================================================
// Caminho: backend/lib/syncCursorStore.js
// Objetivo: persistir cursores ("último visto") para pacotes incrementais.
//
// Modelo (JSON):
//   ~/.config/escola-aprendizes/sync/cursors.json
//   {
//     "<key>": { "cursorISO": "2026-04-13T10:00:00.000Z", "updatedAtISO": "..." }
//   }
// =============================================================================

const fsp = require("fs/promises");
const path = require("path");
const os = require("os");

function baseDir() {
  const home = process.env.HOME || process.env.USERPROFILE || os.homedir();
  return path.join(home, ".config", "escola-aprendizes", "sync");
}

function cursorsPath() {
  return path.join(baseDir(), "cursors.json");
}

async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true });
}

async function readAll() {
  const p = cursorsPath();
  try {
    const raw = await fsp.readFile(p, "utf8");
    const j = JSON.parse(raw || "{}");
    return (j && typeof j === "object") ? j : {};
  } catch (e) {
    if (e?.code === "ENOENT") return {};
    throw e;
  }
}

async function writeAll(obj) {
  const dir = baseDir();
  await ensureDir(dir);
  const p = cursorsPath();
  const tmp = `${p}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(obj, null, 2), "utf8");
  await fsp.rename(tmp, p);
}

async function getCursor(key) {
  const all = await readAll();
  const rec = all[String(key || "").trim()] || null;
  const cursorISO = String(rec?.cursorISO || "").trim();
  return cursorISO || null;
}

async function setCursor(key, cursorISO) {
  const k = String(key || "").trim();
  if (!k) throw new Error("cursor key inválida");
  const iso = String(cursorISO || "").trim();
  if (!iso) throw new Error("cursorISO inválido");

  const all = await readAll();
  all[k] = { cursorISO: iso, updatedAtISO: new Date().toISOString() };
  await writeAll(all);
  return true;
}

module.exports = { baseDir, cursorsPath, getCursor, setCursor };

