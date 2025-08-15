// === backend/handlers/backupSchedule.js ===
// Agendamento diário de backup com node-cron
// - Validação rigorosa do horário HH:mm
// - Suporte a timezone (default: America/Sao_Paulo)
// - Reagendamento seguro (stop -> start)
// - Logs padronizados
// - Exposição de status básico para diagnóstico

let cron = null;
try { cron = require("node-cron"); } catch { cron = null; }

const DEFAULT_TZ = process.env.BACKUP_TZ || process.env.TZ || "America/Sao_Paulo";

let currentJob = null;
let status = {
  active: false,
  spec: null,
  tz: DEFAULT_TZ,
  startedAtISO: null,
  lastRunISO: null,
  runOk: 0,
  runErr: 0,
  horarioHHmm: "22:30",
};

// ---- Helpers ---------------------------------------------------------------

function _validateHHmm(horarioHHmm) {
  // Aceita "HH:mm" exatamente (24h)
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(horarioHHmm || "").trim());
  if (!m) throw new Error("Horário inválido (use HH:mm, ex.: 22:30).");
  return { hh: parseInt(m[1], 10), mm: parseInt(m[2], 10) };
}

function _toSpec(horarioHHmm = "22:30") {
  const { hh, mm } = _validateHHmm(horarioHHmm);
  return `${mm} ${hh} * * *`; // min hora dia mes semana
}

function _safeRunnerFactory(runner) {
  return async () => {
    status.lastRunISO = new Date().toISOString();
    try {
      await Promise.resolve(runner());
      status.runOk += 1;
      console.log("✅ [backupSchedule] Execução concluída. OK:", status.runOk, "ERR:", status.runErr);
    } catch (e) {
      status.runErr += 1;
      console.error("❌ [backupSchedule] Erro durante execução:", e?.message || e);
    }
  };
}

function _estimateNextLocalRun(hhmm) {
  // Estimativa simples (ignora TZ de cron, usa hora local do SO)
  // Apenas para exibirmos algo em logs de diagnóstico.
  try {
    const { hh, mm } = _validateHHmm(hhmm);
    const now = new Date();
    const next = new Date(now);
    next.setHours(hh, mm, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.toISOString();
  } catch {
    return null;
  }
}

// ---- API -------------------------------------------------------------------

function stopSchedule() {
  if (currentJob) {
    console.log("⏹️ [backupSchedule] Cancelando agendamento anterior…");
    try { currentJob.stop(); } catch {}
    try { currentJob.destroy?.(); } catch {}
    currentJob = null;
  }
  status.active = false;
  status.spec = null;
  status.startedAtISO = null;
}

function startSchedule(horarioHHmm, runner, opts = {}) {
  if (!cron) {
    console.warn("⚠️ [backupSchedule] node-cron não instalado (npm i node-cron).");
    return false;
  }
  if (typeof runner !== "function") {
    console.error("❌ [backupSchedule] Runner inválido (esperado função).");
    return false;
  }

  const tz = opts.timezone || DEFAULT_TZ;
  const spec = _toSpec(horarioHHmm);

  // Recria sempre (idempotente)
  stopSchedule();

  const wrapped = _safeRunnerFactory(runner);
  console.log("⏰ [backupSchedule] Agendando backup diário:", spec, "| TZ:", tz);
  try {
    currentJob = cron.schedule(spec, wrapped, { scheduled: true, timezone: tz });
  } catch (e) {
    console.error("❌ [backupSchedule] Falha ao agendar:", e?.message || e);
    return false;
  }

  status.active = true;
  status.spec = spec;
  status.tz = tz;
  status.startedAtISO = new Date().toISOString();
  status.horarioHHmm = horarioHHmm;
  console.log("🗓️ [backupSchedule] Próxima execução (estimada/local):", _estimateNextLocalRun(horarioHHmm));
  return true;
}

function reschedule(horarioHHmm, runner, opts = {}) {
  console.log("🔁 [backupSchedule] Reagendando para:", horarioHHmm);
  return startSchedule(horarioHHmm, runner, opts);
}

function getStatus() {
  // Snapshot do status interno
  return { ...status };
}

module.exports = {
  startSchedule,
  stopSchedule,
  reschedule,
  getStatus,
};
