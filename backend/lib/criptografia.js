const crypto = require("crypto");

// 🔐 Gera uma chave de 256 bits usando SHA-256
function gerarChave(keyStr) {
  return crypto.createHash("sha256").update(keyStr).digest();
}

// 📦 Criptografa uma string com chave mestra e IV dinâmico (formato: IV:Base64)
function criptografarComMestra(texto, chave) {
  if (typeof texto !== "string" || !texto.trim()) {
    throw new TypeError("❌ Texto inválido para criptografar.");
  }
  if (typeof chave !== "string" || !chave.trim()) {
    throw new TypeError("❌ Chave mestra ausente.");
  }

  const iv = crypto.randomBytes(16);
  const key = gerarChave(chave);

  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let criptografado = cipher.update(texto, "utf8", "base64");
  criptografado += cipher.final("base64");

  if (process.env.DEBUG === "true") {
    console.log("🔐 Texto criptografado:", texto);
  }

  return `${iv.toString("base64")}:${criptografado}`;
}

// 🔓 Descriptografa string no formato IV:Base64 com a chave mestra
function descriptografarComMestra(textoCriptografado, chave) {
  if (typeof textoCriptografado !== "string" || !textoCriptografado.includes(":")) {
    throw new TypeError("❌ Texto criptografado em formato inválido.");
  }
  if (typeof chave !== "string" || !chave.trim()) {
    throw new TypeError("❌ Chave mestra ausente.");
  }

  const [ivBase64, conteudoBase64] = textoCriptografado.split(":");
  const iv = Buffer.from(ivBase64, "base64");
  const conteudo = Buffer.from(conteudoBase64, "base64");
  const key = gerarChave(chave);

  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let texto = decipher.update(conteudo, null, "utf8");
  texto += decipher.final("utf8");

  if (process.env.DEBUG === "true") {
    console.log("🔓 Texto descriptografado:", texto);
  }

  return texto;
}

// 🧪 Detecta se o texto está criptografado (formato esperado: IV:Base64)
function isCriptografado(texto) {
  return typeof texto === "string" && /^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/.test(texto);
}

// 🔐 Criptografa campos sensíveis do objeto de usuário
async function criptografarCamposUsuario(dados, chaveMestra) {
  const campos = [
    'aluno',
    'codigoTemas',
    'casaEspírita',
    'numeroTurma',
    'dirigente',
    'emailDirigente',
    'secretarios',
    'telefone'
  ];

  for (const campo of campos) {
    const valor = dados[campo];

    if (typeof valor === "string" && valor.trim()) {
      try {
        dados[campo] = criptografarComMestra(valor, chaveMestra);
        if (process.env.DEBUG === "true") {
          console.log(`🔒 Campo criptografado: ${campo}`);
        }
      } catch (erro) {
        console.error(`❌ Erro ao criptografar campo "${campo}":`, erro.message);
        throw erro;
      }
    } else {
      console.warn(`⚠️ Campo "${campo}" ausente ou vazio (não criptografado).`);
    }
  }

  return dados;
}

module.exports = {
  criptografarComMestra,
  descriptografarComMestra,
  criptografarCamposUsuario,
  isCriptografado
};
