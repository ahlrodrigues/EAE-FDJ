// === js/cadastro.js ===

console.log("\u{1F50D} window.api:", window.api);
console.log("\u{1F50D} window.api.ouvirTermoAceito:", window.api?.ouvirTermoAceito);

import { exibirAviso } from "./modalAviso.js";
import { componentesCarregados } from "./incluirComponentes.js";
import { inicializarValidacaoSenha } from "./senhaRegra.js";
import { inicializarBotaoVerSenha } from "./verSenha.js";

let aceiteTermos = false;

async function esperarElemento(seletor, tentativas = 20, intervalo = 100) {
  for (let i = 0; i < tentativas; i++) {
    if (document.querySelector(seletor)) return true;
    await new Promise(resolve => setTimeout(resolve, intervalo));
  }
  console.warn(`\u26A0\uFE0F Elemento ${seletor} n\u00E3o encontrado ap\u00F3s ${tentativas} tentativas.`);
  return false;
}

function validarCampoIndividual(campo) {
  const valor = campo.value.trim();
  const id = campo.id;
  let mensagemErro = "";

  const erroExistente = document.getElementById(`erro-${id}`);
  if (erroExistente) erroExistente.remove();

  switch (id) {
    case "email":
      if (!/\S+@\S+\.\S+/.test(valor)) mensagemErro = "E-mail inv\u00E1lido.";
      break;
    case "telefone":
      if (valor.length < 8) mensagemErro = "Telefone muito curto.";
      break;
    case "senha":
    case "confirmarsenha":
      const senha = document.getElementById("senha")?.value.trim();
      const confirmar = document.getElementById("confirmarsenha")?.value.trim();
      if (senha && confirmar && senha !== confirmar) {
        mensagemErro = "Senhas n\u00E3o coincidem.";
        aplicarErro(document.getElementById("senha"), mensagemErro);
        aplicarErro(document.getElementById("confirmarsenha"), mensagemErro);
        atualizarEstadoBotaoSalvar();
        return;
      } else {
        removerErro(document.getElementById("senha"));
        removerErro(document.getElementById("confirmarsenha"));
      }
      break;
    default:
      if (!valor) mensagemErro = "Campo obrigat\u00F3rio.";
  }

  if (mensagemErro) aplicarErro(campo, mensagemErro);
  else removerErro(campo);

  atualizarEstadoBotaoSalvar();
}

function aplicarErro(campo, mensagem) {
  if (!campo) return;
  campo.classList.add("invalido");
  const divErro = document.createElement("div");
  divErro.className = "erro-campo";
  divErro.id = `erro-${campo.id}`;
  divErro.textContent = mensagem;
  const parent = campo.parentElement;
  if (parent) parent.insertBefore(divErro, campo);
}

function removerErro(campo) {
  if (!campo) return;
  campo.classList.remove("invalido");
  const erroEl = document.getElementById(`erro-${campo.id}`);
  if (erroEl) erroEl.remove();
}

function verificarCamposCadastroPreenchidos() {
  const camposObrigatorios = [
    "casaEsp\u00EDrita", "numeroTurma", "dirigente", "emailDirigente",
    "secretarios", "aluno", "email", "telefone", "senha", "confirmarsenha"
  ];
  return camposObrigatorios.every(id => {
    const el = document.getElementById(id);
    return el && el.value.trim() !== "";
  });
}

function camposPossuemErro() {
  return document.querySelectorAll(".invalido").length > 0;
}

function ativarValidacaoAoDigitar() {
  const campos = document.querySelectorAll("input, textarea, select");
  campos.forEach(campo => {
    campo.addEventListener("input", () => {
      validarCampoIndividual(campo);
      atualizarEstadoBotaoTermo();
    });
    campo.addEventListener("blur", () => validarCampoIndividual(campo));
  });
}

function atualizarEstadoBotaoTermo() {
  const tudoPreenchido = verificarCamposCadastroPreenchidos();
  const senha = document.getElementById("senha")?.value.trim();
  const codigoTemas = document.getElementById("codigoTemas")?.value.trim();
  const btnTermo = document.getElementById("btnTermo");

  if (tudoPreenchido && senha && codigoTemas) {
    btnTermo.style.display = "inline-block";
    btnTermo.disabled = false;
    console.log("\u2705 Campos obrigat\u00F3rios preenchidos + senha + codigoTemas → Bot\u00E3o termo exibido.");
  } else {
    btnTermo.style.display = "none";
    btnTermo.disabled = true;
    console.log("⛔ Campos incompletos → Bot\u00E3o termo oculto.");
  }
}

