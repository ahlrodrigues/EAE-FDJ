// =============================================================================
// Caminho: /frontend/js/cadastro.js
// Tela: PRIMEIRO CADASTRO (criação de conta)
// Objetivos:
//  - Usar spans de erro existentes (#erro-<id>) em vez de criar <div> dinâmicos.
//  - Validar e-mail, telefone (via pattern do input), senha=confirmar.
//  - Normalizar idioma (BCP47 quando possível).
//  - Logs seguros e consistentes (sem vazar senha / email puro).
//  - Compat com backend: window.api.salvarCadastro(dados) e
//    window.api.verificarEmailExistente(email).
// Logs: prefixo 🧩[CADASTRO-NOVO-UI]
// =============================================================================

import { exibirAviso } from "./modalAviso.js";
import { componentesCarregados } from "./incluirComponentes.js";
import { inicializarValidacaoSenha } from "./senhaRegra.js";
import { inicializarBotaoVerSenha } from "./verSenha.js";

const LOG = "🧩[CADASTRO-NOVO-UI]";
let aceiteTermos = false;

// 🔎 Helpers DOM
async function esperarElemento(seletor, tentativas = 20, intervalo = 100) {
  for (let i = 0; i < tentativas; i++) {
    if (document.querySelector(seletor)) return true;
    await new Promise((r) => setTimeout(r, intervalo));
  }
  console.warn(`${LOG} ⚠️ Elemento ${seletor} não encontrado após ${tentativas} tentativas.`);
  return false;
}
const qs  = (sel) => document.querySelector(sel);
const qsa = (sel) => Array.from(document.querySelectorAll(sel));

// 🔧 Erros (usa os <span id="erro-<id>"> já existentes no HTML)
function setErro(inputEl, mensagem) {
  if (!inputEl) return;
  inputEl.classList.add("invalido");
  const spanId = `erro-${inputEl.id}`;
  let span = qs(`#${spanId}`);
  if (!span) {
    // fallback: cria se não existir (evita quebrar se HTML mudar)
    span = document.createElement("span");
    span.id = spanId;
    span.className = "erro-campo";
    inputEl.insertAdjacentElement("afterend", span);
  }
  span.textContent = mensagem || "";
  span.style.display = mensagem ? "block" : "none";
}
function clearErro(inputEl) {
  if (!inputEl) return;
  inputEl.classList.remove("invalido");
  const span = qs(`#erro-${inputEl.id}`);
  if (span) {
    span.textContent = "";
    span.style.display = "none";
  }
}

// 🧪 Validações
function isValidEmail(v) {
  return /\S+@\S+\.\S+/.test(String(v || "").trim());
}
function isValidTelefone(inputEl) {
  if (!inputEl) return false;
  const v = String(inputEl.value || "").trim();
  // Se houver pattern no HTML, respeite-o:
  const pattern = inputEl.getAttribute("pattern");
  if (pattern) {
    try {
      const re = new RegExp(pattern);
      return re.test(v);
    } catch {
      // fallback simples
      return v.length >= 8;
    }
  }
  return v.length >= 8;
}
function normalizarIdioma(v) {
  // Aceita pt → pt-BR, en → en-US, etc. Mantém se já vier BCP47.
  const map = { pt: "pt-BR", en: "en-US", fr: "fr-FR", de: "de-DE", it: "it-IT" };
  return map[v] || v || "pt-BR";
}

// ✔️ Validação automática por campo
function validarCampoIndividual(campo) {
  if (!campo) return;
  const id = campo.id;
  const valor = String(campo.value || "").trim();
  let msg = "";

  switch (id) {
    case "email":
      if (!isValidEmail(valor)) msg = "E-mail inválido.";
      break;

    case "telefone":
      if (!isValidTelefone(campo)) msg = "Telefone inválido. Ex.: +55 11 91234-5678";
      break;

    case "senha":
    case "confirmarsenha": {
      const senha = String(qs("#senha")?.value || "").trim();
      const confirmar = String(qs("#confirmarsenha")?.value || "").trim();
      if (senha && confirmar && senha !== confirmar) {
        msg = "Senhas não coincidem.";
        setErro(qs("#senha"), msg);
        setErro(qs("#confirmarsenha"), msg);
        atualizarEstadoBotoes();
        return;
      } else {
        clearErro(qs("#senha"));
        clearErro(qs("#confirmarsenha"));
      }
      break;
    }

    default:
      if (campo.required && !valor) msg = "Campo obrigatório.";
  }

  if (msg) setErro(campo, msg);
  else clearErro(campo);

  atualizarEstadoBotoes();
}

