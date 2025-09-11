// backend/handlers/backupScheduleIeHandler.js
// Responsável por reagendar o backup diário com validação e retorno ao renderer.
// Uso: registrarBackupScheduleIeHandler({ startSchedule, stopSchedule, executarBackupAgendado })

const { ipcMain } = require("electron");

function isValidHHMM(value) {
  return typeof value === "string" && /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

function registrarBackupScheduleIeHandler({ startSchedule, stopSchedule, executarBackupAgendado }) {
  const prefix = "⏰ [BackupScheduleIeHandler]";

  if (typeof startSchedule !== "function" || typeof stopSchedule !== "function") {
    console.warn(`${prefix} startSchedule/stopSchedule indisponíveis no registro.`);
  }
  if (typeof executarBackupAgendado !== "function") {
    console.warn(`${prefix} executarBackupAgendado ausente. O scheduler chamará undefined se ativado.`);
  }

  ipcMain.handle("backup:schedule:update", async (_evt, hhmm = "22:30") => {
    try {
      const desired = (hhmm || "").trim() || "22:30";
      if (!isValidHHMM(desired)) {
        const message = `Horário inválido: "${desired}". Use HH:mm (ex.: 07:30, 22:45).`;
        console.warn(`${prefix} ${message}`);
        return { ok: false, message };
      }

      if (typeof startSchedule !== "function" || typeof stopSchedule !== "function") {
        const message = "Scheduler indisponível (startSchedule/stopSchedule não carregados).";
        console.warn(`${prefix} ${message}`);
        return { ok: false, message };
      }

      console.log(`${prefix} Reagendando backup diário para: ${desired}`);
      try {
        stopSchedule?.();
        console.log(`${prefix} Agendamento anterior parado.`);
      } catch (e) {
        console.warn(`${prefix} Falha ao parar agendamento anterior:`, e?.message || e);
      }

      startSchedule(desired, executarBackupAgendado);
      console.log(`${prefix} Novo agendamento ativo para ${desired}.`);

      return { ok: true, message: `Backup diário reagendado para ${desired}.`, scheduledFor: desired };
    } catch (e) {
      console.error(`${prefix} Falha ao reagendar:`, e?.message || e);
      return { ok: false, message: `Falha ao reagendar: ${e?.message || e}` };
    }
  });
}

module.exports = { registrarBackupScheduleIeHandler };
