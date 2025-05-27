// === lib/criptografia.js ===
const crypto = require("crypto");

const CRYPTO_SECRET = process.env.CRYPTO_SECRET || "chave-super-secreta";
const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;

function criptografarComMestra(texto) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const chave = crypto.createHash("sha256").update(CRYPTO_SECRET).digest();
  const cipher = crypto.createCipheriv(ALGORITHM, chave, iv);
  const criptografado = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  return `${iv.toString("base64")}:${criptografado.toString("base64")}`;
}

function descriptografarComMestra(entrada) {
  const [ivBase64, conteudoBase64] = entrada.split(":");
  const iv = Buffer.from(ivBase64, "base64");
  const conteudo = Buffer.from(conteudoBase64, "base64");
  const chave = crypto.createHash("sha256").update(CRYPTO_SECRET).digest();
  const decipher = crypto.createDecipheriv(ALGORITHM, chave, iv);
  const texto = Buffer.concat([decipher.update(conteudo), decipher.final()]);
  return texto.toString("utf8");
}

function gerarHashEmailComMestra(email) {
  const crypto = require("crypto");
  const CRYPTO_SECRET = process.env.CRYPTO_SECRET || "segredoPadrao";
  return crypto
    .createHmac("sha256", CRYPTO_SECRET)
    .update(email.trim().toLowerCase())
    .digest("hex");
}

module.exports = {
  criptografarComMestra,
  descriptografarComMestra,
  gerarHashEmailComMestra
};