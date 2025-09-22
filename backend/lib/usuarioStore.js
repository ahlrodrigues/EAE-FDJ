// =============================================================================
// Caminho: backend/lib/usuarioStore.js
// Objetivo (NOVO MODELO APENAS):
//   - AES-256-GCM com IV de 12 bytes (sem fallback).
//   - Índice leve:  config/index.json              (sem dados sensíveis)
//   - Usuário por hash: config/usuarios/<emailHash>.json
//   - Helpers: upsertIndexEntry, load/save/delete user, renameUserHash
// Notas:
//   - Sem dotenv aqui (env vem do processo principal).
//   - Logs padronizados com prefixo LOG.
// =============================================================================

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const LOG = "📚[usuarioStore]";
const CRYPTO_SECRET = process.env.CRYPTO_SECRET;

// 🔎 Ambiente
if (!CRYPTO_SECRET) {
  console.warn(`${LOG} ⚠️ CRYPTO_SECRET não definido. Criptografia/descrição falhará.`);
}

// 🗂️ Raiz de dados
const HOME = process.env.HOME || process.env.USERPROFILE || os.homedir();
const DATA_ROOT  = path.join(HOME, ".config", "escola-aprendizes");
const CONFIG_DIR = path.join(DATA_ROOT, "config");
const USERS_DIR  = path.join(CONFIG_DIR, "usuarios");
const INDEX_PATH = path.join(CONFIG_DIR, "index.json");
const NOTAS_DIR  = path.join(DATA_ROOT, "notas");
const TEMAS_DIR  = path.join(DATA_ROOT, "temas");
const CONFIGS_DIR = path.join(DATA_ROOT, "configs"); // opcional, por hash

// 🔎 Paths helpers
function getBaseDir()            { return CONFIG_DIR; }
function getUserDir()            { return USERS_DIR; }
function getIndexPath()          { return INDEX_PATH; }
function getUserFilePath(h)      { return path.join(USERS_DIR, `${h}.json`); }
function getDataRoots()          { return { DATA_ROOT, NOTAS_DIR, TEMAS_DIR, CONFIGS_DIR }; }
async function ensureDirs()      { await fsp.mkdir(USERS_DIR, { recursive: true }); }

// -----------------------------------------------------------------------------
// 🔐 Criptografia AES-256-GCM (IV=12 bytes). Armazenamento: base64([iv][tag][ct])
// -----------------------------------------------------------------------------
function _key() { return crypto.createHash("sha256").update(CRYPTO_SECRET || "").digest(); }

function criptografarCampo(plain) {
  try {
    const iv = crypto.randomBytes(12);
    const c  = crypto.createCipheriv("aes-256-gcm", _key(), iv);
    const ct = Buffer.concat([c.update(String(plain), "utf8"), c.final()]);
    const tag = c.getAuthTag();
    return Buffer.concat([iv, tag, ct]).toString("base64");
  } catch (e) {
    console.error(`${LOG} ❌ Criptografia falhou: ${e.message}`);
    throw e;
  }
}

function descriptografarCampo(b64) {
  const buf = Buffer.from(b64, "base64");
  if (buf.length < 29) throw new Error("Bloco cifrado inválido (tamanho mínimo 29 bytes).");
  const iv  = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const dat = buf.subarray(28);
  try {
    const d = crypto.createDecipheriv("aes-256-gcm", _key(), iv);
    d.setAuthTag(tag);
    const out = Buffer.concat([d.update(dat), d.final()]);
    return out.toString("utf8");
  } catch (e) {
    console.error(`${LOG} ❌ Descriptografia falhou: ${e.message}`);
    throw e;
  }
}

// -----------------------------------------------------------------------------
// 📇 index.json — leve, sem dados sensíveis
// -----------------------------------------------------------------------------
function _loadIndexSync() {
  try {
    const raw = fs.readFileSync(INDEX_PATH, "utf-8");
    const idx = JSON.parse(raw || "{}");
    if (!idx || typeof idx !== "object") throw new Error("vazio");
    if (!idx.usuarios || typeof idx.usuarios !== "object") idx.usuarios = {};
    return idx;
  } catch (e) {
    console.info(`${LOG} index.json ausente/inválido → criando. (${INDEX_PATH}) Motivo: ${e.message}`);
    return { usuarios: {}, versao: 1 };
  }
}

