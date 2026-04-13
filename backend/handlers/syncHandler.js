// =============================================================================
// Caminho: backend/handlers/syncHandler.js
// Objetivo:
//  - IPC para "pull" de conteúdo do site (manifest + itens) sob demanda.
//  - Não faz WebSocket aqui; WS fica no renderer apenas para aviso.
//
// Env (fallback para DEV):
//  - SYNC_HTTP_BASE_URL
//  - SYNC_TURMA_ID
//  - SYNC_TOKEN
//
// Fonte de config preferida (por usuário):
//  - config/usuarios/<emailHash>.json -> remoteSync: { httpBaseUrl, turmaId, token }
// =============================================================================

const { ipcMain } = require("electron");
const axios = require("axios");
const crypto = require("crypto");

const { obterEmailHashAtivo } = require("../lib/sessionStore");
const { loadUserByHash } = require("../lib/usuarioStore");
const contentStore = require("../lib/contentStore");

const LOG = "🔄 [sync]";

function sha256Hex(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function normalizeBaseUrl(u) {
  return String(u || "").trim().replace(/\/+$/, "");
}

async function getSyncConfig() {
  const emailHash = obterEmailHashAtivo();
  let cfg = null;
  if (emailHash) {
    try {
      const user = await loadUserByHash(emailHash);
      cfg = user?.remoteSync || null;
    } catch {}
  }

  const httpBaseUrl = normalizeBaseUrl(
    cfg?.httpBaseUrl ||
    process.env.SYNC_HTTP_BASE_URL ||
    "https://api.geea.com.br"
  );
  const turmaId = String(cfg?.turmaId || process.env.SYNC_TURMA_ID || "").trim();
  const token = String(cfg?.token || process.env.SYNC_TOKEN || "").trim();

  return { httpBaseUrl, turmaId, token };
}

async function fetchManifest({ httpBaseUrl, turmaId, token }, opts = {}) {
  if (!httpBaseUrl) throw new Error("SYNC_HTTP_BASE_URL ausente");
  if (!turmaId) throw new Error("turmaId ausente (remoteSync.turmaId / SYNC_TURMA_ID)");

  const url = `${httpBaseUrl}/api/turmas/${encodeURIComponent(turmaId)}/manifest`;
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const etag = opts.etag || null;
  if (etag) headers["If-None-Match"] = etag;

  const res = await axios.get(url, { headers, timeout: 15000, validateStatus: () => true });
  if (res.status === 304) return { notModified: true, etag: etag || null, manifest: null };
  if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status} ao obter manifest`);
  return { notModified: false, etag: res.headers?.etag || null, manifest: res.data };
}

async function checkUpdatesOnly() {
  const cfg = await getSyncConfig();
  const local = await contentStore.readManifest(cfg.turmaId);
  const localEtag = local?._etag || null;

  const { notModified, etag, manifest } = await fetchManifest(cfg, { etag: localEtag });
  if (notModified) {
    return {
      ok: true,
      configured: true,
      changed: false,
      turmaId: cfg.turmaId,
      localManifestVersion: local?.manifestVersion ?? null,
      remoteManifestVersion: local?.manifestVersion ?? null,
      remoteUpdatedAtISO: local?.updatedAtISO ?? null,
      etag: localEtag,
    };
  }

  const m = (manifest && typeof manifest === "object") ? manifest : {};
  return {
    ok: true,
    configured: true,
    changed: true,
    turmaId: cfg.turmaId,
    localManifestVersion: local?.manifestVersion ?? null,
    remoteManifestVersion: m.manifestVersion ?? null,
    remoteUpdatedAtISO: m.updatedAtISO ?? null,
    etag: etag || null,
  };
}

async function fetchItem({ httpBaseUrl, token }, item) {
  const href = String(item?.url || "").trim();
  if (!href) throw new Error("item.url ausente no manifest");
  const absolute = /^https?:\/\//i.test(href) ? href : `${httpBaseUrl}${href.startsWith("/") ? "" : "/"}${href}`;

  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await axios.get(absolute, { headers, timeout: 20000, validateStatus: () => true });
  if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status} ao baixar item`);
  return res.data;
}

async function pullNow() {
  const cfg = await getSyncConfig();
  const local = await contentStore.readManifest(cfg.turmaId);
  const localEtag = local?._etag || null;

  const { notModified, etag, manifest } = await fetchManifest(cfg, { etag: localEtag });
  if (notModified) {
    return { ok: true, changed: false, message: "Sem atualizações (ETag).", turmaId: cfg.turmaId };
  }

  const m = (manifest && typeof manifest === "object") ? manifest : {};
  const items = Array.isArray(m.items) ? m.items : [];

  let downloaded = 0;
  for (const it of items) {
    const type = String(it.type || "misc");
    const id = String(it.id || "");
    if (!id) continue;

    const data = await fetchItem(cfg, it);
    const jsonStr = JSON.stringify(data);

    // Integridade (opcional)
    if (it.sha256) {
      const got = sha256Hex(Buffer.from(jsonStr, "utf8"));
      if (String(it.sha256).toLowerCase() !== got.toLowerCase()) {
        throw new Error(`hash inválido para ${type}/${id}`);
      }
    }

    await contentStore.writeItem(cfg.turmaId, type, id, data);
    downloaded++;
  }

  const enriched = { ...m, _etag: etag || null, _pulledAtISO: new Date().toISOString() };
  const manifestFile = await contentStore.writeManifest(cfg.turmaId, enriched);

  return {
    ok: true,
    changed: true,
    turmaId: cfg.turmaId,
    downloaded,
    manifestFile,
    manifestVersion: m.manifestVersion ?? null,
  };
}

function registrarSyncHandler() {
  ipcMain.handle("sync:status", async () => {
    try {
      const cfg = await getSyncConfig();
      if (!cfg.turmaId) return { ok: true, configured: false };
      const local = await contentStore.readManifest(cfg.turmaId);
      return {
        ok: true,
        configured: true,
        turmaId: cfg.turmaId,
        manifestVersion: local?.manifestVersion ?? null,
        updatedAtISO: local?._pulledAtISO ?? null,
      };
    } catch (e) {
      return { ok: false, erro: e?.message || String(e) };
    }
  });

  ipcMain.handle("sync:pullNow", async () => {
    try {
      console.log(`${LOG} pullNow solicitado`);
      return await pullNow();
    } catch (e) {
      console.error(`${LOG} pullNow falhou:`, e?.message || e);
      return { ok: false, erro: e?.message || String(e) };
    }
  });

  ipcMain.handle("sync:check", async () => {
    try {
      const cfg = await getSyncConfig();
      if (!cfg.turmaId) return { ok: true, configured: false };
      console.log(`${LOG} check solicitado`);
      return await checkUpdatesOnly();
    } catch (e) {
      console.error(`${LOG} check falhou:`, e?.message || e);
      return { ok: false, erro: e?.message || String(e) };
    }
  });

  console.log(`${LOG} IPC registrado: sync:status, sync:check, sync:pullNow`);
}

module.exports = { registrarSyncHandler };
