// =============================================================================
// Caminho: backend/handlers/contentHandler.js
// Objetivo:
//  - Expor IPC para ler conteúdo já baixado localmente (manifest + itens).
//  - Não acessa rede; apenas lê de ~/.config/escola-aprendizes/content/<turmaId>/...
//
// IPC:
//  - content:manifest:get -> { ok, turmaId, manifest }
//  - content:item:get     -> { ok, turmaId, type, id, item }
// =============================================================================

const { ipcMain } = require("electron");
const { obterEmailHashAtivo } = require("../lib/sessionStore");
const { loadUserByHash } = require("../lib/usuarioStore");
const contentStore = require("../lib/contentStore");

const LOG = "📦[content]";

async function getTurmaIdFromSession() {
  const emailHash = obterEmailHashAtivo();
  if (!emailHash) return null;
  const u = await loadUserByHash(emailHash);
  const turmaId = String(u?.remoteSync?.turmaId || "").trim();
  return turmaId || null;
}

function registrarContentHandler() {
  ipcMain.handle("content:manifest:get", async () => {
    try {
      const turmaId = await getTurmaIdFromSession();
      if (!turmaId) return { ok: false, erro: "turmaId não configurado (Integrações)." };
      const manifest = await contentStore.readManifest(turmaId);
      return { ok: true, turmaId, manifest };
    } catch (e) {
      console.error(`${LOG} manifest:get falhou:`, e?.message || e);
      return { ok: false, erro: e?.message || String(e) };
    }
  });

  ipcMain.handle("content:item:get", async (_evt, { type, id } = {}) => {
    try {
      const turmaId = await getTurmaIdFromSession();
      if (!turmaId) return { ok: false, erro: "turmaId não configurado (Integrações)." };
      const t = String(type || "").trim();
      const i = String(id || "").trim();
      if (!t || !i) return { ok: false, erro: "type/id obrigatórios." };
      const item = await contentStore.readItem(turmaId, t, i);
      return { ok: true, turmaId, type: t, id: i, item };
    } catch (e) {
      console.error(`${LOG} item:get falhou:`, e?.message || e);
      return { ok: false, erro: e?.message || String(e) };
    }
  });

  console.log(`${LOG} IPC registrado: content:manifest:get, content:item:get`);
}

module.exports = { registrarContentHandler };

