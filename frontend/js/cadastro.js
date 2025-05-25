
import { exibirAviso } from "./modalAviso.js";
import { componentesCarregados } from "./incluirComponentes.js";
import { inicializarRegrasSenha } from "./senhaRegra.js";
import { inicializarForcaSenha } from "./forcaSenha.js";
import { inicializarBotaoVerSenha } from "./verSenha.js";

async function esperarElemento(seletor, tentativas = 20, intervalo = 100) {
  for (let i = 0; i < tentativas; i++) {
    if (document.querySelector(seletor)) return true;
    await new Promise(resolve => setTimeout(resolve, intervalo));
  }
  console.warn(`⚠️ Elemento ${seletor} não carregado após ${tentativas} tentativas.`);
  return false;
}

document.addEventListener("DOMContentLoaded", async () => {
  await componentesCarregados;
  await esperarElemento("#cadastroForm");

  inicializarRegrasSenha();
  inicializarForcaSenha();
  inicializarBotaoVerSenha();

  console.log("✅ Componentes de senha e botões carregados.");

  const form = document.getElementById("cadastroForm");
  const senhaInput = document.getElementById("senha");
  const confirmarSenhaInput = document.getElementById("confirmarsenha");

    form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const senha = senhaInput.value.trim();
    const confirmarSenha = confirmarSenhaInput.value.trim();

    console.log("📩 E-mail digitado:", email);

    if (senha !== confirmarSenha) {
      console.log("⚠️ Senhas não coincidem.");
      exibirAviso({
        tipo: "❌ Erro",
        mensagem: "As senhas não coincidem."
      });
      return;
    }

    console.log("🔍 Verificando se e-mail já existe...");
    const emailExiste = await window.api.verificarEmailExistente(email);
    console.log("🔁 Resultado da verificação:", emailExiste);

    if (emailExiste) {
      console.log("⚠️ E-mail já está em uso. Exibindo aviso.");
      exibirAviso({
        tipo: "❌ Erro",
        mensagem: "O e-mail informado já está em uso. Por favor, tente outro."
      });
      return;
    }

    const dadosUsuario = {
      email,
      senha,
      aluno: document.getElementById("aluno").value,
      casaEspírita: document.getElementById("casaEspírita").value,
      numeroTurma: document.getElementById("numeroTurma").value,
      dirigente: document.getElementById("dirigente").value,
      emailDirigente: document.getElementById("emailDirigente").value,
      secretarios: document.getElementById("secretarios").value,
      telefone: document.getElementById("telefone").value,
      codigoTemas: document.getElementById("codigoTemas").value
    };

    console.log("📤 Enviando dados para salvar cadastro:", dadosUsuario);

    const resultado = await window.api.salvarCadastro(dadosUsuario);
    console.log("📬 Resultado do salvamento:", resultado);

    if (resultado.sucesso) {
      exibirAviso({
        tipo: "✅ Sucesso",
        mensagem: "Cadastro realizado com sucesso!"
      });
      form.reset();
    } else {
      exibirAviso({
        tipo: "❌ Erro",
        mensagem: resultado.erro || "Erro desconhecido ao salvar."
      });
    }
  });
});
