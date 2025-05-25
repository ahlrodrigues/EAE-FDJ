// === js/login.js ===
// ES6 module para página de login

import { exibirAviso } from "./modalAviso.js";

console.log("🔍 window.api no início:", window.api);
window.api?.teste?.();

document.addEventListener("DOMContentLoaded", async () => {
  console.log("📄 DOMContentLoaded carregado");  

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

      if (resultado.sucesso) {
        console.log("✅ Login bem-sucedido");
        window.location.href = "index.html";
      } else {
        console.warn("⚠️ Login inválido:", resultado.erro);
        exibirAviso({ tipo: "erro", mensagem: resultado.erro || "Não foi possível fazer login." });
      }
    } catch (erro) {
      console.error("❌ Erro ao tentar login:", erro);
      exibirAviso({ tipo: "erro", mensagem: "Erro interno ao tentar login." });
    }
  });


  /* //Esqueci a senha
  const link = document.getElementById("linkEsqueciSenha");

  if (!link) {
    console.warn("⚠️ Elemento #linkEsqueciSenha não encontrado.");
    return;
  }

  link.addEventListener("click", (e) => {
    e.preventDefault();
    console.log("🔗 Redirecionando para solicitarToken.html");
    window.location.href = "solicitarToken.html";
  }); */
});

