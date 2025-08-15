// === backend/lib/googleDriveClient.js ===
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

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
      throw new Error("Google OAuth não configurado (GOOGLE_CLIENT_ID/SECRET).");
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      `http://127.0.0.1:${redirectPort}/oauth2callback`
    );
    oauth2Client.setCredentials(tokens || {});
    this.auth = oauth2Client;
    this.drive = google.drive({ version: "v3", auth: this.auth });
  }

  /** Garante a existência de uma hierarquia de pastas (ex.: "EscolaAprendizes/Backups") e retorna o ID final. */
  async ensureFolderPath(pathStr) {
    const parts = String(pathStr || "").split("/").map(s => s.trim()).filter(Boolean);
    if (!parts.length) throw new Error("Caminho remoto inválido.");

    let parentId = null;
    for (const name of parts) {
      const id = await this._getOrCreateFolder(name, parentId);
      parentId = id;
    }
    return parentId;
  }

  async _getOrCreateFolder(name, parentId) {
    // Tenta localizar
    const q = [
      "mimeType = 'application/vnd.google-apps.folder'",
      "trashed = false",
      `name = '${name.replace(/'/g, "\\'")}'`
    ];
    if (parentId) q.push(`'${parentId}' in parents`);

    const { data } = await this.drive.files.list({
      q: q.join(" and "),
      fields: "files(id, name)",
      pageSize: 1,
      supportsAllDrives: false
    });
    const found = data?.files?.[0];
    if (found) return found.id;

    // Cria se não existir
    const { data: created } = await this.drive.files.create({
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: parentId ? [parentId] : undefined
      },
      fields: "id,name"
    });
    return created.id;
  }

  /** Procura um arquivo por nome e pasta. */
  async findFileInFolderByName(parentId, fileName) {
    const { data } = await this.drive.files.list({
      q: [
        "trashed = false",
        `'${parentId}' in parents`,
        `name = '${fileName.replace(/'/g, "\\'")}'`
      ].join(" and "),
      fields: "files(id, name, md5Checksum, modifiedTime)",
      pageSize: 1
    });
    return data?.files?.[0] || null;
  }

  /** Faz upload (create ou update) apenas se necessário, comparando md5. */
  async enviarIncremental(pastaRemota, filePath) {
    const folderId = await this.ensureFolderPath(pastaRemota);
    const fileName = path.basename(filePath);

    const exists = fs.existsSync(filePath);
    if (!exists) return false;

    // md5 local
    const md5Local = await md5File(filePath);

    // verifica se já existe mesmo conteúdo
    const remoto = await this.findFileInFolderByName(folderId, fileName);
    if (remoto && remoto.md5Checksum === md5Local) {
      // Nada a fazer
      return false;
    }

    const media = {
      mimeType: guessMime(filePath),
      body: fs.createReadStream(filePath)
    };

    if (remoto) {
      await this.drive.files.update({
        fileId: remoto.id,
        media,
        fields: "id, md5Checksum, modifiedTime"
      });
    } else {
      await this.drive.files.create({
        requestBody: { name: fileName, parents: [folderId] },
        media,
        fields: "id, md5Checksum, modifiedTime"
      });
    }
    return true;
  }
}

function guessMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".txt" || ext === ".log") return "text/plain";
  if (ext === ".json") return "application/json";
  if (ext === ".md") return "text/markdown";
  // genérico
  return "application/octet-stream";
}

function md5File(filePath) {
  const crypto = require("crypto");
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("md5");
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

module.exports = { GoogleDriveClient, SCOPES };
