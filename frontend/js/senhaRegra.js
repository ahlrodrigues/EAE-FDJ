// === js/senhaRegra.js ===
// Validação de senha com regras visuais e força via zxcvbn

export function inicializarValidacaoSenha() {
  console.log("🔄 Inicializando validação de senha...");

  const senhaInput = document.getElementById("senha");
  const regras = {
    maiuscula: document.getElementById("regra-maiuscula"),
    minuscula: document.getElementById("regra-minuscula"),
    numero: document.getElementById("regra-numero"),
    simbolo: document.getElementById("regra-simbolo"),
    tamanho: document.getElementById("regra-tamanho"),
  };

  // Verifica se todos os elementos estão disponíveis
  if (!senhaInput || Object.values(regras).some(item => !item)) {
    console.warn("❌ Elementos ainda não disponíveis. Reagendando...");
    return setTimeout(inicializarValidacaoSenha, 300);
  }

  console.log("✅ Elementos encontrados. Validando senha ao digitar...");

  senhaInput.addEventListener("input", () => {
    const senha = senhaInput.value;

    const validacoes = {
      maiuscula: /[A-Z]/.test(senha),
      minuscula: /[a-z]/.test(senha),
      numero: /[0-9]/.test(senha),
      simbolo: /[^A-Za-z0-9]/.test(senha),
      tamanho: senha.length >= 8,
    };

    for (const regra in validacoes) {
      const item = regras[regra];
      if (!item) continue;
      const texto = item.dataset.texto || item.textContent.replace(/^✅ |^❌ /, "");
      item.textContent = `${validacoes[regra] ? "✅" : "❌"} ${texto}`;
      item.style.color = validacoes[regra] ? "green" : "#555";
    }

    if (typeof window.zxcvbn === "function") {
      const resultado = window.zxcvbn(senha);
      const feedback = ["Muito fraca", "Fraca", "Média", "Boa", "Excelente"];
      const forcaEl = document.getElementById("forcaSenha");

      if (forcaEl) {
        forcaEl.innerHTML = `Força da senha: <strong>${feedback[resultado.score]}</strong>`;
        forcaEl.style.color =
          resultado.score >= 3 ? "green" : resultado.score === 2 ? "orange" : "red";
      }

      console.log("🔐 Força da senha:", resultado.score);
    } else {
      console.warn("⚠️ zxcvbn não carregado. Força da senha não avaliada.");
    }
  });
} // fim da função
