export function inicializarRegrasSenha() {
    const senhaInput = document.getElementById("senha");
  
    if (!senhaInput) {
      console.warn("⚠️ Campo de senha não encontrado.");
      return;
    }
  
    senhaInput.addEventListener("input", () => {
      const senha = senhaInput.value;
  
      atualizarRegra("regra-maiuscula", /[A-Z]/.test(senha));
      atualizarRegra("regra-minuscula", /[a-z]/.test(senha));
      atualizarRegra("regra-numero", /[0-9]/.test(senha));
      atualizarRegra("regra-simbolo", /[^A-Za-z0-9]/.test(senha));
      atualizarRegra("regra-tamanho", senha.length >= 8);
    });
  
    function atualizarRegra(id, condicao) {
      const el = document.getElementById(id);
      if (!el) return;
  
      const texto = el.getAttribute("data-texto");
      el.textContent = `${condicao ? "✅" : "❌"} ${texto}`;
    }
  }
  