// === backend/lib/backupRun.js ===
// Execução do backup (usado por cron e pelo "Executar agora")

const fs = require("fs");
const path = require("path");

async function execute() {
  const { carregarUsuarioJsonSeguro, descriptografarCampo, salvarUsuarioJsonSeguro } =
    require("./usuarioStore");
  const { GoogleDriveClient } = require("./googleDriveClient");

  const cfgAll = await carregarUsuarioJsonSeguro();
  const bkp = cfgAll?.backup || {};

  if (bkp.servico !== "google-drive" || !bkp.oauthTokenEnc) {
    console.log("ℹ️ [backupRun] Serviço não configurado: nada a fazer.");
    return { enviados: 0, motivo: "nao-configurado" };
  }

  const token = JSON.parse(descriptografarCampo(bkp.oauthTokenEnc));
  const drive = new GoogleDriveClient(token);

  const home = process.env.HOME || process.env.USERPROFILE;
  const notasDir = path.join(home, ".config", "escola-aprendizes", "notas");
  const temasDir = path.join(home, ".config", "escola-aprendizes", "temas");

  const enviarDir = async (dir) => {
    if (!fs.existsSync(dir)) return 0;
    let count = 0;
    for (const entry of fs.readdirSync(dir)) {
      const p = path.join(dir, entry);
      if (fs.statSync(p).isFile()) {
        try {
          if (await drive.enviarIncremental(bkp.pastaRemota, p)) count++;
        } catch (e) {
          console.warn("⚠️ [backupRun] Falha ao enviar arquivo:", p, e?.message || e);
        }
      }
    }
    return count;
  };

  const enviados = (await enviarDir(notasDir)) + (await enviarDir(temasDir));
  cfgAll.backup.ultimoBackupISO = new Date().toISOString();
  await salvarUsuarioJsonSeguro(cfgAll);

  console.log("✅ [backupRun] Concluído. Arquivos enviados:", enviados);
  return { enviados, ultimoBackupISO: cfgAll.backup.ultimoBackupISO };
}

module.exports = { execute };
