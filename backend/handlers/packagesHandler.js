// =============================================================================
// Caminho: backend/handlers/packagesHandler.js
// Objetivo:
//  - IPC para fluxo de "requests" e "packages" (troca assíncrona via API mínima).
//  - Nesta fase DEV o payload pode ser JSON (sem criptografia); a interface já
//    prevê evolução para blob criptografado.
//
// Env (fallback DEV):
//  - SYNC_HTTP_BASE_URL (mesmo usado pelo syncHandler)
//  - SYNC_TOKEN (opcional)
//
// Fonte de config preferida (por usuário):
//  - config/usuarios/<emailHash>.json -> remoteSync: { httpBaseUrl, token }
// =============================================================================

const { ipcMain } = require("electron");
const axios = require("axios");
const crypto = require("crypto");

const { obterEmailHashAtivo } = require("../lib/sessionStore");
const { loadUserByHash } = require("../lib/usuarioStore");
const packageStore = require("../lib/packageStore");
const cursorStore = require("../lib/syncCursorStore");
const { buildAlunoIncrementalPayload } = require("../lib/incrementalAlunoPackage");

const LOG = "📦 [packages]";

function normalizeBaseUrl(u) {
  return String(u || "").trim().replace(/\/+$/, "");
}

function sha256Hex(buf) {
  return crypto.createHash("sha256").update(Buffer.from(buf || Buffer.alloc(0))).digest("hex");
}

async function getRemoteConfig() {
  const emailHash = obterEmailHashAtivo();
  let cfg = null;
  if (emailHash) {
    try {
      const user = await loadUserByHash(emailHash);
      cfg = user?.remoteSync || null;
    } catch {}
  }

  const httpBaseUrl = normalizeBaseUrl(cfg?.httpBaseUrl || process.env.SYNC_HTTP_BASE_URL || "https://api.geea.com.br");
  const token = String(cfg?.token || process.env.SYNC_TOKEN || "").trim();

  return { httpBaseUrl, token, actorId: emailHash || "" };
}

async function getActorRolesOrEmpty(actorId) {
  const id = String(actorId || "").trim();
  if (!id) return [];
  try {
    const user = await loadUserByHash(id);
    return Array.isArray(user?.roles) ? user.roles.map((r) => String(r || "").trim().toLowerCase()) : [];
  } catch {
    return [];
  }
}

async function requireAnyRole(actorId, roles) {
  const want = new Set((roles || []).map((r) => String(r || "").trim().toLowerCase()).filter(Boolean));
  if (want.size === 0) return true;
  const got = new Set(await getActorRolesOrEmpty(actorId));
  for (const r of want) if (got.has(r)) return true;
  throw new Error(`Acesso restrito: role(s) necessária(s): ${Array.from(want).join(", ")}`);
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function linkInvite({ alunoId }) {
  const cfg = await getRemoteConfig();
  if (!cfg.actorId) throw new Error("Sessão inativa (actorId ausente).");
  await requireAnyRole(cfg.actorId, ["dirigente", "analista"]);
  const a = String(alunoId || "").trim();
  if (!a) throw new Error("alunoId ausente");

  const url = `${cfg.httpBaseUrl}/api/links/invite`;
  const res = await axios.post(
    url,
    { dirigenteId: cfg.actorId, alunoId: a },
    { headers: { "content-type": "application/json", ...authHeaders(cfg.token) }, timeout: 15000, validateStatus: () => true }
  );
  if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status} ao convidar vínculo`);
  return { ok: true, link: res.data?.link || res.data };
}

async function linkConfirm({ linkId }) {
  const cfg = await getRemoteConfig();
  if (!cfg.actorId) throw new Error("Sessão inativa (actorId ausente).");
  await requireAnyRole(cfg.actorId, ["aluno"]);
  const id = String(linkId || "").trim();
  if (!id) throw new Error("linkId ausente");

  const url = `${cfg.httpBaseUrl}/api/links/${encodeURIComponent(id)}/confirm`;
  const res = await axios.post(
    url,
    { actorId: cfg.actorId },
    { headers: { "content-type": "application/json", ...authHeaders(cfg.token) }, timeout: 15000, validateStatus: () => true }
  );
  if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status} ao confirmar vínculo`);
  return { ok: true, link: res.data?.link || res.data };
}

