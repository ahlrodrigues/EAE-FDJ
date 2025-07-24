// === js/login.js ===
// ES6 module para página de login

import { exibirAviso } from "./modalAviso.js";

// 🔍 Diagnóstico inicial
console.log("🔍 window.api no início:", window.api);
window.api?.teste?.();

document.addEventListener("DOMContentLoaded", async () => {
  console.log("📄 DOMContentLoaded carregado");

  // ✅ Verifica se API está disponível
  if (!window.api?.validarLogin) {
    console.error("❌ API de login não está disponível.");
    exibirAviso({
      tipo: "erro",
      mensagem: "API de login não disponível. Verifique preload.js.",
    });
    return;
  }

  // 🔗 Referências aos elementos do formulário
  const form = document.getElementById("form-login");
  const emailEl = document.getElementById("email");
  const senhaEl = document.getElementById("senha");
  const btnOlho = document.getElementById("btn-olho");

  // ❌ Elementos obrigatórios não encontrados
  if (!form || !emailEl || !senhaEl || !btnOlho) {
    console.error("❌ Elementos do formulário não encontrados.");
    exibirAviso({
      tipo: "erro",
      mensagem: "Formulário mal carregado. Verifique o HTML.",
    });
    return;
  }

  // 🎯 Aplica foco automático no campo de e-mail
  emailEl.focus();
  console.log("🔎 Tentando focar o campo de e-mail...");

  setTimeout(() => {
    console.log("📌 Elemento ativo após 300ms:", document.activeElement);
    if (document.activeElement === emailEl) {
      console.log("✅ Campo de e-mail está com foco.");
    } else {
      console.warn("⚠️ Foco NÃO foi aplicado ao campo de e-mail.");
    }
  }, 300);

  // 👁️ Alterna visibilidade da senha
  btnOlho.addEventListener("click", () => {
    senhaEl.type = senhaEl.type === "password" ? "text" : "password";
    console.log(`👁️ Senha visível: ${senhaEl.type === "text"}`);
  });

  // 📤 Processa envio do formulário
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = emailEl.value.trim();
    const senha = senhaEl.value;

    console.log("📨 Tentando login com:", email);

    if (!email || !senha) {
      console.warn("⚠️ Email ou senha não preenchidos.");
      exibirAviso({
        tipo: "erro",
        mensagem: "Preencha o e-mail e a senha para continuar.",
      });
      return;
    }

    try {
      const resultado = await window.api.validarLogin(email, senha);
      console.log("📥 Resultado recebido:", resultado);

      if (resultado?.sucesso && resultado.emailHash) {
        console.log("🔐 Login bem-sucedido. Redirecionando...");
        window.api.definirSessao(resultado.emailHash);
        sessionStorage.setItem("emailHash", resultado.emailHash);
        window.location.href = "index.html";
      } else {
        const msg = resultado?.erro || "Erro desconhecido ao fazer login.";
        console.warn("⚠️ Falha no login:", msg);
        exibirAviso({ tipo: "erro", mensagem: msg });
      }
    } catch (erro) {
      console.error("❌ Erro inesperado ao tentar login:", erro);
      exibirAviso({
        tipo: "erro",
        mensagem: "Erro interno ao tentar login. Verifique o console.",
      });
    }
  });
});
