// === frontend/js/backupConfig.js ============================================
import { exibirAviso } from "./modalAviso.js";

function $id(id) { return document.getElementById(id); }

function getModoSelecionado() {
  const sel = document.querySelector('input[name="backup-modo"]:checked');
  return sel ? sel.value : "manual";
}

function toggleOAuthRow() {
  const servico = $id("backup-servico")?.value || "";
  const row = $id("oauth-row");
  if (!row) return;
  row.style.display = servico === "google-drive" ? "flex" : "none";
}

function toggleHorario() {
  const row = $id("agendamento-row");
  if (!row) return;
  const agendado = getModoSelecionado() === "agendado";
  row.style.display = agendado ? "flex" : "none";
  if (agendado) setTimeout(() => $id("backup-horario")?.focus(), 0);
  console.log(`[backupConfig] toggleHorario → ${agendado ? "mostrar" : "ocultar"}`);
}

function bindUI() {
  $id("backup-servico")?.addEventListener("change", toggleOAuthRow);

  document.querySelectorAll('input[name="backup-modo"]').forEach((el) => {
    el.addEventListener("change", toggleHorario);
  });

  $id("btn-backup-oauth")?.addEventListener("click", conectarConta);
  $id("btn-backup-testar")?.addEventListener("click", testarConexao);
  $id("btn-backup-executar")?.addEventListener("click", executarAgora);
  $id("btn-backup-salvar")?.addEventListener("click", salvar);

  toggleOAuthRow();
  toggleHorario();
}

async function carregarConfiguracao() {
  try {
    const res = await window.api.backup.carregarConfiguracao();
    if (!res?.ok) throw new Error(res?.mensagem || "Falha ao carregar.");

    const b = res.backup || {};
    if ($id("backup-servico")) $id("backup-servico").value = b.servico || "";
    if ($id("backup-pasta-remota")) $id("backup-pasta-remota").value = b.pastaRemota || "EscolaAprendizes/Backups";

    // Modos
    const radios = document.querySelectorAll('input[name="backup-modo"]');
    let marcado = false;
    radios.forEach(r => {
      if (r.value === (b.modo || "manual")) {
        r.checked = true; marcado = true;
      } else { r.checked = false; }
    });
    if (!marcado && radios[0]) radios[0].checked = true;

    // Horário
    if ($id("backup-horario")) $id("backup-horario").value = b.horario || "22:30";

    toggleOAuthRow();
    toggleHorario();

    // Status de conexão
    const status = $id("oauth-status");
    if (status) {
      status.textContent = b.conectadoService
        ? "Conectado (Service)"
        : (b.conectado ? "Conectado" : "Não conectado");
    }

    // Último backup
    const info = $id("backup-ultima-info");
    if (info) {
      info.textContent = b.ultimoBackupISO
        ? `Último backup: ${new Date(b.ultimoBackupISO).toLocaleString()}`
        : "Último backup: —";
    }

    console.log("⚙️ [backupConfig] Config carregada:", b);
  } catch (e) {
    console.error("❌ [backupConfig] Erro ao carregar:", e?.message || e);
    exibirAviso({ tipo: "erro", mensagem: e?.message || "Erro ao carregar configuração." });
  }
}

function _validaHorario(hhmm) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(hhmm || ""));
}

async function salvar(ev) {
  ev?.preventDefault?.();
  try {
    const servico = $id("backup-servico")?.value || "";
    const pastaRemota = $id("backup-pasta-remota")?.value?.trim() || "";
    const modo = getModoSelecionado();
    let horario = $id("backup-horario")?.value || "22:30";

    if (!servico) throw new Error("Selecione um serviço.");
    if (!pastaRemota) throw new Error("Informe a pasta remota.");

    if (modo === "agendado") {
      if (!_validaHorario(horario)) throw new Error("Horário inválido. Use HH:mm (ex.: 22:30).");
    } else {
      horario = "22:30";
    }

    console.log("[backupConfig] salvando…", { servico, pastaRemota, modo, horario });
    const res = await window.api.backup.salvarConfiguracao({ servico, pastaRemota, modo, horario });
    if (res?.ok) {
      exibirAviso({ tipo: "sucesso", mensagem: `Configurações salvas. Agendamento: ${res.schedule || "—"}` });
    } else {
      throw new Error(res?.mensagem || "Falha ao salvar configuração.");
    }
  } catch (e) {
    console.error("❌ [backupConfig] Erro ao salvar:", e?.message || e);
    exibirAviso({ tipo: "erro", mensagem: e?.message || "Erro ao salvar configuração." });
  }
}

async function conectarConta(ev) {
  ev?.preventDefault?.();
  try {
    const servico = $id("backup-servico")?.value || "";
    if (servico !== "google-drive") {
      return exibirAviso({ tipo: "erro", mensagem: "Selecione Google Drive para conectar." });
    }

    exibirAviso({ tipo: "info", mensagem: "Verificando conta… (Service Account JSON ou OAuth)" });
    const res = await window.api.backup.iniciarOAuth(servico);
    if (res?.ok) {
      exibirAviso({ tipo: "sucesso", mensagem: res.mensagem || "Conta conectada." });
      const status = $id("oauth-status");
      if (status) status.textContent = status.textContent.includes("Service") ? "Conectado (Service)" : "Conectado";
      // recarrega status para refletir Service/OAuth
      await carregarConfiguracao();
    } else {
      exibirAviso({ tipo: "erro", mensagem: res?.mensagem || "Falha ao conectar." });
    }
  } catch (e) {
    console.error("❌ [backupConfig] OAuth/Service error:", e);
    exibirAviso({ tipo: "erro", mensagem: e?.message || "Erro na conexão." });
  }
}

async function testarConexao(ev) {
  ev?.preventDefault?.();
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

async function executarAgora(ev) {
  ev?.preventDefault?.();
  try {
    const res = await window.api.backup.executarAgora();
    if (res?.ok) {
      const enviados = res.enviados ?? 0;
      exibirAviso({ tipo: "sucesso", mensagem: `Backup executado. Enviados: ${enviados}` });
      const info = $id("backup-ultima-info");
      if (info && res.ultimoBackupISO) {
        info.textContent = `Último backup: ${new Date(res.ultimoBackupISO).toLocaleString()}`;
      }
    } else {
      exibirAviso({ tipo: "erro", mensagem: res?.mensagem || "Falha ao executar backup." });
    }
  } catch (e) {
    console.error("❌ [backupConfig] Erro ao executar agora:", e?.message || e);
    exibirAviso({ tipo: "erro", mensagem: "Erro ao executar backup." });
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    bindUI();
    await carregarConfiguracao();
    console.log("⚙️ [backupConfig] UI pronta.");
  } catch (e) {
    console.error("❌ [backupConfig] Falha ao inicializar:", e?.message || e);
  }
});