function camposPossuemErro() {
  return qsa(".invalido").length > 0;
}

function verificarCamposCadastroPreenchidos() {
  const obrig = [
    "casaEspírita", "numeroTurma", "dirigente", "emailDirigente",
    "secretarios", "aluno", "email", "telefone", "senha", "confirmarsenha"
  ];
  return obrig.every((id) => {
    const el = qs("#" + id);
    return el && String(el.value || "").trim() !== "";
  });
}

function ativarValidacaoAoDigitar() {
  qsa("input, textarea, select").forEach((el) => {
    el.addEventListener("input", () => {
      validarCampoIndividual(el);
      atualizarEstadoBotoes();
    });
    el.addEventListener("blur", () => validarCampoIndividual(el));
  });
}

// 🎛️ Controle dos botões (termo/salvar)
function atualizarEstadoBotoes() {
  const btnTermo  = qs("#btnTermo");
  const btnSalvar = qs("#btnSalvar");

  const tudoPreenchido = verificarCamposCadastroPreenchidos();
  const semErros       = !camposPossuemErro();

  if (btnTermo) {
    const mostrarTermo = tudoPreenchido && semErros && !aceiteTermos;
    btnTermo.style.display = mostrarTermo ? "inline-block" : "none";
    btnTermo.disabled = !mostrarTermo;
  }
  if (btnSalvar) {
    // Só mostra após aceite; habilita se sem erros:
    btnSalvar.style.display = aceiteTermos ? "inline-block" : "none";
    btnSalvar.disabled = !aceiteTermos || !semErros;
  }
}

