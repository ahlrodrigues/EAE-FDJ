// === js/cadastro.js ===
import { exibirAviso } from "./modalAviso.js";
import { incluir, carregarComponentesFixos } from "./incluirComponentes.js";

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🔄 DOMContentLoaded iniciado");

  // Garante que o modal está no DOM antes de qualquer uso
  await incluir("modalAvisoContainer", "componentes/modalAviso.html");
  console.log("✅ modalAviso incluído");

  // Formulário e campos principais
  const form = document.getElementById("cadastroForm");
  const senhaInput = document.getElementById("senha");
  const confirmarSenhaInput = document.getElementById("confirmarsenha");

  if (!form || !senhaInput || !confirmarSenhaInput) {
    console.error("❌ Elementos do formulário não encontrados.");
    return;
  }

  // Verifica se API de salvarCadastro está disponível via preload
  if (!window.api?.salvarCadastro) {
    console.warn("⚠️ API salvarCadastro não disponível no preload");
    exibirAviso({
      tipo: "erro",
      mensagem: "API de cadastro não está disponível. Verifique preload.js."
    });
    return;
  }

  // Botões para exibir/ocultar senha
  document.getElementById("toggleSenha1")?.addEventListener("click", () => {
    senhaInput.type = senhaInput.type === "password" ? "text" : "password";
  });

  document.getElementById("toggleSenha2")?.addEventListener("click", () => {
    confirmarSenhaInput.type = confirmarSenhaInput.type === "password" ? "text" : "password";
  });

  // Inclui visual das regras de senha
  incluir("senhaRegrasContainer", "componentes/senhaRegras.html", () => {
    import("./validacaoSenha.js")
      .then(() => console.log("✅ validacaoSenha.js carregado"))
      .catch(err => console.error("❌ Erro ao importar validacaoSenha.js:", err));
  });

  // Evento de envio do formulário
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Confirmação de senha
    if (senhaInput.value !== confirmarSenhaInput.value) {
      exibirAviso({ tipo: "erro", mensagem: "As senhas não coincidem." });
      return;
    }

    // Monta objeto com dados do formulário
    const dados = {
      casaEspírita: form.casaEspírita.value.trim(),
      numeroTurma: form.numeroTurma.value.trim(),
      dirigente: form.dirigente.value.trim(),
      emailDirigente: form.emailDirigente.value.trim(),
      secretarios: form.secretarios.value.trim(),
      aluno: form.aluno.value.trim(),
      email: form.email.value.trim(),
      telefone: form.telefone.value.trim(),
      senha: senhaInput.value,
      codigoTemas: form.codigoTemas.value.trim(),
    };

    // Validação de campos obrigatórios
    if (!dados.email || !dados.senha || !dados.aluno) {
      exibirAviso({ tipo: "erro", mensagem: "Preencha todos os campos obrigatórios." });
      return;
    }

    try {
      console.log("📤 Enviando dados para salvarCadastro:", dados);
      const resultado = await window.api.salvarCadastro(dados);

      if (resultado.sucesso) {
        console.log("✅ Cadastro salvo com sucesso");
        exibirAviso({
          tipo: "sucesso",
          mensagem: "Usuário cadastrado com sucesso!",
          aoFechar: () => window.location.href = "login.html"
        });
      } else {
        console.warn("⚠️ Falha ao salvar cadastro:", resultado.erro);
        exibirAviso({ tipo: "erro", mensagem: resultado.erro || "Erro ao salvar cadastro." });
      }
    } catch (erro) {
      console.error("❌ Erro inesperado ao tentar salvar cadastro:", erro);
      exibirAviso({ tipo: "erro", mensagem: "Erro inesperado ao tentar salvar." });
    }
  });
});
