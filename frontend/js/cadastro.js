import { exibirAviso } from "./modalAviso.js";
import { componentesCarregados } from "./incluirComponentes.js";
import { inicializarRegrasSenha } from "./senhaRegra.js";
import { inicializarForcaSenha } from "./forcaSenha.js";
import { inicializarBotaoVerSenha } from "./verSenha.js";

// 🌐 Variável global de controle de aceite
let aceiteTermos = false;

// 🕒 Aguarda elemento específico carregar
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
  const btnTermo = document.getElementById("btnTermo");
  const btnSalvar = document.getElementById("btnSalvar");
  const msgAceite = document.getElementById("msgAceite");

  // 🎌 Idioma e bandeira
  const idiomaEl = document.getElementById("idioma");
  const bandeiraEl = document.getElementById("bandeiraIdioma");

  idiomaEl.addEventListener("change", () => {
    const flagCode = idiomaEl.selectedOptions[0].dataset.flag;
    bandeiraEl.src = `https://flagcdn.com/24x18/${flagCode}.png`;
  });

  // 🧠 Verifica se todos os campos obrigatórios estão preenchidos
  function verificarCamposCadastroPreenchidos() {
    const camposObrigatorios = [
      "casaEspírita", "numeroTurma", "dirigente", "emailDirigente",
      "secretarios", "aluno", "email", "telefone", "senha", "confirmarsenha"
    ];
    return camposObrigatorios.every((id) => {
      const el = document.getElementById(id);
      return el && el.value.trim() !== "";
    });
  }

  // 🔁 Monitora alterações para liberar botão do termo
  function ativarVerificacaoCamposCadastro() {
    const campos = document.querySelectorAll("input, textarea, select");
    campos.forEach((campo) => {
      campo.addEventListener("input", () => {
        if (verificarCamposCadastroPreenchidos()) {
          btnTermo.removeAttribute("disabled");
        } else {
          btnTermo.setAttribute("disabled", true);
        }
      });
    });
  }

  ativarVerificacaoCamposCadastro();

  // 📜 Botão para abrir o termo
  btnTermo.addEventListener("click", async () => {
    try {
      const resultado = await window.api.abrirJanelaTermo();

      // 🟢 Ao aceitar o termo na outra janela
      window.api?.ouvirTermoAceito?.(() => {
        aceiteTermos = true; // atualiza variável global
        btnTermo.style.display = "none";
        msgAceite.style.display = "block";
        btnSalvar.style.display = "block";
      });
    } catch (erro) {
      console.error("❌ Erro ao abrir termo:", erro);
    }
  });

  // 📩 Evento de envio do formulário
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const senha = senhaInput.value.trim();
    const confirmarSenha = confirmarSenhaInput.value.trim();

    if (!aceiteTermos) {
      exibirAviso({
        tipo: "⚠️ Aviso",
        mensagem: "Você deve aceitar o termo de uso antes de se cadastrar."
      });
      return;
    }

    if (senha !== confirmarSenha) {
      exibirAviso({
        tipo: "❌ Erro",
        mensagem: "As senhas não coincidem."
      });
      return;
    }

    const emailExiste = await window.api.verificarEmailExistente(email);
    if (emailExiste) {
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
      codigoTemas: document.getElementById("codigoTemas").value,
      idioma: idiomaEl.value,
      aceiteTermos: true
    };

    dadosUsuario.emailHash = window.nativo.gerarEmailHash(dadosUsuario.email);
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
      form.reset();
    } else {
      exibirAviso({
        tipo: "❌ Erro",
        mensagem: resultado.erro || "Erro desconhecido ao salvar."
      });
    }
  });
});
