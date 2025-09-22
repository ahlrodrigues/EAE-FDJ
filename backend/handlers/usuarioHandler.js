// ============================================================================
// Caminho: backend/handlers/usuarioHandler.js
// Objetivo: Ler e apresentar dados do cadastro no NOVO MODELO somente:
//           ~/.config/escola-aprendizes/config/usuarios/<emailHash>.json
// IPCs:
//   - usuario:ler (emailHash)                 → retorna JSON completo do usuário
//   - usuario:obterNomeAluno (emailHash)      → retorna nome do aluno (decriptado)
// Notas:
//   - NÃO usa dotenv aqui. Variáveis de ambiente vêm do processo principal.
//   - Requer ../lib/criptografia.descriptografarComMestra (já existente no projeto)
//   - Logs padronizados com prefixo LOG.
// ============================================================================

const { ipcMain } = require("electron");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const os = require("os");

const { descriptografarComMestra } = require("../lib/criptografia");
const CRYPTO_SECRET = process.env.CRYPTO_SECRET;

const LOG = "📨[usuarioHandler]";
const USERS_DIR = path.join(
  os.homedir(),
  ".config",
  "escola-aprendizes",
  "config",
  "usuarios"
);

function getUserFilePath(emailHash) {
  return path.join(USERS_DIR, `${emailHash}.json`);
}

/** Lê JSON com tratamento de erros + logs. */
async function readUserJson(emailHash) {
  if (!emailHash || typeof emailHash !== "string") {
    throw new Error("emailHash ausente ou inválido");
  }
  const p = getUserFilePath(emailHash);
  try {
    const raw = await fsp.readFile(p, "utf-8");
    const json = JSON.parse(raw || "{}");
    console.log(`${LOG} ✅ Usuário lido: ${p}`);
    return { path: p, data: json };
  } catch (e) {
    if (e.code === "ENOENT") {
      console.error(`${LOG} ❌ Arquivo não encontrado: ${p}`);
      throw new Error(`Cadastro não encontrado para emailHash=${emailHash}`);
    }
    console.error(`${LOG} ❌ Falha ao ler ${p}: ${e.message}`);
    throw e;
  }
}

function registrarUsuarioHandler() {
  // 📖 Ler o cadastro completo de um emailHash
  ipcMain.handle("usuario:ler", async (_evt, emailHash) => {
    try {
      const { path: p, data } = await readUserJson(emailHash);
      return { ok: true, caminho: p, dados: data };
    } catch (erro) {
      return { ok: false, erro: erro?.message || "Falha ao ler cadastro." };
    }
  });

  // 🔐 Obter nome do aluno descriptografado de um emailHash
  ipcMain.handle("usuario:obterNomeAluno", async (_evt, emailHash) => {
    try {
      if (!CRYPTO_SECRET) {
        throw new Error("CRYPTO_SECRET não definido no processo principal.");
      }
      const { data } = await readUserJson(emailHash);

      // Ajuste a propriedade abaixo de acordo com seu modelo salvo:
      // Ex.: data.aluno é o campo cifrado (string base64 GCM)
      const cifrado = data?.aluno;
      if (!cifrado) {
        return { ok: false, erro: "Campo 'aluno' não encontrado no cadastro." };
      }

      const nomeClaro = descriptografarComMestra(cifrado, CRYPTO_SECRET);
      console.log(`${LOG} ✅ Nome do aluno decriptado para hash=${emailHash.slice(0,8)}…`);
      return { ok: true, nome: nomeClaro };
    } catch (erro) {
      console.error(`${LOG} ❌ obterNomeAluno falhou: ${erro.message}`);
      return { ok: false, erro: erro?.message || "Falha ao obter nome do aluno." };
    }
  });

  console.log(`${LOG} Registrado IPCs: "usuario:ler" e "usuario:obterNomeAluno"`);
}

module.exports = { registrarUsuarioHandler, getUserFilePath };
