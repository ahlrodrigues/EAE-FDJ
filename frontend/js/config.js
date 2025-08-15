// === frontend/js/config.js ===
// Cadastro/Edição com validação visual campo a campo
// - Mensagem de erro ACIMA do campo
// - Borda vermelha no campo inválido
// - Some ao corrigir (input/change)
// - Botão "Salvar Alterações" desativado enquanto houver erro
//
// Mantém card de Backup fora do form (tratado por backupConfig.js)

import { exibirAviso } from "./modalAviso.js";
import { componentesCarregados } from "./incluirComponentes.js";

const log  = (...a) => console.log("⚙️[config]", ...a);
const warn = (...a) => console.warn("⚠️[config]", ...a);
const err  = (...a) => console.error("❌[config]", ...a);

const $ = (id) => document.getElementById(id);

// Campos e rótulos (para mensagens)
const FIELDS = [
  { id: "casaEspírita",  label: "Nome da casa espírita", required: true },
  { id: "numeroTurma",   label: "Número da turma",       required: true, type: "number", min: 1 },
  { id: "dirigente",     label: "Nome do dirigente",     required: true },
  { id: "emailDirigente",label: "E-mail do dirigente",   required: true, type: "email" },
  { id: "secretarios",   label: "Nomes dos secretários", required: true },
  { id: "aluno",         label: "Nome do aluno",         required: true },
  { id: "email",         label: "E-mail do aluno",       required: true, type: "email" },
  { id: "telefone",      label: "Telefone",              required: true, type: "tel" },
  { id: "codigoTemas",   label: "Código da planilha",    required: true },
];

// Mapeamento de campos criptografados no JSON
const CAMPOS_CRIPT = [
  { json: "casaEspírita",       id: "casaEspírita" },
  { json: "numeroTurma",        id: "numeroTurma" },
  { json: "dirigente",          id: "dirigente" },
  { json: "emailDirigente",     id: "emailDirigente" },
  { json: "secretarios",        id: "secretarios" },
  { json: "aluno",              id: "aluno" },
  { json: "emailCriptografado", id: "email" },
  { json: "telefone",           id: "telefone" },
  { json: "codigoTemas",        id: "codigoTemas" },
];

// ===== Validação visual =====
function ensureErrorNode(inputEl) {
  // Cria (uma vez) um elemento de erro imediatamente ACIMA do input
  const key = `erro-for-${inputEl.id}`;
  let node = document.getElementById(key);
  if (!node) {
    node = document.createElement("div");
    node.id = key;
    node.className = "erro-campo";     // estilizado no CSS
    node.style.display = "none";       // oculto por padrão
    // Inserir antes do input
    inputEl.parentElement.insertBefore(node, inputEl);
  }
  return node;
}

function setFieldError(id, msg) {
  const el = $(id);
  if (!el) return;
  const box = ensureErrorNode(el);
  box.textContent = msg;
  box.style.display = "block";
  el.classList.add("invalido");
  el.setAttribute("aria-invalid", "true");
  log(`❗ Campo inválido: #${id} -> ${msg}`);
}

function clearFieldError(id) {
  const el = $(id);
  if (!el) return;
  const box = document.getElementById(`erro-for-${id}`);
  if (box) {
    box.textContent = "";
    box.style.display = "none";
  }
  el.classList.remove("invalido");
  el.removeAttribute("aria-invalid");
}

function validateEmail(value) {
  // Regex simples e eficiente p/ emails comuns
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}
function validateTelBR(value) {
  // Aceita formatos como +55 11 91234-5678, com alguma tolerância de espaços/hífens
  return /^\+\d{2}\s?\d{2}\s?\d{4,5}-?\d{4}$/.test(String(value).trim());
}

function validateOne(field) {
  const el = $(field.id);
  if (!el) {
    warn(`Campo #${field.id} não encontrado para validação.`);
    return true; // não bloqueia
  }
  const val = String(el.value || "").trim();

  // Obrigatoriedade
  if (field.required && !val) {
    setFieldError(field.id, `Preencha o campo: ${field.label}`);
    return false;
  }

  // Regras específicas
  if (field.type === "number") {
    const n = Number(val);
    if (Number.isNaN(n) || (field.min != null && n < field.min)) {
      setFieldError(field.id, `${field.label} deve ser um número válido (mínimo ${field.min || 0}).`);
      return false;
    }
  }
  if (field.type === "email" && val && !validateEmail(val)) {
    setFieldError(field.id, `Informe um ${field.label.toLowerCase()} válido.`);
    return false;
  }
  if (field.type === "tel" && val && !validateTelBR(val)) {
    setFieldError(field.id, `Informe o telefone no formato +55 11 912345678.`);
    return false;
  }

  // Sem erros
  clearFieldError(field.id);
  return true;
}

function validateAll() {
  let ok = true;
  for (const f of FIELDS) {
    if (!validateOne(f)) ok = false;
  }
  // Desativar o botão Salvar enquanto houver erros
  const btn = document.getElementById("btn-acao");
  if (btn) btn.disabled = !ok;
  return ok;
}

