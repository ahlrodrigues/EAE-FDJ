// === ./backend/lib/googleDriveClient.js ===
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

/**
 * Google Drive client com utilitários para:
 *  - Garantir árvore de pastas (ensureFolderPath)
 *  - Upload incremental por md5 (enviarIncremental)
 *  - Leitura de "about" (getAbout) para teste de conexão
 *
 * Variáveis de ambiente suportadas:
 *  - GOOGLE_CLIENT_ID
 *  - GOOGLE_CLIENT_SECRET
 *  - GOOGLE_REDIRECT_PORT (não é usada diretamente aqui, mas mantida por consistência)
 *  - GOOGLE_SUPPORTS_DRIVES=true (se quiser permitir Shared Drives)
 *  - GOOGLE_CORPORA=(user|drive|allDrives) — padrão: user
 */
class GoogleDriveClient {
  /**
   * @param {{access_token:string, refresh_token?:string, expiry_date?:number}} tokens
   * @param {{clientId?:string, clientSecret?:string, redirectPort?:string|number}} [opts]
   */
  constructor(tokens, opts = {}) {
    const clientId = process.env.GOOGLE_CLIENT_ID || opts.clientId;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || opts.clientSecret;
    const redirectPort = String(process.env.GOOGLE_REDIRECT_PORT || opts.redirectPort || "53427");

    if (!clientId || !clientSecret) {
      throw new Error("Google OAuth não configurado (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET ausentes).");
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      `http://127.0.0.1:${redirectPort}/oauth2callback`
    );
    oauth2Client.setCredentials(tokens || {});
    this.auth = oauth2Client;

    this.drive = google.drive({ version: "v3", auth: this.auth });

    // Ajustes para Shared Drives, se habilitado
    this.supportsAllDrives = String(process.env.GOOGLE_SUPPORTS_DRIVES || "false").toLowerCase() === "true";
    this.corpora = process.env.GOOGLE_CORPORA || (this.supportsAllDrives ? "allDrives" : "user");

    // Cache de pastas para reduzir chamadas (chave: parentId||"root" + "/" + name)
    this._folderCache = new Map();

    console.log("[gdrive] Cliente inicializado. supportsAllDrives:", this.supportsAllDrives, "corpora:", this.corpora);
  }

  // ---------------------------------------------------------------------------
  // Utilidades públicas
  // ---------------------------------------------------------------------------

  /** Retorna informações do usuário/autenticação para teste de conexão. */
  async getAbout() {
    try {
      const { data } = await this.drive.about.get({ fields: "user(displayName,emailAddress)" });
      console.log("[gdrive] about.get =>", data?.user?.emailAddress || "(sem email)");
      return data;
    } catch (e) {
      console.error("[gdrive] Falha em about.get:", e?.message || e);
      throw e;
    }
  }

  /**
   * Garante a existência de uma hierarquia de pastas (ex.: "EscolaAprendizes/Backups/Turma_2025_A")
   * e retorna o ID da pasta final.
   */
  async ensureFolderPath(pathStr) {
    const parts = String(pathStr || "")
      .split("/")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!parts.length) throw new Error("Caminho remoto inválido (ensureFolderPath).");

    console.log("[gdrive] ensureFolderPath:", pathStr);

