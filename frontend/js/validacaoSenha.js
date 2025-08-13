// === Validação da senha com regras e zxcvbn ===
// Regras visuais são carregadas dinamicamente via senhaRegras.html
// zxcvbn precisa estar disponível via CDN: window.zxcvbn

function inicializarValidacaoSenha() {
  console.log("🔄 Tentando inicializar validação de senha...");

  const senhaInput = document.getElementById("senha");
  const regras = {
    maiuscula: document.getElementById("regra-maiuscula"),
    minuscula: document.getElementById("regra-minuscula"),
    numero: document.getElementById("regra-numero"),
    simbolo: document.getElementById("regra-simbolo"),
    tamanho: document.getElementById("regra-tamanho"),
  };

  // Verifica se todos os elementos estão presentes (senha + regras)
  if (!senhaInput || Object.values(regras).some(item => !item)) {
    console.warn("❌ Elementos ainda não disponíveis. Reagendando verificação...");
    setTimeout(inicializarValidacaoSenha, 300);
    return;
  }

  console.log("✅ Elementos encontrados. Validação de senha ativada.");

  // Escuta o evento de digitação no campo senha
  senhaInput.addEventListener("input", () => {
    const senha = senhaInput.value;

    // 🔍 Validações simples com regex
    const validacoes = {
      maiuscula: /[A-Z]/.test(senha),
      minuscula: /[a-z]/.test(senha),
      numero: /[0-9]/.test(senha),
      simbolo: /[^A-Za-z0-9]/.test(senha),
      tamanho: senha.length >= 8,
    };

    // 🔄 Atualiza o texto de cada regra dinamicamente
    for (const regra in validacoes) {
      const item = regras[regra];
      if (!item) continue;

      const texto = item.dataset.texto || item.textContent.replace(/^✅ |^❌ /, "");
      const passou = validacoes[regra];

      item.textContent = `${passou ? "✅" : "❌"} ${texto}`;
      item.style.color = passou ? "green" : "#555";
    }

    // 🧠 Avalia força da senha com zxcvbn (se disponível)
    if (typeof window.zxcvbn === "function") {
      const resultado = window.zxcvbn(senha);
      const feedback = ["Muito fraca", "Fraca", "Média", "Boa", "Excelente"];
      const forcaEl = document.getElementById("forcaSenha");

      if (forcaEl) {
        forcaEl.textContent = "Força da senha: " + feedback[resultado.score];
        forcaEl.style.color =
          resultado.score >= 3 ? "green" : resultado.score === 2 ? "orange" : "red";
      }

      console.log("🔐 Força da senha:", resultado.score);
    } else {
      console.warn("⚠️ zxcvbn não carregado. Força da senha não avaliada.");
    }
  });
}

// 🔁 Executa após importação — normalmente após o incluirComponentes
inicializarValidacaoSenha();
