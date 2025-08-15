// === backend/handlers/backupSchedule.js =====================================
// Agendador diário (node-cron) com suporte a fuso horário via BACKUP_TZ.
// Ex.: BACKUP_TZ=America/Sao_Paulo no .env
//
// Uso no main.js:
//   const { startSchedule, stopSchedule } = require("./backend/handlers/backupSchedule");
//   startSchedule("22:30", runnerFn)
//   stopSchedule()

let cron = null;
try { cron = require("node-cron"); } catch { cron = null; }

let currentJob = null;

function _toSpec(horarioHHmm = "22:30") {
  const [hh, mm] = String(horarioHHmm || "22:30").split(":").map(n => parseInt(n, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    throw new Error("Horário inválido (use HH:mm).");
  }
  return `${mm} ${hh} * * *`; // min hora dia mes semana
}

function stopSchedule() {
  if (currentJob) {
    console.log("⏹️ [backupSchedule] Cancelando agendamento anterior…");
    try { currentJob.stop(); } catch {}
    currentJob = null;
  } else {
    console.log("ℹ️ [backupSchedule] Nenhum agendamento ativo para cancelar.");
  }
}

function startSchedule(horarioHHmm, runner) {
  if (!cron) {
    console.warn("⚠️ [backupSchedule] node-cron não instalado (npm i node-cron).");
    return false;
  }
  if (typeof runner !== "function") {
    console.warn("⚠️ [backupSchedule] Runner inválido (deve ser função).");
    return false;
  }
  const spec = _toSpec(horarioHHmm);
  const tz = process.env.BACKUP_TZ || "America/Sao_Paulo";

  stopSchedule();
  console.log(`⏰ [backupSchedule] Agendando backup diário: "${spec}" (TZ=${tz})`);
  currentJob = cron.schedule(spec, async () => {
    try {
      console.log("▶️ [backupSchedule] Disparando runner agendado…");
      await runner();
    } catch (e) {
      console.error("❌ [backupSchedule] Falha no runner agendado:", e?.message || e);
    }
  }, { scheduled: true, timezone: tz });

  return true;
}

module.exports = { startSchedule, stopSchedule };
