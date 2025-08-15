// === frontend/js/backupConfig.js ===
import { exibirAviso } from "./modalAviso.js";

function $id(id) { return document.getElementById(id); }

function getModoSelecionado() {
  const sel = document.querySelector('input[name="backup-modo"]:checked');
  return sel ? sel.value : "manual";
}

function toggleHorario() {
  const row = $id("agendamento-row");
  if (!row) return;
  row.style.display = getModoSelecionado() === "agendado" ? "block" : "none";
}

async function salvar() {
  try {
    const servico = $id("backup-servico")?.value || "";
    const pastaRemota = $id("backup-pasta-remota")?.value?.trim() || "";
    const modo = getModoSelecionado();
    const horario = $id("backup-horario")?.value || "22:30";

    if (!servico) throw new Error("Selecione um serviço de backup.");
    if (!pastaRemota) throw new Error("Informe a pasta remota do backup.");
    if (modo === "agendado" && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(horario)) {
      throw new Error("Horário inválido. Use HH:mm (ex.: 22:30).");
    }

    const ok = await window.api.backup.salvarConfiguracao({ servico, pastaRemota, modo, horario });
    if (ok?.ok || ok === true) {
      exibirAviso({ tipo: "sucesso", mensagem: "Configurações de backup salvas." });
    } else {
      throw new Error(ok?.mensagem || "Falha ao salvar configuração.");
    }
  } catch (e) {
    console.error("❌ [backupConfig] Erro ao salvar:", e?.message || e);
    exibirAviso({ tipo: "erro", mensagem: e?.message || "Erro ao salvar configuração." });
  }
}

async function testarConexao() {
  try {
    const res = await window.api.backup.testarConexao();
    if (res?.ok) {
      exibirAviso({ tipo: "sucesso", mensagem: "Conexão OK: " + (res.detalhes || "") });
    } else {
      exibirAviso({ tipo: "erro", mensagem: "Conexão inválida: " + (res?.detalhes || "") });
    }
  } catch (e) {
    console.error("❌ [backupConfig] Erro ao testar conexão:", e?.message || e);
    exibirAviso({ tipo: "erro", mensagem: "Erro ao testar conexão." });
  }
}

async function executarAgora() {
  try {
    const res = await window.api.backup.executarAgora();
    const msg = res?.ok ? `Backup executado. Enviados: ${res.enviados ?? 0}` : "Falha ao executar backup.";
    exibirAviso({ tipo: res?.ok ? "sucesso" : "erro", mensagem: msg });
    if (res?.ultimoBackupISO) {
      const tag = document.getElementById("backup-ultima-info");
      if (tag) tag.textContent = `Último backup: ${new Date(res.ultimoBackupISO).toLocaleString()}`;
    }
  } catch (e) {
    console.error("❌ [backupConfig] Erro ao executar agora:", e?.message || e);
    exibirAviso({ tipo: "erro", mensagem: "Erro ao executar backup." });
  }
}

function bindUI() {
  // radios → mostrar/ocultar horário
  document.querySelectorAll('input[name="backup-modo"]').forEach((el) => {
    el.addEventListener("change", toggleHorario);
  });
  toggleHorario();

  // botões
  $id("btn-backup-salvar")?.addEventListener("click", salvar);
  $id("btn-backup-testar")?.addEventListener("click", testarConexao);
  $id("btn-backup-executar")?.addEventListener("click", executarAgora);
}

document.addEventListener("DOMContentLoaded", () => {
  try {
    bindUI();
    console.log("⚙️ [backupConfig] UI pronta.");
  } catch (e) {
    console.error("❌ [backupConfig] Falha ao inicializar:", e?.message || e);
  }
});
