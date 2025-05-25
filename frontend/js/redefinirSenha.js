import { exibirAviso } from "./modalAviso.js";
import { componentesCarregados } from "./incluirComponentes.js";

// Aguarda o carregamento de todos os componentes visuais
document.addEventListener("DOMContentLoaded", async () => {
  await componentesCarregados;

  console.log("✅ Componentes carregados na página redefinirSenha.html");

  const form = document.getElementById("redefinirSenhaForm");
  const novaSenhaInput = document.getElementById("novaSenha");
  const confirmarSenhaInput = document.getElementById("confirmarSenha");
  const tokenInput = document.getElementById("token");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const token = tokenInput.value.trim();
    const novaSenha = novaSenhaInput.value.trim();
    const confirmarSenha = confirmarSenhaInput.value.trim();

    if (!token || !novaSenha || !confirmarSenha) {
      exibirAviso("Todos os campos são obrigatórios.");
      return;
    }

    if (novaSenha !== confirmarSenha) {
      exibirAviso("As senhas não coincidem.");
      return;
    }

    console.log("📤 Enviando dados para redefinir a senha...");

    try {
      const resultado = await window.electronAPI.redefinirSenha({ token, novaSenha });

      if (resultado.sucesso) {
        console.log("✅ Senha redefinida com sucesso");
        exibirAviso("Senha redefinida com sucesso!", "sucesso");

        // Redireciona para login após 2 segundos
        setTimeout(() => {
          window.location.href = "login.html";
        }, 2000);
      } else {
        console.warn("⚠️ Erro ao redefinir senha:", resultado.erro);
        exibirAviso(`Erro: ${resultado.erro}`);
      }
    } catch (erro) {
      console.error("❌ Erro inesperado:", erro);
      exibirAviso("Erro inesperado ao redefinir a senha.");
    }
  });
});
