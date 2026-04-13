// =============================================================================
// Caminho: backend/handlers/adminHandler.js
// Objetivo:
//  - Permitir que o dirigente/analista edite conteúdo localmente e publique no
//    mesmo "contentStore" usado pelo app (offline-first).
//
// Observação:
//  - Esta publicação é LOCAL (não envia para servidor). Serve para evoluir a
//    área de administração e padronizar os JSONs por "type".
// =============================================================================

const { ipcMain } = require("electron");

const contentStore = require("../lib/contentStore");
const programaAulasEae = require("../data/programa_aulas_eae.json");
const { obterEmailHashAtivo } = require("../lib/sessionStore");
const { loadUserByHash } = require("../lib/usuarioStore");

const LOG = "🛠️[admin]";

function asNonEmptyString(v) {
  const s = String(v ?? "").trim();
  return s ? s : "";
}

function nowIso() {
  return new Date().toISOString();
}

function addDaysISO(yyyyMmDd, days) {
  const m = String(yyyyMmDd || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + Number(days || 0));
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function buildTemaScheduleFromPrograma({ turmaId, startDateISO, timezone, publishedAtHourLocal }) {
  const start = asNonEmptyString(startDateISO);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) throw new Error("Data inicial inválida (use YYYY-MM-DD).");

  const temaMap = Array.isArray(programaAulasEae?.temaMap) ? programaAulasEae.temaMap : [];
  const items = [];
  for (const m of temaMap) {
    if (!m || m.temaNumero == null || m.aulaNumero == null) continue;
    const deltaDays = (Number(m.aulaNumero) - 1) * 7;
    const dataPublicacaoISO = addDaysISO(start, deltaDays);
    if (!dataPublicacaoISO) continue;
    items.push({ temaNumero: Number(m.temaNumero), dataPublicacaoISO });
  }

  return {
    schemaVersion: 1,
    type: "tema_schedule",
    turmaId,
    version: Date.now(),
    timezone: asNonEmptyString(timezone) || "America/Sao_Paulo",
    publishedAtHourLocal: asNonEmptyString(publishedAtHourLocal) || "06:00",
    source: { type: "programa_aulas_eae", extractedAtISO: programaAulasEae?.extractedAtISO || null },
    items,
  };
}

function mergeManifestItems(oldItems, updates) {
  const map = new Map();
  for (const it of Array.isArray(oldItems) ? oldItems : []) {
    const k = `${it?.type || ""}::${it?.id || ""}`;
    if (k !== "::") map.set(k, { ...it });
  }
  for (const u of updates) {
    const k = `${u.type}::${u.id}`;
    map.set(k, { ...(map.get(k) || {}), ...u });
  }
  return Array.from(map.values());
}

function buildTemaScheduleFromProgramaSchedule({ turmaId, programaScheduleItem, timezone, publishedAtHourLocal }) {
  const scheduleItems = Array.isArray(programaScheduleItem?.items) ? programaScheduleItem.items : [];
  const byAula = new Map();
  for (const it of scheduleItems) {
    const aulaNumero = Number(it?.aulaNumero);
    const dataAulaISO = asNonEmptyString(it?.dataAulaISO);
    if (!Number.isFinite(aulaNumero) || aulaNumero < 1 || aulaNumero > 118) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataAulaISO)) continue;
    byAula.set(aulaNumero, dataAulaISO);
  }

  const temaMap = Array.isArray(programaAulasEae?.temaMap) ? programaAulasEae.temaMap : [];
  const items = [];
  for (const m of temaMap) {
    const aulaNumero = Number(m?.aulaNumero);
    const temaNumero = Number(m?.temaNumero);
    const dataAulaISO = byAula.get(aulaNumero);
    if (!dataAulaISO) continue;
    if (!Number.isFinite(temaNumero)) continue;
    items.push({ temaNumero, dataPublicacaoISO: dataAulaISO });
  }

  return {
    schemaVersion: 1,
    type: "tema_schedule",
    turmaId,
    version: Date.now(),
    timezone: asNonEmptyString(timezone) || "America/Sao_Paulo",
    publishedAtHourLocal: asNonEmptyString(publishedAtHourLocal) || "06:00",
    source: { type: "programa_aulas_eae_schedule", derivedAtISO: nowIso() },
    items,
  };
}

