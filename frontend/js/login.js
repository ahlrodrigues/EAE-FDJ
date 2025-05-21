document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("form-login");
    const emailEl = document.getElementById("email");
    const senhaEl = document.getElementById("senha");
    const btnOlho = document.getElementById("btn-olho");
  
    if (!form || !emailEl || !senhaEl) {
      console.error("❌ Um dos elementos de login está ausente no HTML.");
      return;
    }
  
    // Alternar visibilidade da senha
    btnOlho.addEventListener("click", () => {
      const tipoAtual = senhaEl.type;
      senhaEl.type = tipoAtual === "password" ? "text" : "password";
      console.log(`👁️ Senha visível: ${senhaEl.type === "text"}`);
    });
  
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
  
      const email = emailEl.value.trim();
      const senha = senhaEl.value;
  
      console.log("📨 E-mail digitado:", email);
  
      if (!email || !senha) {
        exibirAviso("Erro", "Por favor, preencha todos os campos.");
        return;
      }
  
      try {
        const resultado = await window.api.validarLogin(email, senha);
  
        if (resultado.sucesso) {
          console.log("✅ Login autorizado. Redirecionando...");
          window.location.href = "index.html"; // página inicial do app
        } else {
          console.warn("⚠️ Login recusado:", resultado.erro);
          exibirAviso("Login inválido", resultado.erro);
        }
      } catch (erro) {
        console.error("❌ Erro inesperado ao tentar login:", erro);
        exibirAviso("Erro", "Erro interno ao tentar login.");
      }
    });
  });
  