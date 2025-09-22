// === solicitarToken.js ===
// Caminho: frontend/js/solicitarToken.js
// Frontend da página de solicitação de token de redefinição de senha
// Melhorias:
//  - Validação simples de e-mail
//  - Botão desabilitado durante a requisição (evita duplo submit)
//  - Logs padronizados e sem vazamento de dados sensíveis
//  - Mensagens de erro mais claras

import { exibirAviso } from "./modalAviso.js";
import { componentesCarregados } from "./incluirComponentes.js";

// Validação bem simples de e-mail (sem exageros no regex)
function emailValido(e) {
  if (!e) return false;
  const s = String(e).trim().toLowerCase();
  return s.includes("@") && s.includes("."); // suficiente pro formulário
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log("📄[solicitarToken] arquivo carregado");

  // Aguarda o carregamento dos componentes (cabeçalho, rodapé, etc.)
  await componentesCarregados;
  console.log("📦[solicitarToken] componentes carregados");

  // Referências aos elementos do formulário
  const form = document.getElementById("form-token");
  const emailEl = document.getElementById("email");
  const submitBtn = form?.querySelector("button[type='submit']");

  // Verifica se a API está disponível no preload
  if (!window.api || typeof window.api.solicitarToken !== "function") {
    console.error("❌[solicitarToken] API não disponível:", window.api);
    exibirAviso({ tipo: "erro", mensagem: "Erro interno: API não disponível." });
    return;
  }

  // Evento de envio do formulário
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = emailEl.value.trim();
    if (!emailValido(email)) {
      exibirAviso({ tipo: "erro", mensagem: "Digite um e-mail válido." });
      emailEl.focus();
      return;
    }

    console.log("📨[solicitarToken] solicitando token para:", email.replace(/^(.).+(@.+)$/, "$1***$2"));
    submitBtn?.setAttribute("disabled", "disabled");

    try {
      const resposta = await window.api.solicitarToken(email);
      console.log("📩[solicitarToken] resposta:", resposta);

      if (resposta?.sucesso) {
        exibirAviso({
          tipo: "sucesso",
          mensagem: "Token enviado! Verifique seu e-mail.",
          aoFechar: () => {
            console.log("➡️[solicitarToken] redirecionando para redefinição…");
            window.location.href = "redefinirSenha.html";
          },
        });
      } else {
        console.warn("⚠️[solicitarToken] erro retornado:", resposta?.erro);
        exibirAviso({ tipo: "erro", mensagem: resposta?.erro || "Erro ao solicitar token." });
      }
    } catch (erro) {
      console.error("❌[solicitarToken] exceção inesperada:", erro);
      exibirAviso({ tipo: "erro", mensagem: "Erro ao solicitar token. Tente novamente mais tarde." });
    } finally {
      submitBtn?.removeAttribute("disabled");
    }
  });
});
