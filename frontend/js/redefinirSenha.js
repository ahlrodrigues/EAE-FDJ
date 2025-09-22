// === js/redefinirSenha.js ===
// Não loga senha/token em claro. Desabilita o botão durante envio.

import { exibirAviso } from "./modalAviso.js";
import { componentesCarregados } from "./incluirComponentes.js";
import { inicializarRegrasSenha } from "./senhaRegra.js";
import { inicializarForcaSenha } from "./forcaSenha.js";
import { inicializarBotaoVerSenha } from "./verSenha.js";

async function esperarElemento(seletor, tentativas = 20, intervalo = 100) {
  for (let i = 0; i < tentativas; i++) {
    if (document.querySelector(seletor)) return true;
    await new Promise(r => setTimeout(r, intervalo));
  }
  console.warn(`⚠️ Elemento ${seletor} não carregado após ${tentativas} tentativas.`);
  return false;
}

function emailValido(e) {
  const s = String(e || "").trim().toLowerCase();
  return s.includes("@") && s.includes(".");
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log("📄[redefinirSenha] arquivo carregado");

  await componentesCarregados;
  await esperarElemento("#novaSenha");

  inicializarRegrasSenha();
  inicializarForcaSenha();
  inicializarBotaoVerSenha();

  const form = document.getElementById("form-redefinir");
  const emailEl = document.getElementById("email");
  const tokenEl = document.getElementById("token");
  const novaSenhaEl = document.getElementById("novaSenha");
  const confirmarSenhaEl = document.getElementById("confirmarSenha");
  const btn = form?.querySelector("button[type='submit']");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = emailEl.value.trim();
    const token = tokenEl.value.trim();
    const novaSenha = novaSenhaEl.value;
    const confirmarSenha = confirmarSenhaEl.value;

    if (!emailValido(email) || !token || !novaSenha || !confirmarSenha) {
      exibirAviso({ tipo: "erro", mensagem: "Preencha todos os campos corretamente." });
      return;
    }

    if (novaSenha !== confirmarSenha) {
      exibirAviso({ tipo: "erro", mensagem: "As senhas não coincidem." });
      return;
    }

    btn?.setAttribute("disabled", "disabled");
    console.log("📨[redefinirSenha] enviando pedido…", { email: email.replace(/^(.).+(@.+)$/, "$1***$2") });

    try {
      const resposta = await window.api.redefinirSenha(email, token, novaSenha);
      console.log("📬[redefinirSenha] resposta do backend:", { sucesso: resposta?.sucesso });

      if (resposta?.sucesso) {
        exibirAviso({
          tipo: "sucesso",
          mensagem: "Senha redefinida com sucesso!",
          aoFechar: () => window.location.href = "login.html"
        });
      } else {
        exibirAviso({ tipo: "erro", mensagem: resposta?.erro || "Erro ao redefinir senha." });
      }
    } catch (erro) {
      console.error("❌[redefinirSenha] erro:", erro?.message || erro);
      exibirAviso({ tipo: "erro", mensagem: "Erro ao redefinir senha." });
    } finally {
      btn?.removeAttribute("disabled");
    }
  });
});
