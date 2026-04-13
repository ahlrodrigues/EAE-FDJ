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

const { criptografarComMestra, descriptografarComMestra } = require("../lib/criptografia");
const { obterEmailHashAtivo } = require("../lib/sessionStore");
const { upsertIndexEntry } = require("../lib/usuarioStore");
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

  // ✍️ Atualizar campos do usuário (novo modelo: config/usuarios/<hash>.json)
  // - Se emailHash não vier, usa sessão ativa.
  // - Criptografa campos sensíveis com CRYPTO_SECRET.
  // - NÃO permite troca de e-mail por aqui (use emailChange).
  const SENSITIVE_FIELDS = new Set([
    "aluno",
    "codigoTemas",
    "casaEspírita",
    "numeroTurma",
    "dirigente",
    "emailDirigente",
    "secretarios",
    "telefone",
  ]);

  function isValidHash(h) {
    return typeof h === "string" && /^[a-f0-9]{64}$/i.test(h);
  }

  function normalizeIdiomaTag(input) {
    const raw = String(input || "").trim();
    if (!raw) return "pt-BR";
    const s = raw.replace("_", "-").toLowerCase();
    const map = {
      pt: "pt-BR",
      "pt-br": "pt-BR",
      en: "en-US",
      "en-us": "en-US",
      fr: "fr-FR",
      "fr-fr": "fr-FR",
      de: "de-DE",
      "de-de": "de-DE",
      it: "it-IT",
      "it-it": "it-IT",
    };
    const normalized = map[s] || s;
    if (/^[a-z]{2}(-[a-z]{2})$/.test(normalized)) {
      const [lang, region] = normalized.split("-");
      return `${lang.toLowerCase()}-${region.toUpperCase()}`;
    }
    // fallback seguro
    return "pt-BR";
  }

  ipcMain.handle("usuario:atualizar", async (_evt, payload) => {
    try {
      if (!CRYPTO_SECRET) throw new Error("CRYPTO_SECRET não definido no processo principal.");

      const input = (payload && typeof payload === "object") ? payload : {};
      const patch = (input.patch && typeof input.patch === "object") ? input.patch : {};
      let emailHash = input.emailHash || null;
      if (!emailHash) emailHash = obterEmailHashAtivo();
      if (!isValidHash(emailHash)) throw new Error("emailHash inválido ou sessão inativa.");

      const p = getUserFilePath(emailHash);
      const raw = await fsp.readFile(p, "utf-8");
      const json = JSON.parse(raw || "{}");

      let changed = 0;
      for (const [k, v] of Object.entries(patch)) {
        if (k === "roles") {
          // Produção: roles devem ser emitidas/assinadas pelo servidor.
          // DEV: permitir alterar somente se habilitado por env + usuário atual for analista.
          const allowLocalRoleEdit = String(process.env.LOCAL_ALLOW_ROLE_EDIT || "").trim() === "1";
          if (!allowLocalRoleEdit) continue;

          try {
            const actorHash = obterEmailHashAtivo();
            if (!actorHash) continue;
            const actor = await readUserJson(actorHash);
            const actorRoles = Array.isArray(actor?.data?.roles) ? actor.data.roles : [];
            const isAnalista = actorRoles.includes("analista");
            if (!actorHash || !isAnalista) continue;
          } catch {
            continue;
          }

          const inputRoles = Array.isArray(v) ? v : [];
          const allowed = new Set(["aluno", "dirigente", "analista"]);
          const cleaned = Array.from(
            new Set(inputRoles.map((x) => String(x || "").trim().toLowerCase()).filter((x) => allowed.has(x)))
          );
          json.roles = cleaned.length ? cleaned : ["aluno"];
          changed++;
          continue;
        }

        if (k === "remoteSync") {
          const rs = (v && typeof v === "object") ? v : null;
          if (!rs) continue;
          const prev = (json.remoteSync && typeof json.remoteSync === "object") ? json.remoteSync : {};
          const next = { ...prev };

          if (typeof rs.httpBaseUrl === "string") next.httpBaseUrl = rs.httpBaseUrl.trim().replace(/\/+$/, "");
          if (typeof rs.wsUrl === "string") next.wsUrl = rs.wsUrl.trim();
          if (typeof rs.turmaId === "string") next.turmaId = rs.turmaId.trim();
          if (typeof rs.token === "string") next.token = rs.token.trim();

          json.remoteSync = next;
          changed++;
          continue;
        }

        if (k === "email" || k === "emailCriptografado" || k === "senha" || k === "senhaCriptografada") {
          continue; // não atualizar por aqui
        }

        if (k === "idioma") {
          json.idioma = normalizeIdiomaTag(v);
          changed++;
          continue;
        }

        if (k === "aceiteTermos") {
          json.aceiteTermos = !!v;
          changed++;
          continue;
        }

        if (SENSITIVE_FIELDS.has(k)) {
          const s = String(v ?? "").trim();
          if (!s) continue;
          json[k] = criptografarComMestra(s, CRYPTO_SECRET);
          changed++;
          continue;
        }
      }

      if (!changed) return { ok: true, changed: 0 };

      const nowISO = new Date().toISOString();
      json.updatedAt = nowISO;
      json.versao = typeof json.versao === "number" ? json.versao + 1 : 1;

      await fsp.writeFile(p, JSON.stringify(json, null, 2), "utf-8");
      console.log(`${LOG} ✅ usuário atualizado: ${p} (changed=${changed})`);

      // manter index.json alinhado (sem sensíveis)
      try {
        await upsertIndexEntry({ emailHash, roles: Array.isArray(json.roles) ? json.roles : ["aluno"], ativo: true });
      } catch {}
      return { ok: true, changed, caminho: p };
    } catch (erro) {
      console.error(`${LOG} ❌ usuario:atualizar falhou:`, erro?.message || erro);
      return { ok: false, erro: erro?.message || "Falha ao atualizar cadastro." };
    }
  });

  console.log(`${LOG} Registrado IPCs: "usuario:ler" e "usuario:obterNomeAluno"`);
}

module.exports = { registrarUsuarioHandler, getUserFilePath };
