// backend/handlers/notasHandler.js
const { ipcMain } = require("electron");

// Importa os handlers de anotações
const { handleSalvarAnotacao } = require("../notas/salvarAnotacao.js");
const { handleLerAnotacao } = require("../notas/lerAnotacao.js");
const { handleExcluirAnotacao } = require("../notas/excluirAnotacao.js");
const { handleListarAnotacoes } = require("../notas/listarAnotacoes.js");

function registrarNotasHandler() {
  console.log("📝 [MAIN] Registrando handlers de anotações...");

  ipcMain.handle("salvar-anotacao", handleSalvarAnotacao);
  ipcMain.handle("ler-anotacao", handleLerAnotacao);
  ipcMain.handle("excluir-anotacao", handleExcluirAnotacao);
  ipcMain.handle("listar-arquivos-notas", handleListarAnotacoes);
}

module.exports = { registrarNotasHandler };