    let parentId = null; // null => raiz do Drive do usuário
    for (const nameRaw of parts) {
      const name = sanitizeName(nameRaw);
      const key = `${parentId || "root"}/${name}`;
      const cached = this._folderCache.get(key);
      if (cached) {
        parentId = cached;
        continue;
      }

      const id = await this._getOrCreateFolder(name, parentId);
      this._folderCache.set(key, id);
      parentId = id;
    }
    return parentId;
  }

  /**
   * Faz upload (create ou update) apenas se necessário, comparando md5 do conteúdo.
   * @param {string} pastaRemota - caminho posix (ex.: "EscolaAprendizes/Backups/Turma_2025_A")
   * @param {string} filePath - caminho absoluto local do arquivo
   * @returns {Promise<boolean>} true se enviou (create/update), false se já estava idêntico.
   */
  async enviarIncremental(pastaRemota, filePath) {
    const exists = fs.existsSync(filePath);
    if (!exists) {
      console.warn("[gdrive] Arquivo não existe, ignorando:", filePath);
      return false;
    }

    const folderId = await this.ensureFolderPath(pastaRemota);
    const fileName = path.basename(filePath);

    const md5Local = await md5File(filePath);

    // Verifica se já existe com mesmo conteúdo
    const remoto = await this._findFileInFolderByName(folderId, fileName);
    if (remoto && remoto.md5Checksum === md5Local) {
      console.log("[gdrive] Sem alterações:", fileName);
      return false;
    }

    const media = {
      mimeType: guessMime(filePath),
      body: fs.createReadStream(filePath),
    };

    if (remoto) {
      console.log("[gdrive] Atualizando arquivo:", fileName, "id:", remoto.id);
      await this.drive.files.update({
        fileId: remoto.id,
        media,
        fields: "id, md5Checksum, modifiedTime",
        supportsAllDrives: this.supportsAllDrives,
      });
    } else {
      console.log("[gdrive] Criando arquivo:", fileName, "na pasta:", folderId);
      await this.drive.files.create({
        requestBody: { name: fileName, parents: [folderId] },
        media,
        fields: "id, md5Checksum, modifiedTime",
        supportsAllDrives: this.supportsAllDrives,
      });
    }

    return true;
  }

  // ---------------------------------------------------------------------------
  // Privados
  // ---------------------------------------------------------------------------

  async _getOrCreateFolder(name, parentId) {
    // Consulta por nome + parentId
    const q = [
      "mimeType = 'application/vnd.google-apps.folder'",
      "trashed = false",
      `name = '${escapeQuotes(name)}'`,
    ];
    if (parentId) q.push(`'${parentId}' in parents`);

    const listParams = {
      q: q.join(" and "),
      fields: "files(id, name)",
      pageSize: 10, // pequeno buffer para casos raros de duplicidade por nome
      supportsAllDrives: this.supportsAllDrives,
      corpora: this.corpora, // 'user' por padrão; 'allDrives' se habilitar shared drives
      includeItemsFromAllDrives: this.supportsAllDrives,
      spaces: "drive",
    };

    const { data } = await this.drive.files.list(listParams);
    const found = data?.files?.[0];
    if (found) {
      return found.id;
    }

    // Cria se não existir
    console.log("[gdrive] Criando pasta:", name, "parent:", parentId || "(root)");
    const { data: created } = await this.drive.files.create({
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: parentId ? [parentId] : undefined,
      },
      fields: "id,name",
      supportsAllDrives: this.supportsAllDrives,
    });
    return created.id;
  }

  async _findFileInFolderByName(parentId, fileName) {
    const { data } = await this.drive.files.list({
      q: ["trashed = false", `'${parentId}' in parents`, `name = '${escapeQuotes(fileName)}'`].join(" and "),
      fields: "files(id, name, md5Checksum, modifiedTime)",
      pageSize: 10,
      supportsAllDrives: this.supportsAllDrives,
      corpora: this.corpora,
      includeItemsFromAllDrives: this.supportsAllDrives,
      spaces: "drive",
    });
    return data?.files?.[0] || null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeName(name) {
  // Remove caracteres de controle e aparas. Pode expandir conforme regras do produto.
  return String(name || "").replace(/[\u0000-\u001F]/g, "").trim();
}

function escapeQuotes(s) {
  return String(s || "").replace(/'/g, "\\'");
}

function guessMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".txt" || ext === ".log") return "text/plain";
  if (ext === ".json") return "application/json";
  if (ext === ".md") return "text/markdown";
  if (ext === ".csv") return "text/csv";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".pdf") return "application/pdf";
  // genérico
  return "application/octet-stream";
}

function md5File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("md5");
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

module.exports = { GoogleDriveClient, SCOPES };
