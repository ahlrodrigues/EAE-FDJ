// === js/login.js ===
// ES6 module para página de login

import { exibirAviso } from "./modalAviso.js";

console.log("🔍 window.api no início:", window.api);
window.api?.teste?.();

document.addEventListener("DOMContentLoaded", async () => {
  console.log("📄 DOMContentLoaded carregado");

  // Removido: await incluir("modalAvisoContainer", "componentes/modalAviso.html");

  console.log("✅ DOM pronto e componentes fixos assumidos");

  if (!window.api?.validarLogin) {
    console.error("❌ API de login não está disponível.");
    exibirAviso({ tipo: "erro", mensagem: "API de login não disponível. Verifique preload.js." });
    return;
  }

  const form = document.getElementById("form-login");
  const emailEl = document.getElementById("email");
  const senhaEl = document.getElementById("senha");
  const btnOlho = document.getElementById("btn-olho");

  if (!form || !emailEl || !senhaEl) {
    console.error("❌ Elementos do formulário não encontrados.");
    exibirAviso({ tipo: "erro", mensagem: "Formulário mal carregado." });
    return;
  }

  btnOlho.addEventListener("click", () => {
    senhaEl.type = senhaEl.type === "password" ? "text" : "password";
    console.log(`👁️ Senha visível: ${senhaEl.type === "text"}`);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = emailEl.value.trim();
    const senha = senhaEl.value;

    console.log("📨 Tentando login com:", email);

    if (!email || !senha) {
      exibirAviso({ tipo: "erro", mensagem: "Preencha todos os campos." });
      return;
    }

    try {
      const resultado = await window.api.validarLogin(email, senha);
      console.log("📥 Resultado recebido:", resultado);
    
      if (resultado?.sucesso && resultado.emailHash) {
        window.api.definirSessao(resultado.emailHash);
        sessionStorage.setItem("emailHash", resultado.emailHash);
        window.location.href = "index.html";
      } else {
        const msg = resultado?.erro || "Erro desconhecido ao fazer login.";
        exibirAviso({ tipo: "erro", mensagem: msg });
      }
    
    } catch (erro) {
      console.error("❌ Erro inesperado ao tentar login:", erro);
      exibirAviso({ tipo: "erro", mensagem: "Erro interno ao tentar login." });
    }
    
  });
});
