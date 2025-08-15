const path = require("path");
const fs = require("fs");

class GoogleDriveClient {
  constructor(token) {
    this.token = token;
    console.log("🔗[GoogleDriveClient] Token expira:", new Date(token.expiry_date).toISOString());
  }

  async testarPasta(pastaRemota) {
    console.log("🧪[GoogleDriveClient] Testar pasta:", pastaRemota);
    // TODO: integrar @googleapis/drive
    return true;
  }

  async enviarIncremental(pastaRemota, caminhoLocal) {
    const nome = path.basename(caminhoLocal);
    const tam = fs.statSync(caminhoLocal).size;
    console.log(`⬆️[GoogleDriveClient] Checando ${nome} (${tam} B) -> ${pastaRemota}`);
    // TODO: checar existência/MD5; fazer upload se necessário
    return true;
  }
}

module.exports = { GoogleDriveClient };
