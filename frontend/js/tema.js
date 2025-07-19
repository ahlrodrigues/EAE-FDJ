// === scripts/tema.js ===

import { exibirAviso } from "./modalAviso.js";
import { buscarTemasFormatados } from "./buscarPlanilha.js";

const containerTemas = document.querySelector("#tabelaTemas");
const modal = document.querySelector("#modalTema");
const form = document.querySelector("#formTema");
const aviso = document.getElementById("aviso-tema");
const tituloTemaDia = document.querySelector("#titulo-tema-dia");

// 🔄 Carrega temas com data menor ou igual à atual
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const usuario = await window.api.lerUsuario();
    const dados = Object.values(usuario.usuarios || {})[0];
    const criptografado = dados?.codigoTemas;
    const codigoTemas = await window.api.descriptografarComMestra(criptografado);
    if (!codigoTemas) throw new Error("Código da planilha não encontrado.");

    const emailHash = window.api.obterEmailHash();
    const arquivosSalvos = await window.api.listarTemasSalvos(emailHash);
    const temas = await buscarTemasFormatados(codigoTemas);
    console.log("📋 Temas carregados da planilha:", temas);
    console.log("📁 Arquivos já salvos:", arquivosSalvos);

    let temaEmAberto = false;
    const hoje = new Date();
    let primeiroTemaHoje = true;

    temas.forEach(({ data, numero, titulo }) => {
      if (!data || !numero || !titulo) return;

      const match = data.match(/Date\((\d+),(\d+),(\d+)\)/);
      if (!match) return;

      const [_, ano, mes, dia] = match;
      const dataTema = new Date(ano, mes, dia);
      if (dataTema > hoje) return;

      const nomeArquivoData = `${ano}-${String(Number(mes) + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      const dataFormatada = `${String(dia).padStart(2, '0')}/${String(Number(mes) + 1).padStart(2, '0')}/${ano}`;
      const nomeArquivoEsperado = `${nomeArquivoData}-tema${numero}-${emailHash}.txt`;
      const preenchido = arquivosSalvos.includes(nomeArquivoEsperado);

      const card = document.createElement("div");
      card.className = "cartao-tema";
      if (!preenchido) card.classList.add("tema-pendente");

      const textoBotao = preenchido ? "👁️ Ver" : "✍️ Escrever";

card.innerHTML = `
  <p><strong>📅 ${dataFormatada}</strong></p>
  <p>📚 ${numero} - ${titulo}</p>
  <div class="espaco-botao">
    <button class="btn-ver" data-data="${nomeArquivoData}" data-numero="${numero}" data-titulo="${titulo}">
      ${textoBotao}
    </button>
  </div>
`;

      containerTemas.appendChild(card);

      if (!preenchido) temaEmAberto = true;
      else card.classList.add("tema-preenchido");

      if (primeiroTemaHoje && dataTema.toDateString() === hoje.toDateString() && tituloTemaDia) {
        tituloTemaDia.textContent = `Tema do dia: ${titulo}`;
        primeiroTemaHoje = false;
      }
    });

    if (temaEmAberto && aviso) aviso.style.display = "block";
  } catch (erro) {
    console.error("❌ Erro ao carregar temas:", erro);
  }
});

// 👁️ Ao clicar em "Ver", abre o modal
window.addEventListener("click", async (e) => {
  const btn = e.target.closest(".btn-ver");
  if (!btn) return;

  const { data, numero, titulo } = btn.dataset;

  document.querySelector("#modalData").value = data;
  document.querySelector("#modalNumero").textContent = `${numero}`;
  document.querySelector("#modalTituloHidden").value = titulo;
  document.querySelector("#modalTitulo").textContent = titulo;

  const emailHash = window.api.obterEmailHash();
  const nomeArquivo = `${data}-tema${numero}-${emailHash}.txt`;

  try {
    const conteudo = await window.api.lerTema(emailHash, nomeArquivo);
    document.querySelector("#modalTexto").value = conteudo?.texto || "";
    console.log("✏️ Tema carregado:", conteudo);
  } catch (erro) {
    document.querySelector("#modalTexto").value = "";
    console.warn("⚠️ Tema ainda não preenchido:", erro.message);
  }

  modal.style.display = "block";
});

// 💾 Salvar tema preenchido
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = document.querySelector("#modalData").value;
  const numero = document.querySelector("#modalNumero").textContent.replace("Tema ", "").trim();
  const titulo = document.querySelector("#modalTituloHidden").value;
  const texto = document.querySelector("#modalTexto").value;

  console.log("📝 Salvando tema:", { data, numero, titulo, texto });

  try {
    if (!texto) return exibirAviso("Preencha o texto antes de salvar.");

    const emailHash = window.api.obterEmailHash();
    const nomeArquivo = `${data}-tema${numero}-${emailHash}.txt`;

    await window.api.salvarTema(emailHash, nomeArquivo, { data, numero, titulo, texto });
    exibirAviso("✅ Tema salvo com sucesso!");
    modal.style.display = "none";
    location.reload();
  } catch (erro) {
    console.error("Erro ao salvar tema:", erro);
    exibirAviso("Erro ao salvar o tema. Tente novamente.");
  }
});

// 🟦 Botão "Fechar" do modal
const btnFecharModal = document.querySelector("#btnFecharModal");
if (btnFecharModal && modal) {
  btnFecharModal.addEventListener("click", () => {
    modal.style.display = "none";
  });
}
