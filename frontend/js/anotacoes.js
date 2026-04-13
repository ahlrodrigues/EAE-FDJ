// ============================================================================
// Caminho: frontend/js/anotacoes.js
// Objetivo: Salvar anotações (modo livre ou estruturado) com criptografia e logs
// Depende do preload: window.api.notas.salvar (ou window.api.salvarAnotacao),
//                     window.api.obterEmailHash() [Promise],
//                     window.api.usuarioPreferenciasGet / Set,
//                     window.api.obterNomeAlunoDescriptografado()
// Depende do renderer: exibirAviso (modal padrão), componentesCarregados
// Logs: 📝[RENDER][ANOTACOES]
// ============================================================================
import { exibirAviso } from "./modalAviso.js";
import { componentesCarregados } from "./incluirComponentes.js";

const LOG = "📝[RENDER][ANOTACOES]";

let emailHash = null;

document.addEventListener("DOMContentLoaded", async () => {
  console.debug(`${LOG} DOMContentLoaded`);

  try {
    await componentesCarregados;
    console.debug(`${LOG} componentesCarregados OK`);
  } catch (e) {
    console.warn(`${LOG} componentesCarregados não aguardou Promise`, e);
  }

  // 🔐 Sessão: obter emailHash de forma assíncrona
  try {
    emailHash = await window.api.obterEmailHash();
    console.debug(`${LOG} emailHash=`, emailHash);
  } catch (e) {
    console.error(`${LOG} Erro ao obter emailHash:`, e);
  }

  const form   = document.getElementById("formAnotacao");
  const dataEl = document.getElementById("data");
  const toggle = document.getElementById("modoToggle");
  const label  = document.getElementById("modoLabel");

  if (!form || !dataEl || !toggle || !label) {
    console.error(`${LOG} Estrutura inválida (#formAnotacao, #data, #modoToggle, #modoLabel)`);
    await avisoErro("Erro de estrutura: elementos do formulário não foram encontrados.");
    return;
  }

  // 📅 Preparar data de hoje
  const hojeISO = new Date().toISOString().split("T")[0];
  dataEl.value = hojeISO;

  if (localStorage.getItem("focarCampoData") === "sim") {
    dataEl.focus();
    localStorage.removeItem("focarCampoData");
  }

  // ⚙️ Preferência: modo (unico|separado) via IPC (por-usuário)
  const usarBloco = await carregarPreferenciaModo(emailHash);
  aplicarEstadoToggle(usarBloco, toggle, label);
  alternarFormulario(usarBloco);

  // 🖱️ Troca de modo
  toggle.addEventListener("change", async (e) => {
    const novoUsarBloco = !!e.target.checked;
    aplicarEstadoToggle(novoUsarBloco, toggle, label);
    alternarFormulario(novoUsarBloco);
    await salvarPreferenciaModo(emailHash, novoUsarBloco);
  });

  // 💾 Salvar
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const usarBlocoAtual = !!toggle.checked;

    const dados = coletarDados(usarBlocoAtual);
    if (!dados.ok) {
      console.warn(`${LOG} Validação falhou:`, dados.mensagem);
      await avisoErro(dados.mensagem || "Preencha os campos obrigatórios.");
      return;
    }

    let nome = await safeObterNomeAluno();
    if (!nome) nome = "usuario";

    const nomeArquivo = montarNomeArquivo(dados.dataISO, nome);
    const conteudo    = montarConteudo(dados, usarBlocoAtual);

    console.debug(`${LOG} Salvando anotação`, { nomeArquivo, bytes: conteudo?.length ?? 0 });

    try {
      // compat: se notas.salvar não existir, usa salvarAnotacao legado
      const resultado = (window.api?.notas?.salvar)
        ? await window.api.notas.salvar(conteudo, nomeArquivo)
        : await window.api.salvarAnotacao(conteudo, nomeArquivo);

      if (resultado?.sucesso) {
        await exibirAviso({ tipo: "✅ Sucesso", mensagem: "Anotação salva com sucesso." });
        limparCampos(usarBlocoAtual);
        localStorage.setItem("focarCampoData", "sim");
        dataEl.value = hojeISO;
        dataEl.focus();
        console.info(`${LOG} Anotação salva: ${nomeArquivo}`);
      } else {
        const msg = resultado?.erro || "Erro ao salvar anotação.";
        console.error(`${LOG} Erro de resposta do salvar:`, msg);
        await avisoErro(msg);
      }
    } catch (erro) {
      console.error(`${LOG} Exceção ao salvar:`, erro);
      await avisoErro("Erro ao salvar anotação.");
    }
  });

  // 🧪 Diagnóstico do modal
  await diagnosticarModal();
});

// ============================================================================
// Preferências por usuário (IPC)
// ============================================================================
async function carregarPreferenciaModo(emailHash) {
  try {
    if (window.api?.usuarioPreferenciasGet && emailHash) {
      const prefs = await window.api.usuarioPreferenciasGet(emailHash);
      const modo  = prefs?.modoPreenchimento || "separado";
      return modo === "unico";
    }
  } catch (e) {
    console.warn(`${LOG} usuarioPreferenciasGet falhou:`, e);
  }
  return false; // padrão: "separado"
}

