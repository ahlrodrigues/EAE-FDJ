/* eslint-disable no-console */
// =============================================================================
// Mock API + WebSocket (DEV)
// - HTTP: manifest + itens
// - WS: updateAvailable
//
// Objetivo: permitir testar localmente o fluxo "WS avisa / aluno clica Atualizar / app faz pull"
// =============================================================================

const http = require("http");
const crypto = require("crypto");
const { URL } = require("url");
const { WebSocketServer, WebSocket } = require("ws");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.MOCK_API_PORT || 8789);
const HOST = process.env.MOCK_API_HOST || "127.0.0.1";

const STORAGE_DIR = path.join(__dirname, "_storage");

function ensureStorageDir() {
  try { fs.mkdirSync(STORAGE_DIR, { recursive: true }); } catch {}
}

function json(res, status, body, extraHeaders = {}) {
  const payload = Buffer.from(JSON.stringify(body), "utf8");
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": String(payload.length),
    ...extraHeaders,
  });
  res.end(payload);
}

function text(res, status, body, extraHeaders = {}) {
  const payload = Buffer.from(String(body), "utf8");
  res.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "content-length": String(payload.length),
    ...extraHeaders,
  });
  res.end(payload);
}

function sha256HexFromJson(obj) {
  const jsonStr = JSON.stringify(obj);
  return crypto.createHash("sha256").update(Buffer.from(jsonStr, "utf8")).digest("hex");
}

function getTurmaState(turmaId) {
  if (!turmaState.has(turmaId)) {
    turmaState.set(turmaId, {
      manifestVersion: 1,
      updatedAtISO: new Date().toISOString(),
      itemVersions: {
        tema_schedule: 1,
        aviso_dirigente_feed: 1,
        mensagem_mentor_turma: 1,
      },
    });
  }
  return turmaState.get(turmaId);
}

function buildTemaCatalog() {
  // Catálogo global: títulos "oficiais" dos temas
  const items = [
    { temaNumero: 1, temaTitulo: "Seu mau humor não modifica a vida.", temaLabel: "1. Seu mau humor não modifica a vida." },
    { temaNumero: 2, temaTitulo: "Nunca desanime diante das lutas.", temaLabel: "2. Nunca desanime diante das lutas." },
    { temaNumero: 3, temaTitulo: "O tempo é recurso precioso.", temaLabel: "3. O tempo é recurso precioso." },
    { temaNumero: 4, temaTitulo: "A disciplina é caminho de liberdade.", temaLabel: "4. A disciplina é caminho de liberdade." },
    { temaNumero: 5, temaTitulo: "Gentileza também é força.", temaLabel: "5. Gentileza também é força." },
    { temaNumero: 6, temaTitulo: "A fé se pratica no cotidiano.", temaLabel: "6. A fé se pratica no cotidiano." },
    { temaNumero: 7, temaTitulo: "Aprender é transformar-se.", temaLabel: "7. Aprender é transformar-se." },
    { temaNumero: 8, temaTitulo: "Cuidar da palavra é cuidar do coração.", temaLabel: "8. Cuidar da palavra é cuidar do coração." },
    { temaNumero: 9, temaTitulo: "O bem se faz com constância.", temaLabel: "9. O bem se faz com constância." },
    { temaNumero: 10, temaTitulo: "Servir é engrandecer a vida.", temaLabel: "10. Servir é engrandecer a vida." },
  ];

  return {
    schemaVersion: 1,
    type: "tema_catalog",
    version: 1,
    items,
  };
}

function loadProgramaAulasEae() {
  try {
    const p = path.join(__dirname, "..", "..", "backend", "data", "programa_aulas_eae.json");
    const raw = fs.readFileSync(p, "utf8");
    const j = JSON.parse(raw);
    return { ...j, version: 1 };
  } catch {
    return { schemaVersion: 1, type: "programa_aulas_eae", version: 1, temaMap: [] };
  }
}

function buildTemaSchedule(turmaId, version) {
  // Agenda por turma: apenas número + data (app completa com título via tema_catalog)
  // Começa na próxima segunda (ex.: 2026-04-13) e segue semanalmente.
  const start = new Date("2026-04-13T00:00:00-03:00");
  const items = [];
  for (let i = 0; i < 10; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i * 7);
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    items.push({ temaNumero: i + 1, dataPublicacaoISO: `${yyyy}-${mm}-${dd}` });
  }

  return {
    schemaVersion: 1,
    type: "tema_schedule",
    turmaId,
    version,
    timezone: "America/Sao_Paulo",
    publishedAtHourLocal: "06:00",
    items,
  };
}

