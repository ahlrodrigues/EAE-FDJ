const crypto = require("crypto");

function descriptografarComMestra(texto, chave) {
  const [ivBase64, conteudoCriptografado] = texto.split(":");
  const iv = Buffer.from(ivBase64, "base64");
  const key = crypto.scryptSync(chave, 'salt', 32);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let descriptografado = decipher.update(conteudoCriptografado, "base64", "utf8");
  descriptografado += decipher.final("utf8");
  return descriptografado;
}

const chaveMestra = "n8X!7qL4@B2zM#T0$e9VrFqP&dGpLuW3";
const criptografado = "qRe2CDug/HmNv/KzLIT6Gw==:P4ZEXLUavOcQ6N3t6foSdi54G3PBnuSYdKzRl0+CA+D71+fwyXE9tkYXH6cyTTcB";

try {
  const resultado = descriptografarComMestra(criptografado, chaveMestra);
  console.log("🔓 Descriptografado:", resultado);
} catch (erro) {
  console.error("❌ Erro ao descriptografar:", erro.message);
}
