// === js/cadastro.js ===

import { exibirAviso } from "./modalAviso.js";
import { componentesCarregados } from "./incluirComponentes.js";
import { inicializarRegrasSenha } from "./senhaRegra.js";
import { inicializarForcaSenha } from "./forcaSenha.js";
import { inicializarBotaoVerSenha } from "./verSenha.js";

// 🌐 Controle global do aceite
let aceiteTermos = false;

async function esperarElemento(seletor, tentativas = 20, intervalo = 100) {
  for (let i = 0; i < tentativas; i++) {
    if (document.querySelector(seletor)) return true;
    await new Promise(resolve => setTimeout(resolve, intervalo));
  }
  console.warn(`⚠️ Elemento ${seletor} não encontrado após ${tentativas} tentativas.`);
  return false;
}

document.addEventListener("DOMContentLoaded", async () => {
  await componentesCarregados;
  await esperarElemento("#cadastroForm");

  inicializarRegrasSenha();
  inicializarForcaSenha();
  inicializarBotaoVerSenha();

  console.log("✅ Componentes carregados.");

  const form = document.getElementById("cadastroForm");
  const senhaInput = document.getElementById("senha");
  const confirmarSenhaInput = document.getElementById("confirmarsenha");
  const btnTermo = document.getElementById("btnTermo");
  const btnSalvar = document.getElementById("btnSalvar");
  const msgAceite = document.getElementById("msgAceite");
  const idiomaEl = document.getElementById("idioma");
  const bandeiraEl = document.getElementById("bandeiraIdioma");

  idiomaEl.addEventListener("change", () => {
    const flagCode = idiomaEl.selectedOptions[0].dataset.flag;
    bandeiraEl.src = `https://flagcdn.com/24x18/${flagCode}.png`;
  });

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

  function ativarVerificacaoCamposCadastro() {
    const campos = document.querySelectorAll("input, textarea, select");
    campos.forEach((campo) => {
      campo.addEventListener("input", () => {
        const tudoPreenchido = verificarCamposCadastroPreenchidos();
        btnTermo.disabled = !tudoPreenchido;
        if (!aceiteTermos) btnSalvar.style.display = "none"; // reforça segurança visual
      });
    });
  }

  ativarVerificacaoCamposCadastro();

  // 📜 Recebe o aceite do termo
  window.api?.ouvirTermoAceito?.(() => {
    console.log("📜 Termo aceito via IPC.");
    aceiteTermos = true;

    // Atualiza UI
    btnTermo.style.display = "none";
    msgAceite.style.display = "block";
    btnSalvar.style.display = "block";

    console.log("✅ Estado visual atualizado após aceite.");
  });

  // 📄 Abre a janela do termo
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
      return exibirAviso({
        tipo: "⚠️ Atenção",
        mensagem: "Preencha todos os campos obrigatórios antes de salvar o cadastro."
      });
    }

    if (!aceiteTermos) {
      return exibirAviso({
        tipo: "⚠️ Atenção",
        mensagem: "Você precisa aceitar os termos antes de salvar o cadastro."
      });
    }

    const email = document.getElementById("email").value;
    const senha = senhaInput.value;
    const confirmarsenha = confirmarSenhaInput.value;

    if (senha !== confirmarsenha) {
      return exibirAviso({
        tipo: "⚠️ Atenção",
        mensagem: "As senhas não coincidem. Verifique e tente novamente."
      });
    }

    const emailExiste = await window.api.verificarEmailExistente(email);
    if (emailExiste) {
      return exibirAviso({
        tipo: "❌ Erro",
        mensagem: "O e-mail informado já está em uso. Por favor, tente outro."
      });
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
      // form.reset(); // ❌ Removido para não limpar dados em caso de teste
    } else {
      exibirAviso({
        tipo: "❌ Erro",
        mensagem: resultado.erro || "Erro desconhecido ao salvar."
      });
    }
  });
});
