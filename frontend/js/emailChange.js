// =============================================================================
// Caminho: /frontend/js/emailChange.js
// Tela: EDIÇÃO (cadastro2.html) – fluxo de troca de e-mail
// Responsabilidade: somente a UI da troca de e-mail
// Requer no preload:
//   window.api.email.iniciarTroca(novoEmail, senhaAtual)
//   window.api.email.confirmarTroca(token)
// Logs: ✉️[EMAIL-UI]
// =============================================================================
import { exibirAviso } from "./modalAviso.js";

const LOG = "✉️[EMAIL-UI]";
const $ = (s) => document.querySelector(s);

function isValidEmail(v) {
  return /\S+@\S+\.\S+/.test(String(v || "").trim());
}

function bindTrocaEmail() {
  const btnMostrar    = $("#btnMostrarTrocaEmail");
  const painel        = $("#painelTrocaEmail");
  const btnSolicitar  = $("#btnSolicitarCodigo");
  const blocoConf     = $("#blocoConfirmacao");
  const btnConfirmar  = $("#btnConfirmarTroca");
  const hintDev       = $("#dicaDevToken");
  const novoEmailEl   = $("#novoEmail");
  const senhaAtualEl  = $("#senhaAtual");
  const tokenEl       = $("#tokenEmail");
  const statusEl      = $("#statusTrocaEmail");

  if (!btnMostrar || !painel) return;

  btnMostrar.addEventListener("click", () => {
    painel.style.display = painel.style.display === "none" ? "block" : "none";
  });

  btnSolicitar?.addEventListener("click", async () => {
    const novoEmail  = String(novoEmailEl?.value || "").trim().toLowerCase();
    const senhaAtual = String(senhaAtualEl?.value || "");

    if (!isValidEmail(novoEmail)) {
      $("#erro-novoEmail").textContent = "E-mail inválido.";
      return;
    } else {
      $("#erro-novoEmail").textContent = "";
    }
    if (!senhaAtual) {
      $("#erro-senhaAtual").textContent = "Informe sua senha atual.";
      return;
    } else {
      $("#erro-senhaAtual").textContent = "";
    }

    try {
      statusEl.textContent = "Solicitando código…";
      const resp = await window.api?.email?.iniciarTroca?.(novoEmail, senhaAtual);
      if (resp?.sucesso) {
        statusEl.textContent = "Código enviado. Verifique seu e-mail.";
        blocoConf.style.display = "block";
        // Em ambiente dev, alguns handlers retornam token para testes:
        if (resp.tokenDev) {
          hintDev.style.display = "block";
          hintDev.textContent = `DEV: token = ${resp.tokenDev}`;
        } else {
          hintDev.style.display = "none";
          hintDev.textContent = "";
        }
      } else {
        throw new Error(resp?.erro || "Falha ao solicitar código.");
      }
    } catch (e) {
      statusEl.textContent = "";
      exibirAviso({ tipo: "erro", mensagem: e?.message || "Erro ao solicitar código." });
      console.error(`${LOG} solicitar:`, e);
    }
  });

  btnConfirmar?.addEventListener("click", async () => {
    const token = String(tokenEl?.value || "").trim();
    if (!token) {
      $("#erro-tokenEmail").textContent = "Informe o código recebido.";
      return;
    } else {
      $("#erro-tokenEmail").textContent = "";
    }

    try {
      statusEl.textContent = "Confirmando…";
      const resp = await window.api?.email?.confirmarTroca?.(token);
      if (resp?.sucesso) {
        statusEl.textContent = "E-mail alterado com sucesso.";
        exibirAviso({ tipo: "sucesso", mensagem: "E-mail atualizado!" });
        // Opcional: recarregar perfil
        // location.reload();
      } else {
        throw new Error(resp?.erro || "Falha ao confirmar código.");
      }
    } catch (e) {
      statusEl.textContent = "";
      exibirAviso({ tipo: "erro", mensagem: e?.message || "Erro ao confirmar código." });
      console.error(`${LOG} confirmar:`, e);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindTrocaEmail();
  console.log(`${LOG} pronto.`);
});
