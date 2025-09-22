// =============================================================================
// Caminho: /frontend/js/config.js
// Tela: EDIÇÃO de cadastro (cadastro2.html)
// Objetivos:
//  - Carregar dados do usuário logado de ~/.config/escola-aprendizes/config/usuarios/<emailHash>.json
//    via window.api.lerUsuario() e preencher o formulário.
//  - Salvar alterações com window.api.salvarUsuario(payload).
//  - Sem "codigoTemas" e sem "roles".
//  - Normalizar idioma (BCP47) e atualizar bandeira.
//  - Preencher e respeitar o checkbox #aceiteTermos.
// Logs: ⚙️[CONFIG-UI]
// =============================================================================

import { exibirAviso } from "./modalAviso.js";
import { componentesCarregados } from "./incluirComponentes.js";

const LOG = "⚙️[CONFIG-UI]";
const qs  = (s) => document.querySelector(s);

function normalizeLang(v) {
  const map = { pt: "pt-BR", en: "en-US", fr: "fr-FR", de: "de-DE", it: "it-IT" };
  return map[v] || v || "pt-BR";
}
function setFlagFromSelect(selectEl, imgEl) {
  if (!selectEl || !imgEl) return;
  const flag = selectEl.selectedOptions?.[0]?.dataset?.flag || "br";
  imgEl.src = `https://flagcdn.com/24x18/${flag}.png`;
}

function setValue(id, value) {
  const el = qs("#" + id);
  if (el) el.value = value ?? "";
}
function getValue(id) {
  const el = qs("#" + id);
  return el ? String(el.value || "").trim() : "";
}

async function carregarUsuario() {
  try {
    const dados = await window.api?.lerUsuario?.();
    if (!dados || typeof dados !== "object") {
      console.warn(`${LOG} dados de usuário ausentes/inválidos.`);
      return;
    }

    // Preenche campos de texto direto
    setValue("aluno",          dados.aluno);
    setValue("casaEspírita",   dados.casaEspírita);
    setValue("numeroTurma",    dados.numeroTurma);
    setValue("dirigente",      dados.dirigente);
    setValue("emailDirigente", dados.emailDirigente);
    setValue("secretarios",    dados.secretarios);
    setValue("telefone",       dados.telefone);

    // Idioma + bandeira
    const idiomaEl   = qs("#idioma");
    const bandeiraEl = qs("#bandeiraIdioma");
    if (idiomaEl) {
      const lang = normalizeLang(dados.idioma);
      idiomaEl.value = lang;
      setFlagFromSelect(idiomaEl, bandeiraEl);
    }

    // Checkbox de aceite
    const chk = qs("#aceiteTermos");
    if (chk) chk.checked = !!dados.aceiteTermos;

    console.log(`${LOG} formulário populado a partir de lerUsuario().`);
  } catch (e) {
    console.error(`${LOG} ❌ falha ao carregar usuário:`, e?.message || e);
    exibirAviso({ tipo: "erro", mensagem: "Não foi possível carregar o cadastro." });
  }
}

async function salvarAlteracoes(e) {
  e?.preventDefault?.();

  const payload = {
    aluno:          getValue("aluno"),
    casaEspírita:   getValue("casaEspírita"),
    numeroTurma:    getValue("numeroTurma"),
    dirigente:      getValue("dirigente"),
    emailDirigente: getValue("emailDirigente"),
    secretarios:    getValue("secretarios"),
    telefone:       getValue("telefone"),
    idioma:         normalizeLang(getValue("idioma")),
    aceiteTermos:   !!qs("#aceiteTermos")?.checked,
  };

  if (!payload.aluno)          return exibirAviso({ tipo: "erro", mensagem: "Informe o nome do aluno." });
  if (!payload.emailDirigente) return exibirAviso({ tipo: "erro", mensagem: "Informe o e-mail do dirigente." });

  try {
    const res = await window.api?.salvarUsuario?.(payload);
    if (res?.sucesso) {
      console.log(`${LOG} ✔ salvo com sucesso`);
      exibirAviso({ tipo: "sucesso", mensagem: "Cadastro atualizado com sucesso!" });
    } else {
      throw new Error(res?.erro || "Falha ao salvar.");
    }
  } catch (e) {
    console.error(`${LOG} ❌ salvarUsuario:`, e?.message || e);
    exibirAviso({ tipo: "erro", mensagem: e?.message || "Erro ao salvar cadastro." });
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log(`${LOG} inicializando…`);
  await componentesCarregados;

  const idiomaEl   = qs("#idioma");
  const bandeiraEl = qs("#bandeiraIdioma");
  idiomaEl?.addEventListener("change", () => setFlagFromSelect(idiomaEl, bandeiraEl));

  qs("#formConfig")?.addEventListener("submit", salvarAlteracoes);

  await carregarUsuario();
});