async function loadIndex() {
  try {
    const raw = await fsp.readFile(INDEX_PATH, "utf-8");
    const idx = JSON.parse(raw || "{}");
    if (!idx || typeof idx !== "object") throw new Error("vazio");
    if (!idx.usuarios || typeof idx.usuarios !== "object") idx.usuarios = {};
    return idx;
  } catch (e) {
    console.info(`${LOG} index.json ausente/inválido → criando. (${INDEX_PATH}) Motivo: ${e.message}`);
    return { usuarios: {}, versao: 1 };
  }
}

function _saveIndexSync(idx) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(INDEX_PATH, JSON.stringify(idx, null, 2), "utf-8");
  console.log(`${LOG} index.json salvo: ${INDEX_PATH}`);
}

async function saveIndex(idx) {
  await fsp.mkdir(CONFIG_DIR, { recursive: true });
  await fsp.writeFile(INDEX_PATH, JSON.stringify(idx, null, 2), "utf-8");
  console.info(`${LOG} index.json salvo: ${INDEX_PATH}`);
}

/** Upsert de metadados NÃO sensíveis no índice */
async function upsertIndexEntry(entry) {
  const idx = await loadIndex();
  const prev = idx.usuarios[entry.emailHash] || {};
  idx.usuarios[entry.emailHash] = {
    ...prev,
    emailHash: entry.emailHash,
    idioma: entry.idioma || prev.idioma || "pt-BR",
    roles: Array.isArray(entry.roles) ? entry.roles : (prev.roles || []),
    ativo: typeof entry.ativo === "boolean" ? entry.ativo : (prev.ativo ?? true),
    ultimoLoginISO: entry.ultimoLoginISO || prev.ultimoLoginISO || null,
    updatedAt: new Date().toISOString(),
  };
  await saveIndex(idx);
  console.info(`${LOG} index atualizado (emailHash=${entry.emailHash})`);
  return true;
}

function removeIndexEntry(emailHash) {
  const idx = _loadIndexSync();
  if (idx.usuarios[emailHash]) {
    delete idx.usuarios[emailHash];
    _saveIndexSync(idx);
    console.log(`${LOG} index removido (emailHash=${emailHash})`);
    return true;
  }
  return false;
}

// -----------------------------------------------------------------------------
// 👤 Arquivo por usuário: config/usuarios/<emailHash>.json
// -----------------------------------------------------------------------------
async function loadUserByHash(emailHash) {
  await ensureDirs();
  const p = getUserFilePath(emailHash);
  try {
    const raw = await fsp.readFile(p, "utf-8");
    console.info(`${LOG} Usuário carregado: ${p}`);
    return JSON.parse(raw || "{}");
  } catch (e) {
    if (e.code === "ENOENT") {
      console.warn(`${LOG} Usuário inexistente: ${p}`);
      return null;
    }
    console.error(`${LOG} ❌ Falha ao ler ${p}: ${e.message}`);
    throw e;
  }
}

async function saveUserByHash(emailHash, data) {
  await ensureDirs();
  const p = getUserFilePath(emailHash);
  try {
    await fsp.writeFile(p, JSON.stringify(data, null, 2), "utf-8");
    console.info(`💾${LOG} Usuário salvo: ${p}`);
    return p;
  } catch (e) {
    console.error(`${LOG} ❌ Falha ao salvar ${p}: ${e.message}`);
    throw e;
  }
}

function userFileExists(emailHash) {
  try { return fs.existsSync(getUserFilePath(emailHash)); } catch { return false; }
}