// 🚀 Main
document.addEventListener("DOMContentLoaded", async () => {
  console.log(`${LOG} janela carregada. window.api=`, !!window.api);

  await componentesCarregados;
  await esperarElemento("#cadastroForm");

  inicializarValidacaoSenha();
  inicializarBotaoVerSenha();
  console.log(`${LOG} componentes de senha prontos.`);

  // Bind de idioma + bandeira
  const idiomaEl   = qs("#idioma");
  const bandeiraEl = qs("#bandeiraIdioma");
  if (idiomaEl && bandeiraEl) {
    idiomaEl.addEventListener("change", () => {
      const opt = idiomaEl.selectedOptions?.[0];
      const flag = opt?.dataset?.flag || "br";
      bandeiraEl.src = `https://flagcdn.com/24x18/${flag}.png`;
    });
  }

  // Estado inicial de botões
  const btnTermo  = qs("#btnTermo");
  const btnSalvar = qs("#btnSalvar");
  const msgAceite = qs("#msgAceite");
  if (btnTermo)  { btnTermo.style.display = "none"; btnTermo.disabled = true; }
  if (btnSalvar) { btnSalvar.style.display = "none"; btnSalvar.disabled = true; }
  if (msgAceite) { msgAceite.style.display = "none"; }

  ativarValidacaoAoDigitar();
  atualizarEstadoBotoes();

  // Ouvir aceite do termo (via preload → main)
  if (typeof window.api?.ouvirTermoAceito === "function") {
    console.log(`${LOG} registrando ouvinte 'termo-aceito'`);
    window.api.ouvirTermoAceito(async () => {
      console.log(`${LOG} evento 'termo-aceito' recebido`);
      aceiteTermos = true;
      if (btnTermo)  { btnTermo.style.display = "none"; btnTermo.disabled = true; }
      if (btnSalvar) { btnSalvar.style.display = "inline-block"; btnSalvar.disabled = camposPossuemErro(); }
      if (msgAceite) { msgAceite.style.display = "block"; }
    });
  }

  // Abrir termo
  btnTermo?.addEventListener("click", async () => {
    try {
      console.log(`${LOG} abrindo janela do termo…`);
      await window.api.abrirJanelaTermo();
    } catch (e) {
      console.error(`${LOG} ❌ erro ao abrir termo:`, e?.message || e);
    }
  });

  // Salvar cadastro
  btnSalvar?.addEventListener("click", async () => {
    console.log(`${LOG} clique em Salvar Cadastro`);

    if (!verificarCamposCadastroPreenchidos()) {
      return exibirAviso({ tipo: "erro", mensagem: "Preencha todos os campos obrigatórios antes de salvar o cadastro." });
    }
    if (camposPossuemErro()) {
      return exibirAviso({ tipo: "erro", mensagem: "Corrija os campos destacados antes de salvar." });
    }
    if (!aceiteTermos) {
      return exibirAviso({ tipo: "erro", mensagem: "Você precisa aceitar os termos antes de salvar o cadastro." });
    }

    const senha     = String(qs("#senha")?.value || "").trim();
    const confirmar = String(qs("#confirmarsenha")?.value || "").trim();
    if (senha !== confirmar) {
      return exibirAviso({ tipo: "erro", mensagem: "As senhas não coincidem. Verifique e tente novamente." });
    }

    const email = String(qs("#email")?.value || "").trim().toLowerCase();
    if (!isValidEmail(email)) {
      return exibirAviso({ tipo: "erro", mensagem: "E-mail inválido." });
    }

    // 🔐 emailHash gerado no preload (HMAC-SHA256 com APP_MASTER_KEY)
    const emailHash = window.nativo?.gerarEmailHash?.(email);
    if (!emailHash || !/^[a-f0-9]{64}$/i.test(emailHash)) {
      console.error(`${LOG} ❌ gerarEmailHash falhou ou inválido.`);
      return exibirAviso({ tipo: "erro", mensagem: "Erro interno ao gerar identificador seguro do e-mail." });
    }

    // Evita crash se handler não existir
    let emailExiste = false;
    try {
      if (typeof window.api?.verificarEmailExistente === "function") {
        emailExiste = await window.api.verificarEmailExistente(email);
      }
    } catch (e) {
      console.warn(`${LOG} verificarEmailExistente falhou/ausente:`, e?.message || e);
    }
    if (emailExiste) {
      return exibirAviso({ tipo: "erro", mensagem: "O e-mail informado já está em uso. Por favor, tente outro." });
    }

    // Normaliza idioma (aceita pt → pt-BR, etc.)
    const idiomaOrig = String(qs("#idioma")?.value || "pt-BR");
    const idioma = normalizarIdioma(idiomaOrig);

    const dadosUsuario = {
      email,
      senha,
      aluno: qs("#aluno")?.value,
      casaEspírita: qs("#casaEspírita")?.value,
      numeroTurma: qs("#numeroTurma")?.value,
      dirigente: qs("#dirigente")?.value,
      emailDirigente: qs("#emailDirigente")?.value,
      secretarios: qs("#secretarios")?.value,
      telefone: qs("#telefone")?.value,
      idioma,
      aceiteTermos: true,
      emailHash
    };

    // Log seguro (não vazar senha/email puro)
    const masked = {
      ...dadosUsuario,
      email: `${email.slice(0, 1)}***@${email.split("@")[1]}`,
      senha: "***",
      emailHash: `${emailHash.slice(0, 8)}…`
    };
    console.log(`${LOG} enviando dados:`, masked);

    try {
      const res = await window.api?.salvarCadastro?.(dadosUsuario);
      if (res?.sucesso) {
        exibirAviso({
          tipo: "sucesso",
          mensagem: "Cadastro realizado com sucesso!",
          aoFechar: () => (window.location.href = "login.html")
        });
      } else {
        exibirAviso({ tipo: "erro", mensagem: res?.erro || "Erro desconhecido ao salvar." });
      }
    } catch (e) {
      console.error(`${LOG} ❌ salvarCadastro falhou:`, e?.message || e);
      exibirAviso({ tipo: "erro", mensagem: "Falha ao salvar cadastro. Tente novamente." });
    }
  });
});

// Debug inicial
console.log(`${LOG} window.api:`, window.api);
console.log(`${LOG} window.api.ouvirTermoAceito:`, window.api?.ouvirTermoAceito);
