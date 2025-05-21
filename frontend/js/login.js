console.log("🔍 window.api:", window.api);
window.api?.teste?.();

document.addEventListener("DOMContentLoaded", () => {
  console.log("🔍 window.api:", window.api);

  if (!window.api?.validarLogin) {
    console.error("❌ API de login não está disponível.");
    return;
  }

  const form = document.getElementById("form-login");
  const emailEl = document.getElementById("email");
  const senhaEl = document.getElementById("senha");
  const btnOlho = document.getElementById("btn-olho");

  if (!form || !emailEl || !senhaEl) {
    console.error("❌ Elementos do formulário não encontrados.");
    return;
  }

  // Mostrar/ocultar senha
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
      exibirAviso("Erro", "Preencha todos os campos.");
      return;
    }

    const resultado = await window.api.validarLogin(email, senha);

    if (resultado.sucesso) {
      console.log("✅ Login bem-sucedido");
      window.location.href = "index.html";
    } else {
      exibirAviso("Login inválido", resultado.erro || "Não foi possível fazer login.");
    }
  });
});
