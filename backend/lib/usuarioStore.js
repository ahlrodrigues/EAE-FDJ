const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const usuarioPath = path.join(
  process.env.HOME || process.env.USERPROFILE,
  ".config","escola-aprendizes","config","usuario.json"
);
const CRYPTO_SECRET = process.env.CRYPTO_SECRET;

function _cipher(data) {
  const iv = crypto.randomBytes(16);
  const key = crypto.createHash("sha256").update(CRYPTO_SECRET).digest();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(String(data), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}
function _decipher(b64) {
  const buf = Buffer.from(b64, "base64");
  const iv = buf.subarray(0,16);
  const tag = buf.subarray(16,32);
  const data = buf.subarray(32);
  const key = crypto.createHash("sha256").update(CRYPTO_SECRET).digest();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
}

const criptografarCampo = (t) => _cipher(t);
const descriptografarCampo = (e) => _decipher(e);

async function carregarUsuarioJsonSeguro() {
  try {
    if (!fs.existsSync(usuarioPath)) return {};
    const raw = fs.readFileSync(usuarioPath, "utf8");
    return JSON.parse(raw || "{}");
  } catch (e) {
    console.error("❌[usuarioStore] Falha ao carregar usuario.json:", e.message);
    return {};
  }
}
async function salvarUsuarioJsonSeguro(obj) {
  const dir = path.dirname(usuarioPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(usuarioPath, JSON.stringify(obj, null, 2), "utf8");
  console.log("💾[usuarioStore] usuario.json salvo:", usuarioPath);
}

module.exports = {
  usuarioPath,
  criptografarCampo,
  descriptografarCampo,
  carregarUsuarioJsonSeguro,
  salvarUsuarioJsonSeguro
};
