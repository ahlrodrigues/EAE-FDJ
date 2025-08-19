// frontend/js/backupConfig.js
import { exibirAviso } from "./modalAviso.js";

document.addEventListener("DOMContentLoaded", () => {
  const selServico     = document.getElementById("backup-servico");
  const btnOAuth       = document.getElementById("btn-backup-oauth");
  const oauthRow       = document.getElementById("oauth-row");
  const pastaInput     = document.getElementById("backup-pasta-remota"); // apenas informativo
  const erroPasta      = document.getElementById("erro-backup-pasta");
  const radiosModo     = document.querySelectorAll('input[name="backup-modo"]');
  const agendamentoRow = document.getElementById("agendamento-row");
  const horarioInput   = document.getElementById("backup-horario");
  const btnTestar      = document.getElementById("btn-backup-testar");
  const btnExecutar    = document.getElementById("btn-backup-executar");
  const btnSalvar      = document.getElementById("btn-backup-salvar");
  const ultimaInfo     = document.getElementById("backup-ultima-info");
  const oauthStatus    = document.getElementById("oauth-status");

  const PASTA_FIXA = "EAEbackup";

  // carregar config
  (async function init() {
    try {
      const cfg = await window.api.backup.carregarConfiguracao();

      // Serviço
      if (cfg?.servico) selServico.value = cfg.servico;
      if (oauthRow) oauthRow.style.display = (selServico.value === "google-drive") ? "" : "none";

      // Pasta fixa (sempre EAEbackup) — campo apenas informativo
      if (pastaInput) {
        pastaInput.value = PASTA_FIXA;
        pastaInput.readOnly = true;
        pastaInput.disabled = true;
        pastaInput.title = "Pasta fixa criada na raiz do seu Google Drive";
      }
      if (erroPasta) {
        erroPasta.style.display = "none";
        erroPasta.textContent = "";
      }

      // Modo e horário
      if (cfg?.modo) {
        const r = document.querySelector(`input[name="backup-modo"][value="${cfg.modo}"]`);
        if (r) r.checked = true;
      }
      if (cfg?.horario) {
        horarioInput.value = cfg.horario;
      }

      // Exibir/ocultar agendamento conforme modo atual
      const modoAtual = document.querySelector('input[name="backup-modo"]:checked')?.value;
      if (agendamentoRow) agendamentoRow.style.display = (modoAtual === "agendado") ? "flex" : "none";

      // Última execução
      if (cfg?.ultimoBackupISO) {
        const dt = new Date(cfg.ultimoBackupISO);
        if (!isNaN(dt.getTime()) && ultimaInfo) {
          ultimaInfo.textContent = `Último backup: ${dt.toLocaleString()}`;
        }
      }
    } catch (e) {
      console.error("❌ [backupConfig] Falha ao carregar cfg:", e);
    }
  })();

  // Alterar serviço (só exibe/esconde OAuth)
  selServico.addEventListener("change", () => {
    if (oauthRow) oauthRow.style.display = (selServico.value === "google-drive") ? "" : "none";
  });

  // Alternar modo (exibir/ocultar horário)
  radiosModo.forEach((r) => {
    r.addEventListener("change", () => {
      const val = document.querySelector('input[name="backup-modo"]:checked')?.value;
      if (agendamentoRow) agendamentoRow.style.display = (val === "agendado") ? "flex" : "none";
    });
  });

  // Conectar OAuth
  btnOAuth.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      if (selServico.value !== "google-drive") {
        exibirAviso({ tipo: "erro", mensagem: "Selecione Google Drive." });
        return;
      }
      const res = await window.api.backup.iniciarOAuth("google-drive");
      if (res?.ok) {
        oauthStatus.textContent = "Conectado";
        exibirAviso({ tipo: "sucesso", mensagem: "Conta Google conectada com sucesso." });
      } else {
        exibirAviso({ tipo: "erro", mensagem: res?.erro || "Falha ao conectar." });
      }
    } catch (e2) {
      exibirAviso({ tipo: "erro", mensagem: e2?.message || "Falha ao conectar com Google." });
    }
  });

  // Testar conexão
  btnTestar?.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      const res = await window.api.backup.testarConexao();
      if (res?.ok) {
        exibirAviso({ tipo: "sucesso", mensagem: `Conexão OK${res.user ? " (" + res.user + ")" : ""}` });
      } else {
        throw new Error(res?.erro || "Falha no teste de conexão.");
      }
    } catch (e2) {
      console.error("❌ [backupConfig] Teste conexão:", e2);
      exibirAviso({ tipo: "erro", mensagem: "Falha no teste de conexão. Revise a autorização." });
    }
  });

  // Executar agora
  btnExecutar?.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      const res = await window.api.backup.executarAgora();
      if (res?.ok) {
        const quando = res.quando ? new Date(res.quando) : new Date();
        if (ultimaInfo) ultimaInfo.textContent = `Último backup: ${quando.toLocaleString()}`;
        exibirAviso({ tipo: "sucesso", mensagem: `Backup concluído. Arquivos enviados: ${res.enviados ?? 0}` });
      } else {
        throw new Error(res?.erro || "Falha na execução do backup.");
      }
    } catch (e2) {
      console.error("❌ [backupConfig] Executar agora:", e2);
      exibirAviso({ tipo: "erro", mensagem: e2?.message || "Falha na execução do backup." });
    }
  });

  // Salvar configurações
btnSalvar?.addEventListener("click", async (e) => {
  e.preventDefault();

  const pastaNome = PASTA_FIXA; // raiz do Drive
  const modo    = document.querySelector('input[name="backup-modo"]:checked')?.value || "manual";
  const servico = selServico.value || "google-drive";
  const horario = horarioInput.value || "20:30";

  try {
    const resp = await window.api.backup.salvarConfiguracao({ servico, pastaNome, modo, horario });
    if (resp?.ok) {
      // Força a mensagem a deixar claro que é na RAIZ do Drive
      const remotePath = `/${PASTA_FIXA}`;
      exibirAviso({
        tipo: "Sucesso!",
        mensagem: `Configurações de backup salvas:\nPasta Local\n → Pasta Remota`,
      });
    } else {
      throw new Error(resp?.erro || "Não foi possível salvar as configurações.");
    }
  } catch (e2) {
    console.error("❌ [backupConfig] Salvar:", e2);
    exibirAviso({ tipo: "erro", mensagem: e2?.message || "Falha ao salvar configurações." });
  }
});
});