async function deleteUserByHash(emailHash) {
  const p = getUserFilePath(emailHash);
  try {
    await fsp.unlink(p);
    console.info(`${LOG} Usuário removido: ${p}`);
    removeIndexEntry(emailHash);
    return true;
  } catch (e) {
    if (e.code === "ENOENT") {
      console.warn(`${LOG} Remoção ignorada, arquivo não existe: ${p}`);
      return false;
    }
    console.error(`${LOG} ❌ Falha ao remover ${p}: ${e.message}`);
    throw e;
  }
}

// -----------------------------------------------------------------------------
// 🔀 Migração de hash (move JSON e pastas relacionadas)
// -----------------------------------------------------------------------------
function _moveOrCopyDir(src, dst) {
  if (!fs.existsSync(src)) return { ok: true, moved: 0 };
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  try {
    fs.renameSync(src, dst);
    return { ok: true, moved: "renamed" };
  } catch (e) {
    if (e.code !== "EXDEV") return { ok: false, erro: e.message };
    // fallback: copy + remove
    const copy = (s, d) => {
      const st = fs.statSync(s);
      if (st.isDirectory()) {
        fs.mkdirSync(d, { recursive: true });
        for (const n of fs.readdirSync(s)) copy(path.join(s, n), path.join(d, n));
      } else {
        fs.copyFileSync(s, d);
      }
    };
    try {
      copy(src, dst);
      fs.rmSync(src, { recursive: true, force: true });
      return { ok: true, moved: "copied" };
    } catch (err) {
      return { ok: false, erro: err.message };
    }
  }
}

async function renameUserHash(oldHash, newHash, newRecord) {
  await ensureDirs();
  const oldFile = getUserFilePath(oldHash);
  const newFile = getUserFilePath(newHash);

  if (!fs.existsSync(oldFile)) return { ok:false, erro:`arquivo não existe: ${oldFile}` };
  if (fs.existsSync(newFile))  return { ok:false, erro:`destino já existe: ${newFile}` };

  try {
    await fsp.writeFile(newFile, JSON.stringify(newRecord, null, 2), "utf-8");
    console.log(`💾${LOG} Novo JSON salvo: ${newFile}`);
  } catch (e) {
    return { ok:false, erro:`falha ao salvar novo JSON: ${e.message}` };
  }

  const { NOTAS_DIR, TEMAS_DIR, CONFIGS_DIR } = getDataRoots();
  const m1 = _moveOrCopyDir(path.join(NOTAS_DIR, oldHash),  path.join(NOTAS_DIR, newHash));
  if (!m1.ok) return { ok:false, erro:`notas: ${m1.erro}` };
  const m2 = _moveOrCopyDir(path.join(TEMAS_DIR, oldHash),  path.join(TEMAS_DIR, newHash));
  if (!m2.ok) return { ok:false, erro:`temas: ${m2.erro}` };
  const m3 = _moveOrCopyDir(path.join(CONFIGS_DIR, oldHash), path.join(CONFIGS_DIR, newHash));
  if (!m3.ok) return { ok:false, erro:`configs: ${m3.erro}` };

  await upsertIndexEntry({ emailHash: newHash, ativo: true });
  removeIndexEntry(oldHash);

  try { fs.unlinkSync(oldFile); } catch (e) {
    console.warn(`${LOG} ⚠️ não foi possível remover antigo: ${oldFile} (${e.message})`);
  }

  console.log(`${LOG} migração concluída ${oldHash.slice(0,8)}… → ${newHash.slice(0,8)}…`);
  return { ok:true };
}

// -----------------------------------------------------------------------------
// ✅ Exports
// -----------------------------------------------------------------------------
module.exports = {
  // Cripto
  criptografarCampo,
  descriptografarCampo,

  // Paths/util
  getBaseDir,
  getUserDir,
  getIndexPath,
  getUserFilePath,
  getDataRoots,

  // Índice + Usuário
  loadIndex,
  saveIndex,
  upsertIndexEntry,
  loadUserByHash,
  saveUserByHash,
  deleteUserByHash,

  // Hash migration
  userFileExists,
  removeIndexEntry,
  renameUserHash,
};
