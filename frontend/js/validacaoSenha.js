// zxcvbn via CDN – global: window.zxcvbn

function inicializarValidacaoSenha() {
  console.log("🔄 Tentando inicializar validação...");

  const senhaInput = document.getElementById("senha");
  const regras = {
    maiuscula: document.getElementById("regra-maiuscula"),
    minuscula: document.getElementById("regra-minuscula"),
    numero: document.getElementById("regra-numero"),
    simbolo: document.getElementById("regra-simbolo"),
    tamanho: document.getElementById("regra-tamanho"),
  };

  if (!senhaInput || Object.values(regras).some(item => !item)) {
    console.warn("❌ Elementos ainda não disponíveis. Tentando novamente...");
    return setTimeout(inicializarValidacaoSenha, 300);
  }

  console.log("✅ Elementos encontrados. Ativando validação de senha...");

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
      const texto = item.dataset.texto || item.textContent.replace(/^✅ |^❌ /, "");
      item.textContent = (validacoes[regra] ? "✅ " : "❌ ") + texto;
      item.style.color = validacoes[regra] ? "green" : "#555";
    }
  
    // 🔐 Força da senha
    const resultado = window.zxcvbn(senha);
    const feedback = ["Muito fraca", "Fraca", "Média", "Boa", "Excelente"];
    const forcaEl = document.getElementById("forcaSenha");
    if (forcaEl) {
      forcaEl.textContent = "Força da senha: " + feedback[resultado.score];
      forcaEl.style.color = resultado.score >= 3 ? "green" : resultado.score === 2 ? "orange" : "red";
    }
  
    console.log("🔐 Força da senha:", resultado.score);
  });
}  

// 🔁 Executa imediatamente após o import (garantido pelo incluirComponentes.js)
inicializarValidacaoSenha();
