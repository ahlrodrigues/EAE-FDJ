const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config();
const CRYPTO_SECRET = process.env.CRYPTO_SECRET;

if (!CRYPTO_SECRET) {
  console.error("❌ CRYPTO_SECRET não encontrado no .env");
  process.exit(1);
}

function criptografarComMestra(texto, chave) {
  const iv = crypto.randomBytes(16);
  const key = crypto.createHash('sha256').update(chave).digest();

  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(texto, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const ivBase64 = iv.toString('base64');
  return `${ivBase64}:${encrypted}`;
}

const texto = 'Maria Vitória';
const resultado = criptografarComMestra(texto, CRYPTO_SECRET);

console.log("🔐 Texto criptografado:");
console.log(resultado);