async function salvarPreferenciaModo(emailHash, usarBloco) {
  try {
    if (window.api?.usuarioPreferenciasSet && emailHash) {
      const novoModo = usarBloco ? "unico" : "separado";
      await window.api.usuarioPreferenciasSet(emailHash, { modoPreenchimento: novoModo });
      console.debug(`${LOG} Preferência salva:`, novoModo);
    }
  } catch (e) {
    console.warn(`${LOG} usuarioPreferenciasSet falhou:`, e);
  }
}

// ============================================================================
// UI helpers
// ============================================================================
function aplicarEstadoToggle(usarBloco, toggle, label) {
  toggle.checked = !!usarBloco;
  label.textContent = usarBloco ? "Modo bloco de texto" : "Modo estruturado por campos";
  console.debug(`${LOG} Modo=`, usarBloco ? "unico" : "separado");
}

function alternarFormulario(usarTextoUnico) {
  const bloco     = document.getElementById("formularioLivre");
  const detalhado = document.getElementById("formularioDetalhado");
  if (!bloco || !detalhado) {
    console.warn(`${LOG} Estruturas dos formulários não encontradas (#formularioLivre / #formularioDetalhado).`);
    return;
  }
  bloco.style.display     = usarTextoUnico ? "block" : "none";
  detalhado.style.display = usarTextoUnico ? "none" : "block";

  const anotacaoLivre = document.getElementById("anotacaoLivre");
  const fato = document.getElementById("fato");
  const acao = document.getElementById("acao");
  const sentimento = document.getElementById("sentimento");
  const proposta = document.getElementById("proposta");

  if (anotacaoLivre) anotacaoLivre.required = !!usarTextoUnico;
  if (fato) fato.required = !usarTextoUnico;
  if (acao) acao.required = !usarTextoUnico;
  if (sentimento) sentimento.required = !usarTextoUnico;
  if (proposta) proposta.required = !usarTextoUnico;

  console.debug(`${LOG} Alternou formulário. usarTextoUnico=${usarTextoUnico}`);
}

function coletarDados(usarBloco) {
  const dataEl = document.getElementById("data");
  if (!dataEl?.value) return { ok: false, mensagem: "Selecione a data." };
  const dataISO = String(dataEl.value).trim();

  if (usarBloco) {
    const txt = document.getElementById("anotacaoLivre")?.value?.trim() ?? "";
    if (!txt) return { ok: false, mensagem: "Digite sua anotação no bloco de texto." };
    return { ok: true, dataISO, anotacaoLivre: txt };
  }

  const fato = document.getElementById("fato")?.value?.trim() ?? "";
  const acao = document.getElementById("acao")?.value?.trim() ?? "";
  const sentimento = document.getElementById("sentimento")?.value?.trim() ?? "";
  const proposta = document.getElementById("proposta")?.value?.trim() ?? "";
  if (!fato || !acao || !sentimento || !proposta) {
    return { ok: false, mensagem: "Preencha todos os campos (Fato, Ação/Reação, Sentimento, Proposta)." };
  }
  return { ok: true, dataISO, fato, acao, sentimento, proposta };
}

function montarNomeArquivo(dataISO, nome) {
  const agora = new Date();
  const hora = `${String(agora.getHours()).padStart(2, "0")}-${String(agora.getMinutes()).padStart(2, "0")}-${String(agora.getSeconds()).padStart(2, "0")}`;
  return `${dataISO}-${hora}_${nome}.txt`; // YYYY-MM-DD-HH-MM-SS_nome.txt
}

function montarConteudo(dados, usarBloco) {
  const [ano, mes, dia] = String(dados.dataISO).split("-");
  const dataFmt = `${dia}-${mes}-${ano}`;
  if (usarBloco) return `Data: ${dataFmt}\n\n${dados.anotacaoLivre}`;
  return `Data: ${dataFmt}\nFato: ${dados.fato}\nAção/Reação: ${dados.acao}\nSentimento: ${dados.sentimento}\nProposta Renovadora: ${dados.proposta}`;
}

function limparCampos(usarBloco) {
  if (usarBloco) {
    const el = document.getElementById("anotacaoLivre");
    if (el) el.value = "";
    return;
  }
  for (const id of ["fato", "acao", "sentimento", "proposta"]) {
    const el = document.getElementById(id);
    if (el) el.value = "";
  }
}

async function safeObterNomeAluno() {
  try {
    if (!window.api?.obterNomeAlunoDescriptografado) return null;
    const nome = await window.api.obterNomeAlunoDescriptografado();
    return (typeof nome === "string" && nome.trim()) ? nome.trim() : null;
  } catch {
    return null;
  }
}

async function avisoErro(msg) {
  try {
    await exibirAviso({ tipo: "erro", mensagem: msg });
  } catch {
    alert(msg || "Erro.");
  }
}

// ============================================================================
// Diagnóstico do modal
// ============================================================================
async function diagnosticarModal() {
  const container = document.getElementById("modalAvisoContainer");
  if (!container) {
    console.warn(`${LOG} #modalAvisoContainer não encontrado — modal não renderizará.`);
    return;
  }
  try {
    await exibirAviso({ tipo: "ℹ️ Aviso", mensagem: "Diagnóstico do modal OK.", autoFecharMs: 800 });
    console.debug(`${LOG} Modal diagnóstico exibido.`);
  } catch (e) {
    console.error(`${LOG} exibirAviso falhou:`, e);
  }
}
