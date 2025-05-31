// === js/redefinirSenha.js ===
import { exibirAviso } from "./modalAviso.js";
import { componentesCarregados } from "./incluirComponentes.js";
import { inicializarRegrasSenha } from "./senhaRegra.js";
import { inicializarForcaSenha } from "./forcaSenha.js";
import { inicializarBotaoVerSenha } from "./verSenha.js";

async function esperarElemento(seletor, tentativas = 20, intervalo = 100) {
  for (let i = 0; i < tentativas; i++) {
    if (document.querySelector(seletor)) return true;
    await new Promise(resolve => setTimeout(resolve, intervalo));
  }
  console.warn(`⚠️ Elemento ${seletor} não carregado após ${tentativas} tentativas.`);
  return false;
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log("📄 redefinirSenha.js carregado");

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

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = emailEl.value.trim();
    const token = tokenEl.value.trim();
    const novaSenha = novaSenhaEl.value;
    const confirmarSenha = confirmarSenhaEl.value;

    console.log("📨 Dados enviados:", { email, token, novaSenha });

    if (!email || !token || !novaSenha || !confirmarSenha) {
      exibirAviso({ tipo: "erro", mensagem: "Preencha todos os campos." });
      return;
    }

    if (novaSenha !== confirmarSenha) {
      exibirAviso({ tipo: "erro", mensagem: "As senhas não coincidem." });
      return;
    }

    try {
      const resposta = await window.api.redefinirSenha(email, token, novaSenha);
      console.log("📬 Resposta do backend:", resposta);

      if (resposta.sucesso) {
        exibirAviso({
          tipo: "sucesso",
          mensagem: "Senha redefinida com sucesso!",
          aoFechar: () => window.location.href = "login.html"
        });
      } else {
        exibirAviso({ tipo: "erro", mensagem: resposta.erro || "Erro ao redefinir senha." });
      }
    } catch (erro) {
      console.error("❌ Erro ao redefinir senha:", erro);
      exibirAviso({ tipo: "erro", mensagem: "Erro ao redefinir senha." });
    }
  });
});
