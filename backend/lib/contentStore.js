// =============================================================================
// Caminho: backend/lib/contentStore.js
// Objetivo: persistência local do conteúdo baixado do site (manifest + itens).
// Modelo:
//   ~/.config/escola-aprendizes/content/<turmaId>/
//     manifest.json
//     items/<type>/<id>.json
// =============================================================================

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const os = require("os");

function baseDir() {
  const home = process.env.HOME || process.env.USERPROFILE || os.homedir();
  return path.join(home, ".config", "escola-aprendizes", "content");
}

function turmaDir(turmaId) {
  return path.join(baseDir(), String(turmaId || "").trim());
}

function manifestPath(turmaId) {
  return path.join(turmaDir(turmaId), "manifest.json");
}

function itemPath(turmaId, type, id) {
  return path.join(turmaDir(turmaId), "items", String(type || "misc"), `${String(id || "").trim()}.json`);
}

async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true });
}

async function readManifest(turmaId) {
  const p = manifestPath(turmaId);
  try {
    const raw = await fsp.readFile(p, "utf-8");
    return JSON.parse(raw || "{}");
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}

async function writeManifest(turmaId, manifest) {
  const dir = turmaDir(turmaId);
  await ensureDir(dir);
  const p = manifestPath(turmaId);
  await fsp.writeFile(p, JSON.stringify(manifest, null, 2), "utf-8");
  return p;
}

async function writeItem(turmaId, type, id, json) {
  const p = itemPath(turmaId, type, id);
  await ensureDir(path.dirname(p));
  await fsp.writeFile(p, JSON.stringify(json, null, 2), "utf-8");
  return p;
}

async function readItem(turmaId, type, id) {
  const p = itemPath(turmaId, type, id);
  try {
    const raw = await fsp.readFile(p, "utf-8");
    return JSON.parse(raw || "{}");
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}

function existsSync(p) {
  try { return fs.existsSync(p); } catch { return false; }
}

module.exports = {
  baseDir,
  turmaDir,
  manifestPath,
  itemPath,
  existsSync,
  readManifest,
  readItem,
  writeManifest,
  writeItem,
};
