

const crypto = require("crypto");

const CRYPTO_SECRET="n8X!7qL4@B2zM#T0$e9VrFqP&dGpLuW3";
const textoCriptografado = "sbIt59xkSiiOKMw9iDs/6g==:a7+8x1PoqViIBCjJVTZEGg==";

function descriptografarComMestra(textoCriptografado, chave) {
  const [ivBase64, conteudoBase64] = textoCriptografado.split(":");
  const iv = Buffer.from(ivBase64, "base64");
  const conteudo = Buffer.from(conteudoBase64, "base64");

  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(chave, "utf-8"), iv);
  let decrypted = decipher.update(conteudo);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString("utf8");
}

try {
  const resultado = descriptografarComMestra(textoCriptografado, CRYPTO_SECRET);
  console.log("✅ Descriptografado:", resultado);
} catch (erro) {
  console.error("❌ Erro na descriptografia:", erro.message);
}