// ===== Fluxo principal =====
document.addEventListener("DOMContentLoaded", async () => {
  try { await componentesCarregados; } catch (e) { /* segue */ }

  log("Página de configuração carregada.");
  const form = $("configForm");
  if (!form) { err("Formulário #configForm não encontrado."); return; }

  // Preferir APIs via window.api (IPC)
  const descriptografar = window.api?.descriptografarComMestra || window.nativo?.descriptografarComMestra;
  const criptografar    = window.api?.criptografarComMestra    || window.nativo?.criptografarComMestra;
  if (!descriptografar || !criptografar) {
    err("APIs de criptografia indisponíveis.");
    exibirAviso({ tipo: "erro", mensagem: "API de criptografia indisponível. Verifique o preload." });
    return;
  }

  // Ler usuario.json
  let dados = {};
  try {
    if (!window.api?.lerUsuario) throw new Error("window.api.lerUsuario não exposto.");
    dados = await window.api.lerUsuario();
    log("usuario.json lido.");
  } catch (e) {
    err("Erro ao ler usuario.json:", e?.message || e);
    exibirAviso({ tipo: "erro", mensagem: "Erro ao carregar os dados do usuário." });
    return;
  }

  // Selecionar registro por emailHash atual ou primeiro
  let emailHashAtual = null;
  try { emailHashAtual = window.api?.obterEmailHash?.() || null; } catch {}
  const usuarios = dados?.usuarios || {};
  const chaves = Object.keys(usuarios);
  let usuario = (emailHashAtual && usuarios[emailHashAtual]) ? usuarios[emailHashAtual] : usuarios[chaves[0]];

  // Preencher campos criptografados
  const preencherCampo = async (id, valorCriptografado) => {
    try {
      const el = $(id);
      if (!el || !valorCriptografado) return;
      el.value = await descriptografar(valorCriptografado);
      log(`🔓 Campo '${id}' preenchido.`);
    } catch (e) {
      warn(`Erro ao descriptografar '${id}':`, e?.message || e);
    }
  };
  if (usuario) {
    for (const { json, id } of CAMPOS_CRIPT) {
      await preencherCampo(id, usuario[json]);
    }
    // Idioma (aberto)
    const idiomaEl = $("idioma");
    if (idiomaEl && usuario.idioma) {
      idiomaEl.value = usuario.idioma;
      log("🌐 Idioma preenchido.");
    }
  }

  // Liga validação por campo (corrige erro ao digitar)
  for (const f of FIELDS) {
    const el = $(f.id);
    if (!el) continue;
    // cria o placeholder do erro acima do campo (evita "pular" ao primeiro erro)
    ensureErrorNode(el);

    const handler = () => {
      validateOne(f);
      // também revalida geral para refletir no botão
      const btn = document.getElementById("btn-acao");
      if (btn) btn.disabled = !validateAll();
    };
    el.addEventListener("input", handler);
    el.addEventListener("change", handler);
    el.addEventListener("blur", handler);
  }

  // Validação inicial (após preencher)
  validateAll();

  // Salvamento
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Checagem final
    const ok = validateAll();
    if (!ok) {
      // foca no primeiro inválido
      const firstInvalid = FIELDS.map(f => $(f.id)).find(el => el?.classList.contains("invalido"));
      if (firstInvalid) firstInvalid.focus();
      exibirAviso({ tipo: "erro", mensagem: "Corrija os campos destacados antes de salvar." });
      return;
    }

    try {
      const emailHash = window.api?.obterEmailHash?.();
      if (!emailHash) {
        err("emailHash ausente. Abortando.");
        exibirAviso({ tipo: "erro", mensagem: "Erro ao salvar: usuário não identificado." });
        return;
      }

      dados.usuarios = dados.usuarios || {};
      const atual = dados.usuarios[emailHash] || {};

      // Atualiza campos criptografados
      for (const { json, id } of CAMPOS_CRIPT) {
        const el = $(id);
        if (!el) { warn(`Campo #${id} não encontrado no submit.`); continue; }
        atual[json] = await criptografar(String(el.value || "").trim());
      }

      // Idioma (aberto)
      const idiomaEl = $("idioma");
      atual.idioma = idiomaEl?.value || "pt";

      dados.usuarios[emailHash] = { ...dados.usuarios[emailHash], ...atual };

      if (!window.api?.salvarUsuario) throw new Error("window.api.salvarUsuario não exposto.");
      await window.api.salvarUsuario(dados);

      log("✅ Configurações salvas.");
      exibirAviso({ tipo: "sucesso", mensagem: "Configurações atualizadas com sucesso!" });

    } catch (e2) {
      err("Erro ao salvar:", e2?.message || e2);
      exibirAviso({ tipo: "erro", mensagem: "Erro ao salvar as configurações." });
    }
  });
});
