// index.js
import { incluir } from "./incluirComponentes.js";

// Incluir os componentes dos cartões
incluir("cartao-dirigente-container", "componentes/cartaoDirigente.html");
incluir("cartao2-container", "componentes/cartaoYoutubeRevista.html");
incluir("cartao-randomico-container", "componentes/cartaoRandomico.html");

// Caminho do usuario.json (ajustado para ambiente Electron)
const fs = window.nativo.fs;
const path = window.nativo.path;
const os = window.nativo.os;
const descriptografar = window.nativo.descriptografarComMestra;

const usuarioPath = path.join(
  os.homedir(),
  ".config",
  "escola-aprendizes",
  "config",
  "usuario.json"
);


let codigoTemas = "";

try {
  const raw = fs.readFileSync(usuarioPath, "utf-8");
  const dados = JSON.parse(raw);
  const usuario = dados.usuarios?.[0];

  if (usuario && usuario.conteudoCriptografado) {
    const json = descriptografar(usuario.conteudoCriptografado);
    const info = JSON.parse(json);
    codigoTemas = info.codigoTemas || "";
    console.log("📌 codigoTemas carregado:", codigoTemas);
  }
} catch (erro) {
  console.error("❌ Erro ao carregar codigoTemas via descriptografia:", erro);
}

// Google Sheets - utilitário
function buscarPlanilha(aba) {
  const url = `https://docs.google.com/spreadsheets/d/${codigoTemas}/gviz/tq?sheet=${aba}`;
  return fetch(url)
    .then(res => res.text())
    .then(texto => {
      const json = JSON.parse(texto.replace(/.*google\.visualization\.Query\.setResponse\(/s, "").slice(0, -2));
      return json.table.rows.map(row => row.c[1]?.v);
    });
}

// Cartão 1 - Mensagem do Dirigente (pega a última)
buscarPlanilha("MDirigente")
  .then(mensagens => {
    const ultima = mensagens?.[mensagens.length - 1];
    document.getElementById("mensagem-dirigente").innerText = ultima || "Nenhuma mensagem encontrada.";
  })
  .catch(err => console.error("❌ Erro ao buscar MDirigente:", err));

// Cartão 3 - Mensagem Aleatória
buscarPlanilha("MRandomica")
  .then(mensagens => {
    const aleatoria = mensagens[Math.floor(Math.random() * mensagens.length)];
    document.getElementById("mensagem-randomica").innerText = aleatoria || "Sem mensagens.";
  })
  .catch(err => console.error("❌ Erro ao buscar MRandomica:", err));

// Cartão 2 - YouTube e Revista
const API_KEY = "AIzaSyBTVmAPRawYx35cbiiqff32jtie06fWjy4";
const CHANNEL_ID = "UCNvAIY83zX7c6j7bWAv7yAQ";

fetch(`https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${CHANNEL_ID}&order=date&part=snippet&type=video&maxResults=1`)
  .then(res => res.json())
  .then(data => {
    const videoId = data.items?.[0]?.id?.videoId;
    if (videoId) {
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.youtube.com/embed/${videoId}`;
      iframe.width = "100%";
      iframe.height = "315";
      iframe.frameBorder = "0";
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      iframe.allowFullscreen = true;
      document.getElementById("cartao-youtube").appendChild(iframe);
    }
  })
  .catch(err => console.error("❌ Erro ao carregar vídeo do YouTube:", err));

// Capa da revista mais recente
(async () => {
  const baseUrl = "https://alianca.org.br/site/wp-content/uploads/arquivosotrevo/";
  let num = 531; // começa no mais recente conhecido
  let ultimoValido = null;

  while (true) {
    const url = `${baseUrl}${num}-Trevo-Mar-Abr.pdf`;
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) {
        ultimoValido = url;
        num++;
      } else {
        break;
      }
    } catch (e) {
      break;
    }
  }

  if (ultimoValido) {
    const capa = ultimoValido.replace(".pdf", ".jpg");
    document.getElementById("capa-revista").innerHTML = `
      <a href="${ultimoValido}" target="_blank">
        <img src="${capa}" alt="Capa da Revista O Trevo" style="width:100%; border-radius:8px; box-shadow: 0 2px 6px rgba(0,0,0,0.2);"/>
      </a>`;
  }
})();

document.addEventListener("DOMContentLoaded", () => {
  incluir("cabecalho", "componentes/cabecalho.html");
  incluir("rodape", "componentes/rodape.html");
  // ...
});
