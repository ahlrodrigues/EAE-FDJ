const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const crypto = require('crypto');

dotenv.config();
const CRYPTO_SECRET = process.env.CRYPTO_SECRET;

if (!CRYPTO_SECRET) {
  console.error("❌ CRYPTO_SECRET não encontrado no .env");
  process.exit(1);
}

function descriptografarComMestra(valorCriptografado, chave) {
  try {
    const [ivBase64, conteudoCriptografado] = valorCriptografado.split(':');
    const iv = Buffer.from(ivBase64, 'base64');
    const encryptedText = Buffer.from(conteudoCriptografado, 'base64');
    const key = crypto.createHash('sha256').update(chave).digest();

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return `❌ Erro ao descriptografar: ${err.message}`;
  }
}

const caminhoUsuario = path.resolve(
  process.env.HOME || process.env.USERPROFILE,
  '.config/escola-aprendizes/config/usuario.json'
);

if (!fs.existsSync(caminhoUsuario)) {
  console.error(`❌ Arquivo não encontrado: ${caminhoUsuario}`);
  process.exit(1);
}

const dadosCrus = fs.readFileSync(caminhoUsuario, 'utf-8');
const dadosJSON = JSON.parse(dadosCrus);
const usuarios = dadosJSON.usuarios;

if (!Array.isArray(usuarios)) {
  console.error("❌ Formato inesperado: 'usuarios' não é um array.");
  process.exit(1);
}

const logs = [];
logs.push("🔐 Verificando descriptografia dos campos dos usuários (array):\n");

usuarios.forEach((usuario, index) => {
  logs.push(`🧑‍💻 Usuário [${index}]`);
  Object.entries(usuario).forEach(([chave, valor]) => {
    if (typeof valor === 'string' && valor.includes(':')) {
      const resultado = descriptografarComMestra(valor, CRYPTO_SECRET);
      const status = resultado.startsWith('❌') ? '❌' : '✅';
      logs.push(`  ${status} ${chave}: ${resultado}`);
    } else {
      logs.push(`  ℹ️ ${chave}: (não criptografado ou formato inválido)`);
    }
  });
  logs.push("");
});

// 🖨️ Exibe no console
logs.forEach(l => console.log(l));

// 📝 Salva log em arquivo
const caminhoLog = path.join(__dirname, 'log_descriptografia.txt');
fs.writeFileSync(caminhoLog, logs.join('\n'), 'utf-8');
console.log(`\n📝 Log salvo em: ${caminhoLog}`);