async function linkListMine() {
  const cfg = await getRemoteConfig();
  if (!cfg.actorId) throw new Error("Sessão inativa (actorId ausente).");
  const url = `${cfg.httpBaseUrl}/api/links`;
  const res = await axios.get(url, {
    headers: authHeaders(cfg.token),
    timeout: 15000,
    validateStatus: () => true,
    params: { actor: cfg.actorId },
  });
  if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status} ao listar vínculos`);
  return { ok: true, links: Array.isArray(res.data?.links) ? res.data.links : res.data };
}

async function listOpenRequests() {
  const cfg = await getRemoteConfig();
  if (!cfg.actorId) throw new Error("Sessão inativa (actorId ausente).");
  const url = `${cfg.httpBaseUrl}/api/requests`;
  const res = await axios.get(url, {
    headers: authHeaders(cfg.token),
    timeout: 15000,
    validateStatus: () => true,
    params: { to: cfg.actorId, status: "open", available: "1" },
  });
  if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status} ao listar requests`);
  return { ok: true, requests: Array.isArray(res.data?.requests) ? res.data.requests : res.data };
}

async function createRequest({ toId, turmaId = "", type = "materials_request", availableAtISO = "", dueAtISO = "" }) {
  const cfg = await getRemoteConfig();
  if (!cfg.actorId) throw new Error("Sessão inativa (actorId ausente).");
  await requireAnyRole(cfg.actorId, ["dirigente", "analista"]);
  const to = String(toId || "").trim();
  if (!to) throw new Error("toId ausente");

  const url = `${cfg.httpBaseUrl}/api/requests`;
  const res = await axios.post(
    url,
    {
      turmaId: String(turmaId || "").trim(),
      fromId: cfg.actorId,
      toId: to,
      type: String(type || "materials_request").trim(),
      availableAtISO: String(availableAtISO || "").trim(),
      dueAtISO: String(dueAtISO || "").trim(),
    },
    { headers: { "content-type": "application/json", ...authHeaders(cfg.token) }, timeout: 15000, validateStatus: () => true }
  );
  if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status} ao criar request`);
  return { ok: true, request: res.data?.request || res.data };
}

async function listPendingPackages() {
  const cfg = await getRemoteConfig();
  if (!cfg.actorId) throw new Error("Sessão inativa (actorId ausente).");
  // Neste momento, usamos packages principalmente para dirigente receber respostas.
  await requireAnyRole(cfg.actorId, ["dirigente", "analista"]);
  const url = `${cfg.httpBaseUrl}/api/packages`;
  const res = await axios.get(url, {
    headers: authHeaders(cfg.token),
    timeout: 15000,
    validateStatus: () => true,
    params: { to: cfg.actorId, status: "pending", available: "1" },
  });
  if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status} ao listar packages`);
  return { ok: true, packages: Array.isArray(res.data?.packages) ? res.data.packages : res.data };
}

