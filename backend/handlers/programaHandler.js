// =============================================================================
// Caminho: backend/handlers/programaHandler.js
// Objetivo:
//  - Expor o "Programa de aulas" padrão (referência) para o renderer.
//  - Útil para telas de visualização e para gerar schedules locais.
// =============================================================================

const { ipcMain } = require("electron");

const programaAulasEae = require("../data/programa_aulas_eae.json");

const LOG = "📘[programa]";

function registrarProgramaHandler() {
  ipcMain.handle("programa:padrao:get", async () => {
    try {
      return { ok: true, dados: programaAulasEae };
    } catch (e) {
      return { ok: false, erro: e?.message || String(e) };
    }
  });

  console.log(`${LOG} IPC registrado: programa:padrao:get`);
}

module.exports = { registrarProgramaHandler };

