// === js/cadastro.js ===
import { exibirAviso } from "./modalAviso.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("cadastroForm");
  const senhaInput = document.getElementById("senha");
  const confirmarSenhaInput = document.getElementById("confirmarsenha");

  if (!form || !senhaInput || !confirmarSenhaInput) {
    console.error("❌ Elementos do formulário não encontrados.");
    return;
  }

  document.getElementById("toggleSenha1")?.addEventListener("click", () => {
    senhaInput.type = senhaInput.type === "password" ? "text" : "password";
  });

  document.getElementById("toggleSenha2")?.addEventListener("click", () => {
    confirmarSenhaInput.type = confirmarSenhaInput.type === "password" ? "text" : "password";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (senhaInput.value !== confirmarSenhaInput.value) {
      exibirAviso({ tipo: "erro", mensagem: "As senhas não coincidem." });
      return;
    }

    const dados = {
      casaEspírita: form.casaEspírita.value.trim(),
      numeroTurma: form.numeroTurma.value.trim(),
      dirigente: form.dirigente.value.trim(),
      emailDirigente: form.emailDirigente.value.trim(),
      secretarios: form.secretarios.value.trim(),
      aluno: form.aluno.value.trim(),
      email: form.email.value.trim(),
      telefone: form.telefone.value.trim(),
      senha: senhaInput.value
    };

    try {
      const resultado = await window.electronAPI.salvarCadastro(dados);

      if (resultado.sucesso) {
        exibirAviso({ tipo: "sucesso", mensagem: "Usuário cadastrado com sucesso!", aoFechar: () => window.location.reload() });
      } else {
        exibirAviso({ tipo: "erro", mensagem: resultado.erro || "Erro ao salvar cadastro." });
      }
    } catch (erro) {
      console.error("❌ Erro inesperado ao tentar salvar cadastro:", erro);
      exibirAviso({ tipo: "erro", mensagem: "Erro inesperado ao tentar salvar." });
    }
  });
});
