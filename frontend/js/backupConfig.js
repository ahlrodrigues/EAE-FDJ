// frontend/js/backupConfig.js
import { exibirAviso } from "./modalAviso.js";

document.addEventListener("DOMContentLoaded", () => {
  const selServico = document.getElementById("backup-servico");
  const btnOAuth = document.getElementById("btn-backup-oauth");
  const oauthRow = document.getElementById("oauth-row");
  const pastaInput = document.getElementById("backup-pasta-remota"); // agora recebe apenas o nome!
  const erroPasta = document.getElementById("erro-backup-pasta");
  const radiosModo = document.querySelectorAll('input[name="backup-modo"]');
  const agendamentoRow = document.getElementById("agendamento-row");
  const horarioInput = document.getElementById("backup-horario");
  const btnTestar = document.getElementById("btn-backup-testar");
  const btnExecutar = document.getElementById("btn-backup-executar");
  const btnSalvar = document.getElementById("btn-backup-salvar");
  const ultimaInfo = document.getElementById("backup-ultima-info");
  const oauthStatus = document.getElementById("oauth-status");

  // carregar config
  (async function init() {
    try {
      const cfg = await window.api.backup.carregarConfiguracao();
      if (cfg?.servico) selServico.value = cfg.servico;
      if (cfg?.pastaNome) pastaInput.value = cfg.pastaNome;
      if (cfg?.modo) {
        document.querySelector(`input[name="backup-modo"][value="${cfg.modo}"]`)?.click();
      }
      if (cfg?.horario) horarioInput.value = cfg.horario;
      if (cfg?.ultimoBackupISO) ultimaInfo.textContent = `Último backup: ${new Date(cfg.ultimoBackupISO).toLocaleString()}`;
      oauthRow.style.display = (selServico.value === "google-drive") ? "" : "none";
    } catch (e) {
      console.error("❌ [backupConfig] Falha ao carregar cfg:", e);
    }
  })();

  selServico.addEventListener("change", () => {
    oauthRow.style.display = (selServico.value === "google-drive") ? "" : "none";
  });

  radiosModo.forEach(r => {
    r.addEventListener("change", () => {
      agendamentoRow.style.display = (document.querySelector('input[name="backup-modo"]:checked')?.value === "agendado") ? "flex" : "none";
    });
  });

  btnOAuth.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      if (selServico.value !== "google-drive") {
        exibirAviso({ tipo: "erro", mensagem: "Selecione Google Drive." });
        return;
      }
      await window.api.backup.iniciarOAuth("google-drive");
      oauthStatus.textContent = "Conectado";
      exibirAviso({ tipo: "sucesso", mensagem: "Conta Google conectada com sucesso." });
    } catch (e) {
      console.error("❌ [backupConfig] OAuth:", e);
      exibirAviso({ tipo: "erro", mensagem: "Falha ao conectar com Google. Verifique o .env e as credenciais." });
    }
  });

  btnTestar.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      const res = await window.api.backup.testarConexao();
      exibirAviso({ tipo: "sucesso", mensagem: `Conexão OK (${res.user || "Conta Google"})` });
    } catch (e) {
      console.error("❌ [backupConfig] Teste conexão:", e);
      exibirAviso({ tipo: "erro", mensagem: "Falha no teste de conexão. Revise a autorização." });
    }
  });

  btnExecutar.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      const res = await window.api.backup.executarAgora();
      ultimaInfo.textContent = `Último backup: ${new Date(res.quando).toLocaleString()}`;
      exibirAviso({ tipo: "sucesso", mensagem: `Backup concluído. Arquivos enviados: ${res.enviados}` });
    } catch (e) {
      console.error("❌ [backupConfig] Executar agora:", e);
      exibirAviso({ tipo: "erro", mensagem: "Falha na execução do backup." });
    }
  });

  btnSalvar.addEventListener("click", async (e) => {
    e.preventDefault();
    const pastaNome = pastaInput.value.trim();

    if (!pastaNome || /[\\/]/.test(pastaNome)) {
      erroPasta.style.display = "";
      erroPasta.textContent = "Informe apenas o nome da pasta (sem barras).";
      return;
    }
    erroPasta.style.display = "none";

    const modo = document.querySelector('input[name="backup-modo"]:checked')?.value || "manual";
    const servico = selServico.value || "google-drive";
    const horario = horarioInput.value || "22:30";

    try {
      const resp = await window.api.backup.salvarConfiguracao({ servico, pastaNome, modo, horario });
      if (resp?.ok) {
        exibirAviso({
          tipo: "sucesso",
          mensagem: `Configurações salvas. Local: ${resp.localDir} → Drive: ${resp.remotePath}`
        });
      } else {
        exibirAviso({ tipo: "erro", mensagem: "Não foi possível salvar as configurações." });
      }
    } catch (e) {
      console.error("❌ [backupConfig] Salvar:", e);
      exibirAviso({ tipo: "erro", mensagem: "Falha ao salvar configurações." });
    }
  });
});