function buildAvisoDirigenteFeed(turmaId, version) {
  return {
    schemaVersion: 1,
    type: "aviso_dirigente_feed",
    turmaId,
    version,
    items: [
      {
        id: "aviso-001",
        titulo: "Aviso do Dirigente",
        mensagem: "Bem-vindos! Mantenham a assiduidade e observem o calendário de temas.",
        publicadoEmISO: "2026-04-11T12:00:00-03:00",
      },
    ],
  };
}

function buildMensagemMentorTurma(turmaId, version) {
  return {
    schemaVersion: 1,
    type: "mensagem_mentor_turma",
    turmaId,
    version,
    mensagem: "Mantenham a serenidade e a disciplina. A caminhada é diária, passo a passo.",
    publicadoEmISO: "2026-04-11T12:10:00-03:00",
  };
}

function buildManifest(baseUrl, turmaId) {
  const state = getTurmaState(turmaId);

  const temaCatalog = buildTemaCatalog();
  const programaAulas = loadProgramaAulasEae();
  const schedule = buildTemaSchedule(turmaId, state.itemVersions.tema_schedule);
  const avisoFeed = buildAvisoDirigenteFeed(turmaId, state.itemVersions.aviso_dirigente_feed);
  const mentor = buildMensagemMentorTurma(turmaId, state.itemVersions.mensagem_mentor_turma);

  const items = [
    {
      type: "tema_catalog",
      id: "global",
      version: temaCatalog.version,
      url: `/api/content/tema_catalog/global?v=${temaCatalog.version}`,
      sha256: sha256HexFromJson(temaCatalog),
    },
    {
      type: "programa_aulas_eae",
      id: "global",
      version: programaAulas.version || 1,
      url: `/api/content/programa_aulas_eae/global?v=${programaAulas.version || 1}`,
      sha256: sha256HexFromJson(programaAulas),
    },
    {
      type: "tema_schedule",
      id: turmaId,
      version: schedule.version,
      url: `/api/turmas/${encodeURIComponent(turmaId)}/tema-schedule?v=${schedule.version}`,
      sha256: sha256HexFromJson(schedule),
    },
    {
      type: "aviso_dirigente_feed",
      id: turmaId,
      version: avisoFeed.version,
      url: `/api/turmas/${encodeURIComponent(turmaId)}/aviso-dirigente-feed?v=${avisoFeed.version}`,
      sha256: sha256HexFromJson(avisoFeed),
    },
    {
      type: "mensagem_mentor_turma",
      id: turmaId,
      version: mentor.version,
      url: `/api/turmas/${encodeURIComponent(turmaId)}/mensagem-mentor-turma?v=${mentor.version}`,
      sha256: sha256HexFromJson(mentor),
    },
  ];

  return {
    schemaVersion: 1,
    turmaId,
    manifestVersion: state.manifestVersion,
    updatedAtISO: state.updatedAtISO,
    minAppVersion: "1.0.0",
    baseUrl,
    items,
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function match(pathname, pattern) {
  const pathParts = String(pathname || "").split("/").filter(Boolean);
  const patParts = String(pattern || "").split("/").filter(Boolean);
  if (pathParts.length !== patParts.length) return null;
  const params = {};
  for (let i = 0; i < patParts.length; i++) {
    const pp = patParts[i];
    const pv = pathParts[i];
    if (pp.startsWith(":")) params[pp.slice(1)] = decodeURIComponent(pv);
    else if (pp !== pv) return null;
  }
  return params;
}

function nowIso() {
  return new Date().toISOString();
}

function randomIdHex(bytes = 16) {
  return crypto.randomBytes(bytes).toString("hex");
}

function parseJsonBody(buf) {
  try {
    const raw = Buffer.from(buf || Buffer.alloc(0)).toString("utf8");
    if (!raw.trim()) return {};
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isAvailable(availableAtISO) {
  const s = String(availableAtISO || "").trim();
  if (!s) return true;
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return true;
  return Date.now() >= t;
}

function safeEq(a, b) {
  return String(a || "").trim() === String(b || "").trim();
}

const turmaState = new Map();
const clientsByTurmaId = new Map(); // turmaId -> Set<ws>

// Estado DEV (em memória)
const requestsById = new Map(); // requestId -> request
const packagesById = new Map(); // packageId -> package
const linksById = new Map(); // linkId -> link

function linkKey(dirigenteId, alunoId) {
  return `${String(dirigenteId || "").trim()}::${String(alunoId || "").trim()}`;
}

function findActiveLink({ dirigenteId, alunoId }) {
  const key = linkKey(dirigenteId, alunoId);
  for (const l of linksById.values()) {
    if (l.key === key && l.status === "active") return l;
  }
  return null;
}

function requireActiveLinkOr403(res, { dirigenteId, alunoId }) {
  const d = String(dirigenteId || "").trim();
  const a = String(alunoId || "").trim();
  if (!d || !a) {
    json(res, 400, { ok: false, erro: "dirigenteId/alunoId obrigatórios" });
    return null;
  }
  const l = findActiveLink({ dirigenteId: d, alunoId: a });
  if (!l) {
    json(res, 403, { ok: false, erro: "vínculo inexistente ou não confirmado" });
    return null;
  }
  return l;
}

function broadcastUpdate(turmaId, payload) {
  const set = clientsByTurmaId.get(turmaId);
  if (!set || set.size === 0) return 0;
  const msg = JSON.stringify(payload);
  let sent = 0;
  for (const ws of set) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
      sent++;
    }
  }
  return sent;
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = u.pathname;
  const baseUrl = `http://${HOST}:${PORT}`;

  if (req.method === "GET" && pathname === "/api/health") {
    return json(res, 200, { ok: true, nowISO: new Date().toISOString() });
  }

  // ===========================================================================
  // Requests + Packages (DEV)
  // ===========================================================================
  if (req.method === "POST" && pathname === "/api/links/invite") {
    const bodyRaw = await readBody(req).catch(() => Buffer.from(""));
    const body = parseJsonBody(bodyRaw);
    if (!body) return json(res, 400, { ok: false, erro: "JSON inválido" });

    const dirigenteId = String(body.dirigenteId || body.fromId || "").trim();
    const alunoId = String(body.alunoId || body.toId || "").trim();
    if (!dirigenteId || !alunoId) return json(res, 400, { ok: false, erro: "dirigenteId/alunoId obrigatórios" });

    // Se já houver ativo, retorna o existente
    const existing = findActiveLink({ dirigenteId, alunoId });
    if (existing) return json(res, 200, { ok: true, link: existing, already: true });

    const linkId = `lnk_${randomIdHex(12)}`;
    const l = {
      linkId,
      key: linkKey(dirigenteId, alunoId),
      dirigenteId,
      alunoId,
      status: "pending",
      createdAtISO: nowIso(),
      confirmedAtISO: null,
      revokedAtISO: null,
    };
    linksById.set(linkId, l);
    return json(res, 201, { ok: true, link: l });
  }

  const mLinkConfirm = match(pathname, "/api/links/:linkId/confirm");
  if (req.method === "POST" && mLinkConfirm) {
    const { linkId } = mLinkConfirm;
    const l = linksById.get(linkId);
    if (!l) return json(res, 404, { ok: false, erro: "vínculo não encontrado" });
    if (l.status === "active") return json(res, 200, { ok: true, link: l, already: true });

    const bodyRaw = await readBody(req).catch(() => Buffer.from(""));
    const body = parseJsonBody(bodyRaw);
    if (!body) return json(res, 400, { ok: false, erro: "JSON inválido" });
    const actorId = String(body.actorId || "").trim();
    if (!actorId) return json(res, 400, { ok: false, erro: "actorId obrigatório" });
    if (!safeEq(actorId, l.alunoId)) return json(res, 403, { ok: false, erro: "somente o aluno pode confirmar" });

    l.status = "active";
    l.confirmedAtISO = nowIso();
    return json(res, 200, { ok: true, link: l });
  }

  if (req.method === "GET" && pathname === "/api/links") {
    const actor = String(u.searchParams.get("actor") || "").trim();
    let arr = Array.from(linksById.values());
    if (actor) {
      arr = arr.filter((l) => safeEq(l.dirigenteId, actor) || safeEq(l.alunoId, actor));
    }
    arr.sort((a, b) => String(b.createdAtISO || "").localeCompare(String(a.createdAtISO || "")));
    return json(res, 200, { ok: true, links: arr });
  }

  if (req.method === "POST" && pathname === "/api/requests") {
    const bodyRaw = await readBody(req).catch(() => Buffer.from(""));
    const body = parseJsonBody(bodyRaw);
    if (!body) return json(res, 400, { ok: false, erro: "JSON inválido" });

    const requestId = `req_${randomIdHex(12)}`;
    const turmaId = String(body.turmaId || "").trim();
    const fromId = String(body.fromId || "").trim();
    const toId = String(body.toId || "").trim();
    const type = String(body.type || "materials_request").trim();
    const availableAtISO = String(body.availableAtISO || "").trim() || nowIso();
    const dueAtISO = String(body.dueAtISO || "").trim() || "";

    if (!fromId || !toId) return json(res, 400, { ok: false, erro: "fromId/toId obrigatórios" });

    // Requisito: vínculo ativo entre dirigente (fromId) e aluno (toId)
    if (!requireActiveLinkOr403(res, { dirigenteId: fromId, alunoId: toId })) return;

    const r = {
      requestId,
      turmaId: turmaId || null,
      fromId,
      toId,
      type,
      status: "open",
      createdAtISO: nowIso(),
      availableAtISO,
      dueAtISO: dueAtISO || null,
    };
    requestsById.set(requestId, r);
    return json(res, 201, { ok: true, request: r });
  }

  if (req.method === "GET" && pathname === "/api/requests") {
    const to = u.searchParams.get("to");
    const status = u.searchParams.get("status") || "";
    const available = u.searchParams.get("available") === "1";

    let arr = Array.from(requestsById.values());
    if (to) arr = arr.filter((r) => safeEq(r.toId, to));
    if (status) arr = arr.filter((r) => safeEq(r.status, status));
    if (available) arr = arr.filter((r) => isAvailable(r.availableAtISO));

    // Ordem: mais recentes primeiro
    arr.sort((a, b) => String(b.createdAtISO || "").localeCompare(String(a.createdAtISO || "")));
    return json(res, 200, { ok: true, requests: arr });
  }

  const mRequestGet = match(pathname, "/api/requests/:requestId");
  if (req.method === "GET" && mRequestGet) {
    const { requestId } = mRequestGet;
    const r = requestsById.get(requestId);
    if (!r) return json(res, 404, { ok: false, erro: "request não encontrada" });
    return json(res, 200, { ok: true, request: r });
  }

  if (req.method === "GET" && pathname === "/api/packages") {
    const to = u.searchParams.get("to");
    const status = u.searchParams.get("status") || "";
    const available = u.searchParams.get("available") === "1";

    let arr = Array.from(packagesById.values());
    if (to) arr = arr.filter((p) => safeEq(p.toId, to));
    if (status) arr = arr.filter((p) => safeEq(p.status, status));
    if (available) arr = arr.filter((p) => isAvailable(p.availableAtISO));

    arr.sort((a, b) => String(b.createdAtISO || "").localeCompare(String(a.createdAtISO || "")));
    return json(res, 200, { ok: true, packages: arr });
  }

  if (req.method === "POST" && pathname === "/api/packages") {
    ensureStorageDir();
    const bodyRaw = await readBody(req).catch(() => Buffer.from(""));
    const body = parseJsonBody(bodyRaw);
    if (!body) return json(res, 400, { ok: false, erro: "JSON inválido" });

    const kind = String(body.kind || "content").trim();
    const requestId = String(body.requestId || "").trim();
    const fromId = String(body.fromId || "").trim();
    let toId = String(body.toId || "").trim();
    const availableAtISO = String(body.availableAtISO || "").trim() || nowIso();

    if (!fromId) return json(res, 400, { ok: false, erro: "fromId obrigatório" });

    // Regras: response deve referenciar request aberta e definir destinatário conforme request
    let linkedRequest = null;
    if (kind === "response") {
      if (!requestId) return json(res, 400, { ok: false, erro: "requestId obrigatório para kind=response" });
      linkedRequest = requestsById.get(requestId);
      if (!linkedRequest) return json(res, 404, { ok: false, erro: "request não encontrada" });
      if (linkedRequest.status !== "open") return json(res, 409, { ok: false, erro: "request não está aberta" });
      if (!safeEq(fromId, linkedRequest.toId)) return json(res, 403, { ok: false, erro: "fromId não autorizado para esta request" });
      toId = linkedRequest.fromId;
      // Requisito: vínculo ativo ainda existe
      if (!requireActiveLinkOr403(res, { dirigenteId: linkedRequest.fromId, alunoId: linkedRequest.toId })) return;
      // response só fica disponível quando a request estiver disponível
      if (linkedRequest.availableAtISO) {
        if (!isAvailable(linkedRequest.availableAtISO)) return json(res, 423, { ok: false, erro: "request indisponível (availableAtISO)" });
      }
    } else {
      if (!toId) return json(res, 400, { ok: false, erro: "toId obrigatório" });
      // kind=content (ou outros): requer vínculo ativo
      if (!requireActiveLinkOr403(res, { dirigenteId: fromId, alunoId: toId })) return;
    }

    const packageId = `pkg_${randomIdHex(12)}`;
    const objectPath = path.join(STORAGE_DIR, `${packageId}.bin`);
    const p = {
      packageId,
      kind,
      requestId: requestId || null,
      fromId,
      toId,
      turmaId: String(body.turmaId || "").trim() || null,
      contentType: String(body.contentType || "application/octet-stream"),
      sha256: String(body.sha256 || "").trim() || null,
      size: Number.isFinite(Number(body.size)) ? Number(body.size) : null,
      status: "pending",
      createdAtISO: nowIso(),
      availableAtISO,
      objectKey: `${packageId}.bin`,
      _objectPath: objectPath,
    };

    packagesById.set(packageId, p);
    return json(res, 201, {
      ok: true,
      packageId,
      uploadUrl: `${baseUrl}/api/packages/${encodeURIComponent(packageId)}/blob`,
      downloadUrl: `${baseUrl}/api/packages/${encodeURIComponent(packageId)}/blob`,
      package: p,
    });
  }

  const mPkgBlob = match(pathname, "/api/packages/:packageId/blob");
  if (mPkgBlob && req.method === "PUT") {
    ensureStorageDir();
    const { packageId } = mPkgBlob;
    const p = packagesById.get(packageId);
    if (!p) return json(res, 404, { ok: false, erro: "package não encontrada" });

    const buf = await readBody(req).catch(() => Buffer.from(""));
    fs.writeFileSync(p._objectPath, Buffer.from(buf || Buffer.alloc(0)));

    const size = Buffer.byteLength(buf || Buffer.alloc(0));
    const gotSha = crypto.createHash("sha256").update(Buffer.from(buf || Buffer.alloc(0))).digest("hex");
    p.size = size;
    p.sha256 = gotSha;
    p.uploadedAtISO = nowIso();

    return json(res, 200, { ok: true, packageId, size, sha256: gotSha });
  }

  if (mPkgBlob && req.method === "GET") {
    ensureStorageDir();
    const { packageId } = mPkgBlob;
    const p = packagesById.get(packageId);
    if (!p) return json(res, 404, { ok: false, erro: "package não encontrada" });
    if (!isAvailable(p.availableAtISO)) return json(res, 423, { ok: false, erro: "package indisponível (availableAtISO)" });

    let buf = null;
    try {
      buf = fs.readFileSync(p._objectPath);
    } catch {
      return json(res, 410, { ok: false, erro: "blob não encontrado (expirado/removido)" });
    }

    res.writeHead(200, {
      "content-type": "application/octet-stream",
      "content-length": String(buf.length),
      "x-package-id": p.packageId,
      "x-package-sha256": String(p.sha256 || ""),
    });
    res.end(buf);
    return;
  }

  const mPkgDownloaded = match(pathname, "/api/packages/:packageId/downloaded");
  if (mPkgDownloaded && req.method === "POST") {
    const { packageId } = mPkgDownloaded;
    const p = packagesById.get(packageId);
    if (!p) return json(res, 404, { ok: false, erro: "package não encontrada" });
    if (p.status === "pending") p.status = "downloaded";
    p.downloadedAtISO = nowIso();
    return json(res, 200, { ok: true });
  }

  const mPkgApplied = match(pathname, "/api/packages/:packageId/applied");
  if (mPkgApplied && req.method === "POST") {
    const { packageId } = mPkgApplied;
    const p = packagesById.get(packageId);
    if (!p) return json(res, 404, { ok: false, erro: "package não encontrada" });

    const bodyRaw = await readBody(req).catch(() => Buffer.from(""));
    const body = parseJsonBody(bodyRaw);
    if (!body) return json(res, 400, { ok: false, erro: "JSON inválido" });

    p.appliedAtISO = String(body.appliedAtISO || "").trim() || nowIso();
    p.appliedOk = Boolean(body.ok);
    p.appliedError = String(body.error || "").trim() || null;
    p.status = body.ok ? "applied" : "failed";

    // limpeza imediata (DEV)
    try { fs.unlinkSync(p._objectPath); } catch {}

    return json(res, 200, { ok: true });
  }

  const mManifest = match(pathname, "/api/turmas/:turmaId/manifest");
  if (req.method === "GET" && mManifest) {
    const { turmaId } = mManifest;
    const state = getTurmaState(turmaId);
    const etag = `W/"${state.manifestVersion}"`;
    if (req.headers["if-none-match"] && String(req.headers["if-none-match"]).trim() === etag) {
      res.writeHead(304, { etag });
      return res.end();
    }
    const manifest = buildManifest(baseUrl, turmaId);
    return json(res, 200, manifest, { etag });
  }

  if (req.method === "GET" && pathname === "/api/content/tema_catalog/global") {
    return json(res, 200, buildTemaCatalog());
  }

  if (req.method === "GET" && pathname === "/api/content/programa_aulas_eae/global") {
    return json(res, 200, loadProgramaAulasEae());
  }

  const mSchedule = match(pathname, "/api/turmas/:turmaId/tema-schedule");
  if (req.method === "GET" && mSchedule) {
    const { turmaId } = mSchedule;
    const state = getTurmaState(turmaId);
    return json(res, 200, buildTemaSchedule(turmaId, state.itemVersions.tema_schedule));
  }

  const mAviso = match(pathname, "/api/turmas/:turmaId/aviso-dirigente-feed");
  if (req.method === "GET" && mAviso) {
    const { turmaId } = mAviso;
    const state = getTurmaState(turmaId);
    return json(res, 200, buildAvisoDirigenteFeed(turmaId, state.itemVersions.aviso_dirigente_feed));
  }

  const mMentor = match(pathname, "/api/turmas/:turmaId/mensagem-mentor-turma");
  if (req.method === "GET" && mMentor) {
    const { turmaId } = mMentor;
    const state = getTurmaState(turmaId);
    return json(res, 200, buildMensagemMentorTurma(turmaId, state.itemVersions.mensagem_mentor_turma));
  }

  const mNotify = match(pathname, "/api/turmas/:turmaId/notify-update");
  if (req.method === "POST" && mNotify) {
    const { turmaId } = mNotify;
    const state = getTurmaState(turmaId);
    state.manifestVersion++;
    state.updatedAtISO = new Date().toISOString();

    // Opcional: bump de um item para simular mudança real
    state.itemVersions.aviso_dirigente_feed++;

    const bodyRaw = await readBody(req).catch(() => Buffer.from(""));
    const summary = bodyRaw.length ? bodyRaw.toString("utf8").slice(0, 200) : "Atualização disponível";
    const payload = {
      type: "updateAvailable",
      turmaId,
      manifestVersion: state.manifestVersion,
      updatedAtISO: state.updatedAtISO,
      summary,
    };
    const sent = broadcastUpdate(turmaId, payload);
    return json(res, 200, { ok: true, sent, payload });
  }

  return text(res, 404, "Not found");
});

const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (ws) => {
  let subscribedTurmaId = null;

  ws.on("message", (buf) => {
    let msg = null;
    try {
      msg = JSON.parse(String(buf || ""));
    } catch {
      return;
    }
    if (!msg || typeof msg !== "object") return;

    if (msg.type === "subscribe" && msg.turmaId) {
      const turmaId = String(msg.turmaId).trim();
      subscribedTurmaId = turmaId;
      if (!clientsByTurmaId.has(turmaId)) clientsByTurmaId.set(turmaId, new Set());
      clientsByTurmaId.get(turmaId).add(ws);

      ws.send(JSON.stringify({ type: "subscribed", turmaId }));
      return;
    }
  });

  ws.on("close", () => {
    if (!subscribedTurmaId) return;
    const set = clientsByTurmaId.get(subscribedTurmaId);
    if (set) set.delete(ws);
  });
});

server.on("upgrade", (req, socket, head) => {
  try {
    const u = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (u.pathname !== "/ws") {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  } catch {
    socket.destroy();
  }
});

function start() {
  server.listen(PORT, HOST, () => {
    console.log(`[mock-api] listening on http://${HOST}:${PORT}`);
    console.log(`[mock-api] ws on ws://${HOST}:${PORT}/ws`);
  });
}

if (require.main === module) {
  start();
}

module.exports = { start };
