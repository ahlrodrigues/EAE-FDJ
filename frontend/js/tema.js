// === /frontend/scripts/tema.js ===
//
// Responsável por:
// 1) Carregar os temas da planilha (<= hoje) e montar a lista/cartões.
// 2) Detectar quais temas já foram salvos localmente (criptografados).
// 3) Abrir o modal ao clicar em "Ver/Escrever", carregando (descriptografado) se existir.
// 4) Salvar o tema (criptografado) ao enviar o formulário.
// 5) (Novo) Focar automaticamente o campo de texto ao abrir o modal.
//
// Compatibilidade com IPCs (preload/main):
// - "listar-temas-salvos": pode retornar (A) array simples de nomes ou (B) objeto { ok, dir, itens:[{nome,caminho,...}] }
// - "ler-tema": uso preferencial com caminho absoluto; compat: (emailHash, nomeArquivo)
// - "salvar-tema": (emailHash, nomeArquivo, { data, numero, titulo, texto })
//
// Logs padronizados e sem vazar conteúdo sensível (apenas tamanhos e metadados).

import { exibirAviso } from "./modalAviso.js";
import { buscarTemasFormatados } from "./buscarPlanilha.js";

// ⚠️ Seletores: garantimos existência após DOMContentLoaded.
const containerTemas = document.querySelector("#tabelaTemas");
const modal = document.querySelector("#modalTema");
const form = document.querySelector("#formTema");
const aviso = document.getElementById("aviso-tema");
const tituloTemaDia = document.querySelector("#titulo-tema-dia");

// ===== Utils de Modal =====
function abrirModal() {
  if (!modal) return;
  modal.classList.add("ativo");
  modal.style.display = "block";
}

function fecharModal() {
  if (!modal) return;
  modal.classList.remove("ativo");
  modal.style.display = "none";
}

/**
 * Foca o campo de texto do modal com garantias (pós-render e com fallback para transições).
 * - Posiciona o cursor no final do texto.
 * - Evita scroll indesejado.
 */
function focarNoCampoTextoModal() {
  const textarea = document.querySelector("#modalTexto");
  if (!textarea) {
    console.warn("⚠️ [RENDERER] #modalTexto não encontrado para foco.");
    return;
  }

  // Tenta focar imediatamente
  textarea.focus({ preventScroll: true });

  // Garante foco após a próxima pintura (quando display:none -> block)
  requestAnimationFrame(() => {
    textarea.focus({ preventScroll: true });

    // Posiciona o cursor no final (caso haja texto existente)
    try {
      const len = textarea.value?.length || 0;
      textarea.setSelectionRange(len, len);
    } catch (_) {
      // Alguns navegadores podem não permitir antes do foco final
    }

    // Fallback adicional se houver transições CSS
    setTimeout(() => {
      if (document.activeElement !== textarea) {
        textarea.focus({ preventScroll: true });
      }
      console.log("🖱️ [RENDERER] Foco aplicado no #modalTexto.");
    }, 50);
  });
}

// ===== Normalização de retornos =====
function normalizarListaTemasSalvos(ret) {
  // Caso A: array simples de nomes
  if (Array.isArray(ret)) {
    return {
      ok: true,
      dir: null,
      itens: ret.map((nome) => ({ nome, caminho: null })),
    };
  }
  // Caso B: objeto {ok, dir, itens: [...]}
  if (ret && typeof ret === "object") {
    const ok = ret.ok !== false;
    const dir = ret.dir || null;
    const itens = Array.isArray(ret.itens)
      ? ret.itens.map((i) => ({
          nome: i?.nome,
          caminho: i?.caminho || null,
          tamanho: i?.tamanho,
          mtime: i?.mtime,
          ctime: i?.ctime,
        }))
      : [];
    return { ok, dir, itens };
  }
  // Fallback vazio
  return { ok: false, dir: null, itens: [] };
}

// ===== Helpers de nome/caminho =====
function montarNomeArquivo(dataISO, numero, emailHash) {
  // dataISO: YYYY-MM-DD
  return `${dataISO}-tema${numero}-${emailHash}.txt`;
}

// ===== Compat de leitura de tema =====
async function lerTemaCompat({ emailHash, nomeArquivo, caminhoAbsolutoPreferencial }) {
  // Preferir caminho absoluto (fluxo novo com handler 'ler-tema' no main)
  if (caminhoAbsolutoPreferencial && window.api?.lerTema) {
    console.log("🛰️ [RENDERER][lerTemaCompat] Lendo por caminho absoluto:", caminhoAbsolutoPreferencial);
    const resp = await window.api.lerTema(caminhoAbsolutoPreferencial);
    return resp;
  }
  // Compat: API antiga que aceita (emailHash, nomeArquivo)
  if (window.api?.lerTema && window.api.lerTema.length >= 2) {
    console.log("🛰️ [RENDERER][lerTemaCompat] Lendo por (emailHash,nomeArquivo):", { emailHash, nomeArquivo });
    const resp = await window.api.lerTema(emailHash, nomeArquivo);
    return resp;
  }
  // Fallback: resolver caminho local via obterDiretorioTemas
  const baseDir = window.api?.obterDiretorioTemas ? await window.api.obterDiretorioTemas(emailHash) : null;
  const caminhoFallback = baseDir
    ? `${baseDir}/${nomeArquivo}`
    : `${(window.api?.homeDir || "")}/.config/escola-aprendizes/temas/${emailHash}/${nomeArquivo}`;

  console.log("🛰️ [RENDERER][lerTemaCompat] Fallback caminho:", caminhoFallback);
  if (!window.api?.lerTema) {
    throw new Error("API window.api.lerTema indisponível.");
  }
  const resp = await window.api.lerTema(caminhoFallback);
  return resp;
}

