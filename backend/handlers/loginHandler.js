// =============================================================================
// Caminho: backend/handlers/loginHandler.js
// Objetivo (sem legado!):
//   - Autenticar usando APENAS:
//       ~/.config/escola-aprendizes/config/usuarios/<emailHash>.json
//   - Atualizar índice leve:
//       ~/.config/escola-aprendizes/config/index.json  (ultimoLoginISO)
//   - Expor núcleo testável (Node/CLI) e registro via IPC (Electron).
//   - Logs seguros (não vazar segredos). Nenhuma leitura de config/usuario.json.
// =============================================================================

let ipcMain;
try { ({ ipcMain } = require("electron")); } catch { ipcMain = null; } // Node puro: sem Electron

const fs = require("fs"); // (não usamos para legado)
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
dotenv.config();

// 🔐 Libs internas
// (Opcional: só para verificação de consistência. Login não depende de decifrar o e-mail.)
const { descriptografarComMestra } = require("../lib/criptografia");
const { definirSessaoAtiva } = require("../lib/sessionStore");
const {
  getUserFilePath,
  loadUserByHash,
  upsertIndexEntry,
} = require("../lib/usuarioStore");

// ------------------------------
// 🔧 Constantes e helpers
// ------------------------------
const LOG = "[LOGIN]";
const CHAVE_MESTRA = process.env.CRYPTO_SECRET;

// Normaliza e gera sha256 do e-mail (base para emailHash)
function emailToHash(email) {
  const norm = String(email || "").trim().toLowerCase();
  if (!norm.includes("@")) return null;
  return crypto.createHash("sha256").update(norm, "utf8").digest("hex");
}

function isValidHash(h) {
  return typeof h === "string" && /^[a-f0-9]{64}$/i.test(h);
}

// Mascara e-mail para logs
function maskEmail(email) {
  try {
    const [u, d] = String(email).split("@");
    if (!d) return "***";
    return `${u.slice(0, 1)}***@${d}`;
  } catch { return "***"; }
}

// -----------------------------------------------------------------------------
// 🧠 Núcleo (puro, testável em Node): validar login por e-mail e senha
//   - NENHUM fallback para usuario.json.
// -----------------------------------------------------------------------------
async function validarLoginCore(emailDigitado, senhaDigitada) {
  const ts = new Date().toISOString();
  const masked = maskEmail(emailDigitado);

  try {
    if (!emailDigitado || !senhaDigitada) {
      throw new Error("Credenciais ausentes");
    }

    // 1) Deriva emailHash a partir do e-mail digitado (normalizado)
    const emailHash = emailToHash(emailDigitado);
    if (!emailHash || !isValidHash(emailHash)) {
      throw new Error("E-mail inválido");
    }

    const userPath = getUserFilePath(emailHash);
    console.info(`${LOG} ▶ tentativa @ ${ts} email=${masked} hash=${emailHash.slice(0,8)}…`);
    console.info(`${LOG} arquivo: ${userPath}`);

    // 2) Modelo novo: tenta carregar diretamente o arquivo do usuário
    const user = await loadUserByHash(emailHash);
    if (!user) {
      console.warn(`${LOG} ❌ usuário não encontrado por hash=${emailHash.slice(0,8)}…`);
      return { sucesso: false, erro: "Usuário não encontrado." };
    }

    // 3) Verifica a senha (bcrypt)
    if (!user.senhaCriptografada) {
      console.error(`${LOG} ❌ registro sem 'senhaCriptografada' em ${userPath}`);
      return { sucesso: false, erro: "Registro de usuário inválido." };
    }

    const ok = await bcrypt.compare(senhaDigitada, user.senhaCriptografada);
    if (!ok) {
      console.warn(`${LOG} 🔒 senha incorreta para ${masked}`);
      return { sucesso: false, erro: "Senha incorreta." };
    }

    // 4) (Opcional) Consistência do e-mail cifrado, se existir e houver chave
    if (user.emailCriptografado && CHAVE_MESTRA) {
      try {
        const dec = descriptografarComMestra(user.emailCriptografado, CHAVE_MESTRA);
        const eq = String(dec).trim().toLowerCase() === String(emailDigitado).trim().toLowerCase();
        if (!eq) {
          console.warn(`${LOG} ⚠️ e-mail cifrado não coincide com o digitado (prosseguindo pelo hash).`);
        }
      } catch {
        console.warn(`${LOG} ⚠️ falha ao decifrar emailCriptografado (prosseguindo).`);
      }
    }

    // 5) Sessão + índice
    definirSessaoAtiva(emailHash);
    const nowISO = new Date().toISOString();
    await upsertIndexEntry({ emailHash, ultimoLoginISO: nowISO, ativo: true });

    console.info(`${LOG} ✅ autenticado emailHash=${emailHash.slice(0,8)}…`);
    return { sucesso: true, emailHash };
  } catch (erro) {
    console.error(`${LOG} ❌ erro: ${erro.message}`);
    return { sucesso: false, erro: erro.message };
  }
}

// -----------------------------------------------------------------------------
// 🔌 Registro do IPC (Electron main). Em Node puro, apenas avisa e sai.
// -----------------------------------------------------------------------------
function registrarLoginHandler(providedIpcMain) {
  const ipc = providedIpcMain || ipcMain;
  if (!ipc || typeof ipc.handle !== "function") {
    console.warn(`${LOG} ⚠️ IPC indisponível (fora do processo Electron main). Registro ignorado.`);
    return false;
  }

  ipc.handle("validar-login", async (_event, emailDigitado, senhaDigitada) => {
    return validarLoginCore(emailDigitado, senhaDigitada);
  });

  console.info(`${LOG} 🧩 IPC 'validar-login' registrado.`);
  return true;
}

module.exports = { registrarLoginHandler, validarLoginCore };
