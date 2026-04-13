// =============================================================================
// Caminho: backend/lib/packageStore.js
// Objetivo: persistência local de pacotes baixados/enviados via sync de pacotes.
// Modelo:
//   ~/.config/escola-aprendizes/packages/
//     inbox/<packageId>.bin
//     outbox/<packageId>.bin
// =============================================================================

const fsp = require("fs/promises");
const path = require("path");
const os = require("os");

function baseDir() {
  const home = process.env.HOME || process.env.USERPROFILE || os.homedir();
  return path.join(home, ".config", "escola-aprendizes", "packages");
}

function inboxDir() {
  return path.join(baseDir(), "inbox");
}

function outboxDir() {
  return path.join(baseDir(), "outbox");
}

function inboxPath(packageId) {
  return path.join(inboxDir(), `${String(packageId || "").trim()}.bin`);
}

function outboxPath(packageId) {
  return path.join(outboxDir(), `${String(packageId || "").trim()}.bin`);
}

async function ensureDir(p) {
  await fsp.mkdir(p, { recursive: true });
}

async function writeInbox(packageId, buf) {
  const p = inboxPath(packageId);
  await ensureDir(path.dirname(p));
  await fsp.writeFile(p, Buffer.from(buf || Buffer.alloc(0)));
  return p;
}

async function writeOutbox(packageId, buf) {
  const p = outboxPath(packageId);
  await ensureDir(path.dirname(p));
  await fsp.writeFile(p, Buffer.from(buf || Buffer.alloc(0)));
  return p;
}

async function deleteInbox(packageId) {
  const p = inboxPath(packageId);
  try {
    await fsp.unlink(p);
    return true;
  } catch (e) {
    if (e?.code === "ENOENT") return false;
    throw e;
  }
}

module.exports = {
  baseDir,
  inboxDir,
  outboxDir,
  inboxPath,
  outboxPath,
  writeInbox,
  writeOutbox,
  deleteInbox,
};