function atualizarEstadoBotaoSalvar() {
  const btnSalvar = document.getElementById("btnSalvar");
  if (!btnSalvar) return;
  const temErro = camposPossuemErro();
  btnSalvar.disabled = temErro;
  console.log(`\u{1F504} Bot\u00E3o Salvar ${temErro ? "desativado" : "ativado"} devido a erros.`);
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log("⚙️ DOM totalmente carregado.");
  await componentesCarregados;
  await esperarElemento("#cadastroForm");

  inicializarValidacaoSenha();
  inicializarBotaoVerSenha();

  console.log("✅ Componentes carregados e senha pronta para valida\u00E7\u00E3o.");

  const idiomaEl = document.getElementById("idioma");
  const bandeiraEl = document.getElementById("bandeiraIdioma");
  const btnTermo = document.getElementById("btnTermo");
  const btnSalvar = document.getElementById("btnSalvar");
  const msgAceite = document.getElementById("msgAceite");

  btnTermo.style.display = "none";
  btnSalvar.style.display = "none";
  msgAceite.style.display = "none";

  idiomaEl.addEventListener("change", () => {
    const flagCode = idiomaEl.selectedOptions[0].dataset.flag;
    bandeiraEl.src = `https://flagcdn.com/24x18/${flagCode}.png`;
  });

  ativarValidacaoAoDigitar();
  atualizarEstadoBotaoTermo();

  if (typeof window.api?.ouvirTermoAceito === "function") {
    console.log("\u{1F442} Registrando ouvinte 'termo-aceito'");
    window.api.ouvirTermoAceito(async () => {
      console.log("\u{1F4E5} Evento 'termo-aceito' recebido");
      await aplicarEstadoTermoAceito();
    });
  }

  async function aplicarEstadoTermoAceito() {
    aceiteTermos = true;
    await esperarElemento("#btnSalvar");
    await esperarElemento("#msgAceite");
    await esperarElemento("#btnTermo");

    btnTermo.style.display = "none";
    btnTermo.disabled = true;
    btnSalvar.style.display = "inline-block";
    btnSalvar.disabled = camposPossuemErro();
    msgAceite.style.display = "block";
  }

  btnTermo.addEventListener("click", async () => {
    try {
      console.log("📄 Abrindo janela do termo...");
      await window.api.abrirJanelaTermo();
    } catch (erro) {
      console.error("❌ Erro ao abrir termo:", erro);
    }
  });

  btnSalvar.addEventListener("click", async () => {
    console.log("📨 Clique em Salvar Cadastro detectado.");

    if (!verificarCamposCadastroPreenchidos()) {
      return exibirAviso({ tipo: "⚠️ Atenção", mensagem: "Preencha todos os campos obrigatórios antes de salvar o cadastro." });
    }

    if (!aceiteTermos) {
      return exibirAviso({ tipo: "⚠️ Atenção", mensagem: "Você precisa aceitar os termos antes de salvar o cadastro." });
    }

    const senha = document.getElementById("senha").value.trim();
    const confirmar = document.getElementById("confirmarsenha").value.trim();
    if (senha !== confirmar) {
      return exibirAviso({ tipo: "⚠️ Atenção", mensagem: "As senhas não coincidem. Verifique e tente novamente." });
    }

    const email = document.getElementById("email").value.trim();
    const emailExiste = await window.api.verificarEmailExistente(email);
    if (emailExiste) {
      return exibirAviso({ tipo: "❌ Erro", mensagem: "O e-mail informado já está em uso. Por favor, tente outro." });
    }

    const idiomaEl = document.getElementById("idioma");

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
      codigoTemas: document.getElementById("codigoTemas").value,
      idioma: idiomaEl.value,
      aceiteTermos: true,
      emailHash: window.nativo.gerarEmailHash(email)
    };

    console.log("📤 Enviando dados:", dadosUsuario);

    const resultado = await window.api.salvarCadastro(dadosUsuario);
    if (resultado.sucesso) {
      exibirAviso({
        tipo: "✅ Sucesso",
        mensagem: "Cadastro realizado com sucesso!",
        aoFechar: () => {
          window.location.href = "login.html";
        }
      });
    } else {
      exibirAviso({ tipo: "❌ Erro", mensagem: resultado.erro || "Erro desconhecido ao salvar." });
    }
  });
});