async function publishLocal(payload) {
  // Autorização: só dirigente/analista
  const bypass = String(process.env.ADMIN_BYPASS || "").trim() === "1";
  if (!bypass) {
    const emailHash = obterEmailHashAtivo();
    if (!emailHash) throw new Error("Sessão inativa.");
    const user = await loadUserByHash(emailHash);
    const roles = Array.isArray(user?.roles) ? user.roles : [];
    const ok = roles.includes("dirigente") || roles.includes("analista");
    if (!ok) throw new Error("Acesso restrito: perfil dirigente/analista necessário.");
  }

  const turmaId = asNonEmptyString(payload?.turmaId);
  if (!turmaId) throw new Error("turmaId ausente");

  const manifestOld = await contentStore.readManifest(turmaId);
  const manifestVersion = Number.isFinite(Number(manifestOld?.manifestVersion))
    ? Number(manifestOld.manifestVersion) + 1
    : 1;

  const itemVersionBase = Date.now();
  const updatedAtISO = nowIso();

  const writes = [];
  const manifestUpdates = [];

  // 0) Tema schedule a partir do Programa de Aulas padrão (Vivência)
  if (payload?.temaScheduleFromPrograma?.startDateISO) {
    const schedule = buildTemaScheduleFromPrograma({
      turmaId,
      startDateISO: payload.temaScheduleFromPrograma.startDateISO,
      timezone: payload.temaScheduleFromPrograma.timezone,
      publishedAtHourLocal: payload.temaScheduleFromPrograma.publishedAtHourLocal,
    });
    writes.push(contentStore.writeItem(turmaId, "tema_schedule", turmaId, schedule));
    manifestUpdates.push({ type: "tema_schedule", id: turmaId, version: schedule.version, url: "" });
  }

  // 0b) Programa com datas editáveis (por turma) + tema_schedule derivado
  if (payload?.programaSchedule?.items) {
    const prog = {
      schemaVersion: 1,
      type: "programa_aulas_eae_schedule",
      turmaId,
      version: Date.now(),
      timezone: asNonEmptyString(payload.programaSchedule.timezone) || "America/Sao_Paulo",
      items: payload.programaSchedule.items,
      updatedAtISO,
    };

    writes.push(contentStore.writeItem(turmaId, "programa_aulas_eae_schedule", turmaId, prog));
    manifestUpdates.push({ type: "programa_aulas_eae_schedule", id: turmaId, version: prog.version, url: "" });

    const derived = buildTemaScheduleFromProgramaSchedule({
      turmaId,
      programaScheduleItem: prog,
      timezone: prog.timezone,
      publishedAtHourLocal: payload.programaSchedule.publishedAtHourLocal,
    });
    writes.push(contentStore.writeItem(turmaId, "tema_schedule", turmaId, derived));
    manifestUpdates.push({ type: "tema_schedule", id: turmaId, version: derived.version, url: "" });
  }

  // 1) Aviso do dirigente (feed por turma)
  if (payload?.avisoDirigente) {
    const titulo = asNonEmptyString(payload.avisoDirigente.titulo);
    const mensagem = asNonEmptyString(payload.avisoDirigente.mensagem);
    if (titulo || mensagem) {
      const item = {
        schemaVersion: 1,
        type: "aviso_dirigente_feed",
        turmaId,
        version: itemVersionBase,
        items: [
          {
            id: `aviso-${itemVersionBase}`,
            titulo: titulo || "Aviso do Dirigente",
            mensagem,
            publicadoEmISO: updatedAtISO,
          },
        ],
      };
      writes.push(contentStore.writeItem(turmaId, "aviso_dirigente_feed", turmaId, item));
      manifestUpdates.push({ type: "aviso_dirigente_feed", id: turmaId, version: item.version, url: "" });
    }
  }

  // 2) Mensagem do mentor da turma
  if (payload?.mensagemMentorTurma) {
    const mensagem = asNonEmptyString(payload.mensagemMentorTurma.mensagem);
    if (mensagem) {
      const item = {
        schemaVersion: 1,
        type: "mensagem_mentor_turma",
        turmaId,
        version: itemVersionBase,
        mensagem,
        publicadoEmISO: updatedAtISO,
      };
      writes.push(contentStore.writeItem(turmaId, "mensagem_mentor_turma", turmaId, item));
      manifestUpdates.push({ type: "mensagem_mentor_turma", id: turmaId, version: item.version, url: "" });
    }
  }

  if (writes.length === 0) {
    throw new Error("Nada para publicar (preencha pelo menos um campo).");
  }

  await Promise.all(writes);

  const manifestNew = {
    ...(manifestOld && typeof manifestOld === "object" ? manifestOld : {}),
    schemaVersion: 1,
    turmaId,
    manifestVersion,
    updatedAtISO,
    items: mergeManifestItems(manifestOld?.items, manifestUpdates),
    _source: "local-admin",
    _pulledAtISO: updatedAtISO,
  };

  const manifestFile = await contentStore.writeManifest(turmaId, manifestNew);
  console.log(`${LOG} publicado localmente`, { turmaId, manifestVersion, manifestFile, items: manifestUpdates.length });

  return { ok: true, turmaId, manifestVersion, manifestFile, itemsUpdated: manifestUpdates.length };
}

function registrarAdminHandler() {
  ipcMain.handle("admin:publishLocal", async (_event, payload) => {
    try {
      return await publishLocal(payload);
    } catch (e) {
      console.error(`${LOG} publishLocal falhou:`, e?.message || e);
      return { ok: false, erro: e?.message || String(e) };
    }
  });

  console.log(`${LOG} IPC registrado: admin:publishLocal`);
}

module.exports = { registrarAdminHandler };