async function downloadPackage({ packageId }) {
  const cfg = await getRemoteConfig();
  if (!cfg.actorId) throw new Error("Sessão inativa (actorId ausente).");
  await requireAnyRole(cfg.actorId, ["dirigente", "analista"]);
  if (!packageId) throw new Error("packageId ausente");

  const url = `${cfg.httpBaseUrl}/api/packages/${encodeURIComponent(packageId)}/blob`;
  const res = await axios.get(url, {
    headers: authHeaders(cfg.token),
    timeout: 20000,
    validateStatus: () => true,
    responseType: "arraybuffer",
  });
  if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status} ao baixar blob`);

  const buf = Buffer.from(res.data || Buffer.alloc(0));
  const filePath = await packageStore.writeInbox(packageId, buf);
  const hash = sha256Hex(buf);

  // best-effort: marcar como downloaded
  try {
    await axios.post(
      `${cfg.httpBaseUrl}/api/packages/${encodeURIComponent(packageId)}/downloaded`,
      { downloadedAtISO: new Date().toISOString() },
      { headers: { "content-type": "application/json", ...authHeaders(cfg.token) }, timeout: 8000, validateStatus: () => true }
    );
  } catch {}

  return { ok: true, packageId, filePath, size: buf.length, sha256: hash };
}

async function markApplied({ packageId, ok = true, error = "" }) {
  const cfg = await getRemoteConfig();
  if (!cfg.actorId) throw new Error("Sessão inativa (actorId ausente).");
  await requireAnyRole(cfg.actorId, ["dirigente", "analista"]);
  if (!packageId) throw new Error("packageId ausente");

  const url = `${cfg.httpBaseUrl}/api/packages/${encodeURIComponent(packageId)}/applied`;
  const res = await axios.post(
    url,
    { ok: Boolean(ok), error: String(error || ""), appliedAtISO: new Date().toISOString() },
    { headers: { "content-type": "application/json", ...authHeaders(cfg.token) }, timeout: 15000, validateStatus: () => true }
  );
  if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status} ao confirmar applied`);

  // local cleanup (best-effort)
  try { await packageStore.deleteInbox(packageId); } catch {}

  return { ok: true };
}

async function uploadResponseForRequest({ requestId, payload }) {
  const cfg = await getRemoteConfig();
  if (!cfg.actorId) throw new Error("Sessão inativa (actorId ausente).");
  await requireAnyRole(cfg.actorId, ["aluno"]);
  if (!requestId) throw new Error("requestId ausente");

  const buf = Buffer.from(JSON.stringify(payload ?? {}, null, 2), "utf8");
  const sha256 = sha256Hex(buf);

  // 1) criar package e obter uploadUrl
  const createUrl = `${cfg.httpBaseUrl}/api/packages`;
  const createRes = await axios.post(
    createUrl,
    {
      kind: "response",
      requestId: String(requestId),
      fromId: cfg.actorId,
      sha256,
      size: buf.length,
      contentType: "application/json",
    },
    { headers: { "content-type": "application/json", ...authHeaders(cfg.token) }, timeout: 15000, validateStatus: () => true }
  );
  if (createRes.status < 200 || createRes.status >= 300) throw new Error(`HTTP ${createRes.status} ao criar package`);

  const pkg = createRes.data || {};
  const packageId = pkg.packageId;
  const uploadUrl = pkg.uploadUrl;
  if (!packageId || !uploadUrl) throw new Error("API não retornou packageId/uploadUrl");

  await packageStore.writeOutbox(packageId, buf).catch(() => {});

  // 2) upload do blob
  const putRes = await axios.put(uploadUrl, buf, {
    headers: { "content-type": "application/octet-stream", ...authHeaders(cfg.token) },
    timeout: 20000,
    validateStatus: () => true,
  });
  if (putRes.status < 200 || putRes.status >= 300) throw new Error(`HTTP ${putRes.status} ao enviar blob`);

  return { ok: true, packageId };
}

