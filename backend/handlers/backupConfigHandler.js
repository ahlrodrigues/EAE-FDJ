// backend/handlers/backupConfigHandler.js
const { ipcMain } = require("electron");
const fsp = require("fs/promises");
const path = require("path");
const os = require("os");

const LOG = "🧩 [backupConfig]";

function getUsuarioPath() {
  return path.join(os.homedir(), ".config", "escola-aprendizes", "config", "usuario.json");
}
async function lerUsuarioJsonSeguro() {
  const arq = getUsuarioPath();
  const raw = await fsp.readFile(arq, "utf-8");
  return JSON.parse(raw);
}
async function salvarUsuarioJsonSeguro(dados) {
  const arq = getUsuarioPath();
  await fsp.mkdir(path.dirname(arq), { recursive: true });
  await fsp.writeFile(arq, JSON.stringify(dados, null, 2), "utf-8");
}
function obterPrimeiroUsuario(dados) {
  const ks = Object.keys(dados?.usuarios || {});
  return ks.length ? { key: ks[0], value: dados.usuarios[ks[0]] } : null;
}

function registrarBackupConfigHandler() {
  if (registrarBackupConfigHandler.__registered) {
    console.log(`${LOG} Handlers já registrados (skip).`);
    return;
  }
  registrarBackupConfigHandler.__registered = true;

  ipcMain.handle("backup:carregar-config", async () => {
    try {
      const all = await lerUsuarioJsonSeguro();
      const first = obterPrimeiroUsuario(all);
      const cfg = first?.value?.backup || null;
      console.log(`${LOG} carregar-config → ok (${cfg ? "com dados" : "vazio"})`);
      return { ok: true, config: cfg };
    } catch (e) {
      console.error(`${LOG} Falha ao carregar cfg:`, e?.message || e);
      return { ok: false, error: e?.message || String(e) };
    }
  });

  ipcMain.handle("backup:salvar-config", async (_e, novaCfg) => {
    try {
      const all = await lerUsuarioJsonSeguro();
      const first = obterPrimeiroUsuario(all);
      if (!first) throw new Error("Não há usuário em usuario.json.");
      all.usuarios[first.key] = { ...first.value, backup: { ...(first.value?.backup || {}), ...(novaCfg || {}) } };
      await salvarUsuarioJsonSeguro(all);
      console.log(`${LOG} salvar-config → ok`);
      return { ok: true };
    } catch (e) {
      console.error(`${LOG} Falha ao salvar cfg:`, e?.message || e);
      return { ok: false, error: e?.message || String(e) };
    }
  });

  ipcMain.handle("backup:executar-agora", async () => {
    console.log(`${LOG} executar-agora → stub ok`);
    return { ok: true, message: "Execução disparada (stub)." };
  });

  console.log(`${LOG} Handlers registrados: backup:carregar-config, backup:salvar-config, backup:executar-agora`);
}

module.exports = { registrarBackupConfigHandler };
