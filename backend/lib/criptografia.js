const crypto = require('crypto');

// 🔐 Criptografa os campos sensíveis do usuário usando a chave mestra
async function criptografarCamposUsuario(dados, chaveMestra) {
  const camposCriptografar = [
    'aluno',
    'codigoTemas',
    'casaEspírita',
    'numeroTurma',
    'dirigente',
    'emailDirigente',
    'secretarios',
    'telefone'
    // 🔴 Removido: 'emailCriptografado' (não está presente no JSON)
  ];

  for (const campo of camposCriptografar) {
    const valorOriginal = dados[campo];

    // 📋 Log de verificação do campo
    console.log(`🔍 Verificando campo "${campo}":`, valorOriginal);

    if (typeof valorOriginal === "string" && valorOriginal.trim() !== "") {
      try {
        dados[campo] = criptografarComMestra(valorOriginal, chaveMestra);
        console.log(`🔒 Campo criptografado: ${campo}`);
      } catch (erro) {
        console.error(`❌ Erro ao criptografar campo "${campo}":`, erro.message);
        throw new Error(`Erro ao criptografar campo "${campo}"`);
      }
    } else {
      console.warn(`⚠️ Campo "${campo}" ausente ou inválido (não será criptografado).`);
    }
  }

  return dados;
}

function criptografarComMestra(texto, chave) {
  console.log("🧪 criptografarComMestra → texto:", texto);
  console.log("🧪 criptografarComMestra → chave:", chave);

  if (typeof texto !== "string" || !texto) {
    throw new TypeError("❌ O argumento 'texto' deve ser uma string válida para criptografar.");
  }

  if (typeof chave !== "string" || !chave) {
    throw new TypeError("❌ A chave de criptografia não foi fornecida corretamente.");
  }

  const iv = crypto.randomBytes(16);
  const key = crypto.createHash('sha256').update(chave).digest();
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(texto, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return `${iv.toString('base64')}:${encrypted}`;
}

function descriptografarComMestra(textoCriptografado, chave) {
  if (typeof textoCriptografado !== "string" || !textoCriptografado.includes(":")) {
    throw new TypeError("❌ Texto criptografado inválido.");
  }

  if (typeof chave !== "string" || !chave) {
    throw new TypeError("❌ A chave de descriptografia não foi fornecida corretamente.");
  }

  const [ivBase64, encryptedBase64] = textoCriptografado.split(":");
  const iv = Buffer.from(ivBase64, "base64");
  const encrypted = Buffer.from(encryptedBase64, "base64");
  const key = crypto.createHash("sha256").update(chave).digest();

  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");

  console.log("🔓 descriptografarComMestra → texto criptografado:", textoCriptografado);
  console.log("🔓 descriptografarComMestra → chave:", chave);

  return decrypted;
}

module.exports = {
  criptografarCamposUsuario,
  criptografarComMestra,
  descriptografarComMestra
};
