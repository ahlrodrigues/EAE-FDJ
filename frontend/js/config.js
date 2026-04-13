// =============================================================================
// Caminho: /frontend/js/config.js
// Telas:
//  - `frontend/cadastro2.html` (edição simples do cadastro)
//  - `frontend/config.html`    (edição + inclui `codigoTemas`)
//
// Objetivos (novo modelo):
//  - Ler o usuário logado via `window.usuarioAPI.lerAtual()` (retorna JSON cifrado)
//  - Descriptografar campos sensíveis via `window.api.descriptografarComMestra(...)`
//  - Salvar alterações via `window.api.salvarUsuario(patch)` (main criptografa e persiste)
//  - Normalizar idioma (BCP47) e atualizar bandeira quando existir
// Logs: ⚙️[CONFIG-UI]
// =============================================================================

import { exibirAviso } from "./modalAviso.js";
import { componentesCarregados } from "./incluirComponentes.js";

const LOG = "⚙️[CONFIG-UI]";
const qs  = (s) => document.querySelector(s);

function env(key) {
  try { return window.nativo?.getEnv?.(key); } catch { return null; }
}
function envFlag(key) {
  const v = String(env(key) || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function normalizeLang(v) {
  const map = { pt: "pt-BR", "pt-br": "pt-BR", en: "en-US", fr: "fr-FR", de: "de-DE", it: "it-IT" };
  const raw = String(v || "").trim();
  if (!raw) return "pt-BR";
  const key = raw.replace("_", "-").toLowerCase();
  return map[key] || raw || "pt-BR";
}
function toShortLang(v) {
  const s = String(v || "").toLowerCase();
  if (s.startsWith("pt")) return "pt";
  if (s.startsWith("en")) return "en";
  if (s.startsWith("fr")) return "fr";
  if (s.startsWith("de")) return "de";
  if (s.startsWith("it")) return "it";
  return "pt";
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

async function decifrarTalvez(valor) {
  if (typeof valor !== "string" || !valor.trim()) return valor ?? "";
  if (!window.api?.descriptografarComMestra) return valor;
  try {
    return await window.api.descriptografarComMestra(valor);
  } catch {
    // pode ser plaintext (ou chave ausente) → mantém
    return valor;
  }
}

async function carregarUsuario() {
  try {
    const resp = await window.usuarioAPI?.lerAtual?.();
    if (!resp?.ok) throw new Error(resp?.erro || "Falha ao ler usuário da sessão.");
    const u = resp.dados || {};

    // Descriptografa e preenche os campos existentes na tela
    if (qs("#aluno"))          setValue("aluno",          await decifrarTalvez(u.aluno));
    if (qs("#casaEspírita"))   setValue("casaEspírita",   await decifrarTalvez(u.casaEspírita));
    if (qs("#numeroTurma"))    setValue("numeroTurma",    await decifrarTalvez(u.numeroTurma));
    if (qs("#dirigente"))      setValue("dirigente",      await decifrarTalvez(u.dirigente));
    if (qs("#emailDirigente")) setValue("emailDirigente", await decifrarTalvez(u.emailDirigente));
    if (qs("#secretarios"))    setValue("secretarios",    await decifrarTalvez(u.secretarios));
    if (qs("#telefone"))       setValue("telefone",       await decifrarTalvez(u.telefone));
    if (qs("#codigoTemas"))    setValue("codigoTemas",    await decifrarTalvez(u.codigoTemas));

    // E-mail (apenas leitura; troca por fluxo próprio)
    if (qs("#email")) {
      const emailClaro = await decifrarTalvez(u.emailCriptografado);
      setValue("email", emailClaro || "");
      const el = qs("#email");
      el.readOnly = true;
      el.title = "Para trocar o e-mail, use o fluxo de troca de e-mail.";
    }

    // Idioma + bandeira
    const idiomaEl   = qs("#idioma");
    const bandeiraEl = qs("#bandeiraIdioma");
    if (idiomaEl) {
      const stored = String(u.idioma || "pt-BR");
      // telas antigas usam pt/en/fr..., telas novas usam pt-BR/en-US...
      const wantsShort = Array.from(idiomaEl.options || []).some((o) => String(o.value || "").length === 2);
      const value = wantsShort ? toShortLang(stored) : normalizeLang(stored);
      idiomaEl.value = value;
      setFlagFromSelect(idiomaEl, bandeiraEl);
    }

    // Checkbox de aceite
    const chk = qs("#aceiteTermos");
    if (chk) chk.checked = !!u.aceiteTermos;

    // Perfis/roles (pode ter múltiplos)
    // Produção: roles são emitidas/assinadas pelo servidor (não editáveis no cliente).
    // DEV: ocultar UI por padrão; reativar com LOCAL_ALLOW_ROLE_EDIT=1
    const roles = Array.isArray(u.roles) ? u.roles : [];
    const has = (r) => roles.includes(r);
    if (qs("#perfilAluno")) qs("#perfilAluno").checked = has("aluno") || roles.length === 0;
    if (qs("#perfilDirigente")) qs("#perfilDirigente").checked = has("dirigente");
    if (qs("#perfilAnalista")) qs("#perfilAnalista").checked = has("analista");
    try {
      const rolesRow = qs("#rolesRow");
      if (rolesRow && !envFlag("LOCAL_ALLOW_ROLE_EDIT")) rolesRow.style.display = "none";
    } catch {}

    console.log(`${LOG} formulário populado a partir de lerUsuario().`);
  } catch (e) {
    console.error(`${LOG} ❌ falha ao carregar usuário:`, e?.message || e);
    exibirAviso({ tipo: "erro", mensagem: "Não foi possível carregar o cadastro." });
  }
}

async function salvarAlteracoes(e) {
  e?.preventDefault?.();

  const idiomaEl = qs("#idioma");
  const idiomaRaw = idiomaEl ? getValue("idioma") : "pt-BR";
  const payload = {};

  if (qs("#aluno"))          payload.aluno = getValue("aluno");
  if (qs("#casaEspírita"))   payload.casaEspírita = getValue("casaEspírita");
  if (qs("#numeroTurma"))    payload.numeroTurma = getValue("numeroTurma");
  if (qs("#dirigente"))      payload.dirigente = getValue("dirigente");
  if (qs("#emailDirigente")) payload.emailDirigente = getValue("emailDirigente");
  if (qs("#secretarios"))    payload.secretarios = getValue("secretarios");
  if (qs("#telefone"))       payload.telefone = getValue("telefone");
  if (qs("#codigoTemas"))    payload.codigoTemas = getValue("codigoTemas");

  payload.idioma = normalizeLang(idiomaRaw);
  if (qs("#aceiteTermos")) payload.aceiteTermos = !!qs("#aceiteTermos")?.checked;

  // Roles não são editáveis no cliente (server-issued roles).
  // DEV: permitir somente se habilitado por env.
  if (envFlag("LOCAL_ALLOW_ROLE_EDIT")) {
    const roles = [];
    if (qs("#perfilAluno")?.checked) roles.push("aluno");
    if (qs("#perfilDirigente")?.checked) roles.push("dirigente");
    if (qs("#perfilAnalista")?.checked) roles.push("analista");
    payload.roles = roles.length ? Array.from(new Set(roles)) : ["aluno"];
  }

  if (qs("#aluno") && !payload.aluno) return exibirAviso({ tipo: "erro", mensagem: "Informe o nome do aluno." });
  if (qs("#emailDirigente") && !payload.emailDirigente) return exibirAviso({ tipo: "erro", mensagem: "Informe o e-mail do dirigente." });
  if (qs("#codigoTemas") && !payload.codigoTemas) {
    return exibirAviso({ tipo: "erro", mensagem: "Informe o código de integração (planilha) para Temas/Mensagens." });
  }

  try {
    const res = await window.api?.salvarUsuario?.(payload);
    if (res?.ok || res?.sucesso) {
      console.log(`${LOG} ✔ salvo com sucesso`);
      exibirAviso({ tipo: "sucesso", mensagem: "Cadastro atualizado com sucesso!" });
    } else {
      throw new Error(res?.erro || res?.error || "Falha ao salvar.");
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

  // compat: duas telas usam IDs diferentes
  qs("#formConfig")?.addEventListener("submit", salvarAlteracoes);
  qs("#configForm")?.addEventListener("submit", salvarAlteracoes);

  await carregarUsuario();
});
