// === solicitarToken.js ===
// Frontend da página de solicitação de token de redefinição de senha

import { exibirAviso } from "./modalAviso.js";
import { componentesCarregados } from "./incluirComponentes.js";

document.addEventListener("DOMContentLoaded", async () => {
  console.log("📄 solicitarToken.js carregado");

  // Aguarda o carregamento dos componentes (cabeçalho, rodapé, etc.)
  await componentesCarregados;
  console.log("📦 Componentes carregados com sucesso");

  // Referências aos elementos do formulário
  const form = document.getElementById("form-token");
  const emailEl = document.getElementById("email");

  // Verifica se a API está disponível no preload
  if (!window.api || typeof window.api.solicitarToken !== "function") {
    console.error("❌ API de solicitação de token não está disponível:", window.api);
    exibirAviso({ tipo: "erro", mensagem: "Erro interno: API não disponível." });
    return;
  }

  // Evento de envio do formulário
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = emailEl.value.trim();
    if (!email) {
      exibirAviso({ tipo: "erro", mensagem: "Digite seu e-mail para continuar." });
      return;
    }

    console.log("📨 Solicitando token para:", email);

    try {
      const resposta = await window.api.solicitarToken(email);
      console.log("📩 Resposta da solicitação de token:", resposta);

      if (resposta?.sucesso) {
        exibirAviso({
          tipo: "sucesso",
          mensagem: "Token enviado com sucesso! Verifique seu e-mail.",
          aoFechar: () => {
            console.log("➡️ Redirecionando para página de redefinição de senha...");
            window.location.href = "redefinirSenha.html";
          }
        });
      } else {
        console.warn("⚠️ Erro retornado pela API:", resposta?.erro);
        exibirAviso({ tipo: "erro", mensagem: resposta?.erro || "Erro ao solicitar token." });
      }
    } catch (erro) {
      console.error("❌ Erro inesperado ao solicitar token:", erro);
      exibirAviso({ tipo: "erro", mensagem: "Erro ao solicitar token. Tente novamente mais tarde." });
    }
  });
});