async function fetchRequestById(requestId) {
  const cfg = await getRemoteConfig();
  if (!cfg.actorId) throw new Error("Sessão inativa (actorId ausente).");
  const id = String(requestId || "").trim();
  if (!id) throw new Error("requestId ausente");

  const url = `${cfg.httpBaseUrl}/api/requests/${encodeURIComponent(id)}`;
  const res = await axios.get(url, { headers: authHeaders(cfg.token), timeout: 15000, validateStatus: () => true });
  if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status} ao obter request`);
  return res.data?.request || res.data;
}

function cursorKeyForAlunoToDirigente({ alunoId, dirigenteId }) {
  return `aluno2dirigente:${String(alunoId || "").trim()}:${String(dirigenteId || "").trim()}`;
}

async function uploadResponseForRequestAuto({ requestId, force = false }) {
  const cfg = await getRemoteConfig();
  if (!cfg.actorId) throw new Error("Sessão inativa (actorId ausente).");
  await requireAnyRole(cfg.actorId, ["aluno"]);
  const req = await fetchRequestById(requestId);
  const dirigenteId = String(req?.fromId || "").trim();
  if (!dirigenteId) throw new Error("request inválida (fromId ausente)");

  const key = cursorKeyForAlunoToDirigente({ alunoId: cfg.actorId, dirigenteId });
  const cursorFromISO = await cursorStore.getCursor(key);

  const built = await buildAlunoIncrementalPayload({ emailHash: cfg.actorId, cursorFromISO });
  if (!built.hasAny && !force) {
    return { ok: true, skipped: true, reason: "Sem mudanças desde o último envio.", cursorFromISO: built.cursorFromISO, cursorToISO: built.cursorToISO };
  }

  const resp = await uploadResponseForRequest({ requestId, payload: built.payload });
  if (resp?.ok) {
    await cursorStore.setCursor(key, built.cursorToISO);
  }
  return { ok: true, ...resp, cursorFromISO: built.cursorFromISO, cursorToISO: built.cursorToISO, items: built.payload?.resources };
}

function registrarPackagesHandler() {
  ipcMain.handle("links:invite", async (_evt, payload) => {
    try {
      return await linkInvite(payload || {});
    } catch (e) {
      console.error(`${LOG} links:invite falhou:`, e?.message || e);
      return { ok: false, erro: e?.message || String(e) };
    }
  });

  ipcMain.handle("links:confirm", async (_evt, payload) => {
    try {
      return await linkConfirm(payload || {});
    } catch (e) {
      console.error(`${LOG} links:confirm falhou:`, e?.message || e);
      return { ok: false, erro: e?.message || String(e) };
    }
  });

  ipcMain.handle("links:listMine", async () => {
    try {
      return await linkListMine();
    } catch (e) {
      console.error(`${LOG} links:listMine falhou:`, e?.message || e);
      return { ok: false, erro: e?.message || String(e) };
    }
  });

  ipcMain.handle("requests:create", async (_evt, payload) => {
    try {
      return await createRequest(payload || {});
    } catch (e) {
      console.error(`${LOG} requests:create falhou:`, e?.message || e);
      return { ok: false, erro: e?.message || String(e) };
    }
  });

  ipcMain.handle("requests:listOpen", async () => {
    try {
      return await listOpenRequests();
    } catch (e) {
      console.error(`${LOG} requests:listOpen falhou:`, e?.message || e);
      return { ok: false, erro: e?.message || String(e) };
    }
  });

  ipcMain.handle("packages:listPending", async () => {
    try {
      return await listPendingPackages();
    } catch (e) {
      console.error(`${LOG} packages:listPending falhou:`, e?.message || e);
      return { ok: false, erro: e?.message || String(e) };
    }
  });

  ipcMain.handle("packages:download", async (_evt, payload) => {
    try {
      return await downloadPackage(payload || {});
    } catch (e) {
      console.error(`${LOG} packages:download falhou:`, e?.message || e);
      return { ok: false, erro: e?.message || String(e) };
    }
  });

  ipcMain.handle("packages:markApplied", async (_evt, payload) => {
    try {
      return await markApplied(payload || {});
    } catch (e) {
      console.error(`${LOG} packages:markApplied falhou:`, e?.message || e);
      return { ok: false, erro: e?.message || String(e) };
    }
  });

  ipcMain.handle("responses:uploadForRequest", async (_evt, payload) => {
    try {
      return await uploadResponseForRequest(payload || {});
    } catch (e) {
      console.error(`${LOG} responses:uploadForRequest falhou:`, e?.message || e);
      return { ok: false, erro: e?.message || String(e) };
    }
  });

  ipcMain.handle("responses:uploadForRequestAuto", async (_evt, payload) => {
    try {
      return await uploadResponseForRequestAuto(payload || {});
    } catch (e) {
      console.error(`${LOG} responses:uploadForRequestAuto falhou:`, e?.message || e);
      return { ok: false, erro: e?.message || String(e) };
    }
  });

  console.log(`${LOG} IPC registrado: links:invite, links:confirm, links:listMine, requests:create, requests:listOpen, packages:listPending, packages:download, packages:markApplied, responses:uploadForRequest, responses:uploadForRequestAuto`);
}

module.exports = { registrarPackagesHandler };
