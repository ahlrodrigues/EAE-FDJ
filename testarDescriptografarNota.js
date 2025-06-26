// testarDescriptografarNota.js
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config();

function descriptografarComMestra(entrada, chave) {
  try {
    if (!entrada.includes(":")) throw new Error("Formato inválido. Esperado IV:conteúdo");

    const [ivBase64, conteudoBase64] = entrada.split(":");
    const iv = Buffer.from(ivBase64, "base64");
    const conteudo = Buffer.from(conteudoBase64, "base64");
    const key = crypto.createHash("sha256").update(chave).digest();

    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let texto = decipher.update(conteudo, null, "utf8");
    texto += decipher.final("utf8");

    return texto;
  } catch (erro) {
    console.error("❌ Erro ao descriptografar:", erro.message);
    return null;
  }
}

// === CONFIGURAÇÃO ===
const caminhoNota = process.argv[2]; // Ex: node testarDescriptografarNota.js ./nota.txt
const CRYPTO_SECRET = process.env.CRYPTO_SECRET;

if (!CRYPTO_SECRET) {
  console.error("❌ CRYPTO_SECRET não definido no .env");
  process.exit(1);
}

if (!caminhoNota) {
  console.error("❌ Informe o caminho do arquivo da anotação como argumento.");
  console.error("   Ex: node testarDescriptografarNota.js ./minha-nota.txt");
  process.exit(1);
}

// === EXECUÇÃO ===
try {
  const caminhoAbsoluto = path.resolve(caminhoNota);
  const conteudo = fs.readFileSync(caminhoAbsoluto, "utf-8");
  console.log("📄 Conteúdo criptografado lido do arquivo:");
  console.log(conteudo.slice(0, 80), "...");

  const texto = descriptografarComMestra(conteudo, CRYPTO_SECRET);

  if (texto) {
    console.log("\n✅ Texto descriptografado:");
    console.log("----------------------------------");
    console.log(texto);
    console.log("----------------------------------");
  } else {
    console.warn("⚠️ Não foi possível descriptografar.");
  }
} catch (erro) {
  console.error("❌ Erro ao ler o arquivo:", erro.message);
}
