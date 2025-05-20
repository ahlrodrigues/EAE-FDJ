// === js/validacaoSenha.js ===
import zxcvbn from "zxcvbn";

document.addEventListener("DOMContentLoaded", () => {
  const senhaInput = document.getElementById("senha");
  const regras = {
    maiuscula: document.getElementById("regra-maiuscula"),
    minuscula: document.getElementById("regra-minuscula"),
    numero: document.getElementById("regra-numero"),
    simbolo: document.getElementById("regra-simbolo"),
    tamanho: document.getElementById("regra-tamanho"),
  };

  if (!senhaInput) return;

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
      if (validacoes[regra]) {
        item.textContent = "✅ " + item.dataset.texto;
        item.style.color = "green";
      } else {
        item.textContent = "❌ " + item.dataset.texto;
        item.style.color = "#555";
      }
    }

    const resultado = zxcvbn(senha);
    console.log("🔐 Força da senha (0-4):", resultado.score);
  });
});