// ===== Carregamento inicial =====
document.addEventListener("DOMContentLoaded", async () => {
  try {
    if (!containerTemas) {
      console.error("❌ [RENDERER] #tabelaTemas não encontrado no DOM.");
      return;
    }

    // 1) Usuário + codigoTemas (descriptografado)
    const usuario = await window.api.lerUsuario();
    const dadosUsuario = Object.values(usuario?.usuarios || {})[0];
    const criptCodigoTemas = dadosUsuario?.codigoTemas;
    const codigoTemas = await window.api.descriptografarComMestra(criptCodigoTemas);

    if (!codigoTemas) throw new Error("Código da planilha (codigoTemas) não encontrado.");

    const emailHash = window.api.obterEmailHash();
    if (!emailHash) throw new Error("emailHash não disponível.");

    // 2) Temas salvos (normalizado)
    const listaBruta = await window.api.listarTemasSalvos(emailHash);
    const salvos = normalizarListaTemasSalvos(listaBruta);
    console.log("📁 [RENDERER] Temas salvos (normalizado):", salvos);

    // 3) Temas da planilha (<= hoje)
    const temas = await buscarTemasFormatados(codigoTemas);
    console.log("📋 [RENDERER] Temas vindos da planilha:", temas);

    let temaEmAberto = false;
    const hoje = new Date();
    let primeiroTemaHoje = true;

    // Map rápido: nome → {caminho}
    const mapaSalvos = new Map(
      salvos.itens.map((i) => [i.nome, { caminho: i.caminho || null }])
    );

    temas.forEach(({ data, numero, titulo }) => {
      if (!data || !numero || !titulo) return;

      // data: "Date(Y,M,D)" (M zero-based)
      const match = String(data).match(/Date\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (!match) return;

      const ano = parseInt(match[1], 10);
      const mes0 = parseInt(match[2], 10);
      const dia = parseInt(match[3], 10);

      const dataTema = new Date(ano, mes0, dia);
      if (dataTema > hoje) return;

      const mes = String(mes0 + 1).padStart(2, "0");
      const dia2 = String(dia).padStart(2, "0");
      const dataISO = `${ano}-${mes}-${dia2}`;
      const dataFormatada = `${dia2}/${mes}/${ano}`;

      const nomeArquivoEsperado = montarNomeArquivo(dataISO, numero, emailHash);
      const salvo = mapaSalvos.has(nomeArquivoEsperado);
      const caminhoAbsoluto = salvo ? (mapaSalvos.get(nomeArquivoEsperado)?.caminho || "") : "";

      const card = document.createElement("div");
      card.className = "cartao-tema";
      if (!salvo) card.classList.add("tema-pendente"); else card.classList.add("tema-preenchido");

      const textoBotao = salvo ? "👁️ Ver" : "✍️ Escrever";

      card.innerHTML = `
        <p><strong>📅 ${dataFormatada}</strong></p>
        <p>📚 ${numero} - ${titulo}</p>
        <div class="espaco-botao">
          <button 
            class="btn-ver" 
            data-data="${dataISO}" 
            data-numero="${numero}" 
            data-titulo="${titulo}"
            data-arquivo="${nomeArquivoEsperado}"
            ${caminhoAbsoluto ? `data-caminho="${caminhoAbsoluto}"` : ""}
          >
            ${textoBotao}
          </button>
        </div>
      `;
      containerTemas.appendChild(card);

      if (!salvo) temaEmAberto = true;

      // Tema do dia
      if (primeiroTemaHoje && dataTema.toDateString() === hoje.toDateString() && tituloTemaDia) {
        tituloTemaDia.textContent = `Tema do dia: ${titulo}`;
        primeiroTemaHoje = false;
      }
    });

    if (temaEmAberto && aviso) aviso.style.display = "block";
    console.log("✅ [RENDERER] Renderização dos cartões concluída.");
  } catch (erro) {
    console.error("❌ [RENDERER] Erro ao carregar temas:", erro);
    exibirAviso?.({ tipo: "erro", mensagem: "Erro ao carregar os temas. Verifique os logs." });
  }
});

// ===== Clique "Ver/Escrever" =====
window.addEventListener("click", async (e) => {
  const btn = e.target.closest(".btn-ver");
  if (!btn) return;

  try {
    const inputData = document.querySelector("#modalData");
    const spanNumero = document.querySelector("#modalNumero");
    const hiddenTitulo = document.querySelector("#modalTituloHidden");
    const spanTitulo = document.querySelector("#modalTitulo");
    const textarea = document.querySelector("#modalTexto");

    if (!inputData || !spanNumero || !hiddenTitulo || !spanTitulo || !textarea) {
      console.error("❌ [RENDERER] Estrutura do modal não encontrada.");
      exibirAviso?.({ tipo: "erro", mensagem: "Estrutura do modal não encontrada." });
      return;
    }

    const { data, numero, titulo, arquivo, caminho } = btn.dataset;

    inputData.value = data || "";
    spanNumero.textContent = `${numero || ""}`;
    hiddenTitulo.value = titulo || "";
    spanTitulo.textContent = titulo || "";

    // Tenta ler conteúdo existente
    let conteudoTexto = "";
    try {
      const emailHash = window.api.obterEmailHash();
      const nomeArquivo = arquivo || montarNomeArquivo(data, numero, emailHash);
      const caminhoAbs = caminho || null;

      console.log("🔎 [RENDERER] Tentando ler tema:", { nomeArquivo, caminhoAbs: !!caminhoAbs });
      const resp = await lerTemaCompat({
        emailHash,
        nomeArquivo,
        caminhoAbsolutoPreferencial: caminhoAbs,
      });

      if (resp?.ok) {
        if (resp.tipo === "json" && resp.dados) {
          conteudoTexto = String(resp.dados.texto || "");
        } else if (resp.tipo === "texto" && typeof resp.dados === "string") {
          conteudoTexto = resp.dados;
        } else if (typeof resp?.texto === "string") {
          conteudoTexto = resp.texto; // compat legado
        }
        console.log(`✏️ [RENDERER] Tema carregado. Tamanho: ${conteudoTexto.length}`);
      } else {
        console.warn("⚠️ [RENDERER] Tema não encontrado ou falha na leitura:", resp?.erro);
      }
    } catch (erro) {
      console.warn("⚠️ [RENDERER] Falha ao tentar ler tema existente:", erro.message);
    }

    // Preenche textarea e abre modal
    textarea.value = conteudoTexto || "";
    abrirModal();
    focarNoCampoTextoModal(); // 👈 NOVO: aplica foco automático no campo de texto
    console.log("🪟 [RENDERER] Modal aberto.");
  } catch (erro) {
    console.error("❌ [RENDERER] Erro ao preparar modal:", erro);
    exibirAviso?.({ tipo: "erro", mensagem: "Erro ao abrir o modal do tema." });
  }
});

// ===== Salvar tema =====
form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  try {
    const inputData = document.querySelector("#modalData");
    const spanNumero = document.querySelector("#modalNumero");
    const hiddenTitulo = document.querySelector("#modalTituloHidden");
    const textarea = document.querySelector("#modalTexto");

    if (!inputData || !spanNumero || !hiddenTitulo || !textarea) {
      console.error("❌ [RENDERER] Estrutura do modal não encontrada no submit.");
      exibirAviso?.({ tipo: "erro", mensagem: "Estrutura do modal não encontrada." });
      return;
    }

    const dataISO = inputData.value; // YYYY-MM-DD
    const numero = (spanNumero.textContent || "").trim();
    const titulo = hiddenTitulo.value || "";
    const texto = textarea.value || "";

    console.log("📝 [RENDERER] Salvando tema (metadados):", { dataISO, numero, titulo, tamanhoTexto: texto.length });

    if (!texto) {
      exibirAviso?.("Preencha o texto antes de salvar.");
      focarNoCampoTextoModal(); // reforça UX em caso de erro
      return;
    }

    const emailHash = window.api.obterEmailHash();
    const nomeArquivo = montarNomeArquivo(dataISO, numero, emailHash);

    const payload = { data: dataISO, numero, titulo, texto };
    const resp = await window.api.salvarTema(emailHash, nomeArquivo, payload);

    if (!resp?.ok) {
      throw new Error(resp?.erro || "Falha desconhecida ao salvar.");
    }

    exibirAviso?.("✅ Tema salvo com sucesso!");
    fecharModal();

    // Recarrega para atualizar o estado visual dos cartões
    location.reload();
  } catch (erro) {
    console.error("❌ [RENDERER] Erro ao salvar tema:", erro);
    exibirAviso?.("Erro ao salvar o tema. Tente novamente.");
  }
});

// ===== Fechar modal =====
document.addEventListener("DOMContentLoaded", () => {
  const btnFecharModal = document.querySelector("#btnFecharModal");
  if (btnFecharModal && modal) {
    btnFecharModal.addEventListener("click", () => {
      fecharModal();
      console.log("🧹 [RENDERER] Modal fechado pelo usuário.");
    });
  }
});


