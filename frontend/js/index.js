// index.js
import { componentesCarregados } from "./incluirComponentes.js";

// ⏳ Aguarde os componentes do layout serem carregados antes de iniciar o app
componentesCarregados.then(() => {
  console.log("📦 Componentes carregados. Iniciando aplicação...");

  // ⬇️ 1. Inclusão dos cartões dinâmicos
  incluirCartoes();

  // ⬇️ 2. Carregar código do usuário
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
      console.log("📌 codigoTemas carregado com sucesso:", codigoTemas);

      // ⬇️ 3. Buscar planilhas
      buscarMensagensDoDirigente(codigoTemas);
      buscarMensagemAleatoria(codigoTemas);
    } else {
      console.warn("⚠️ Nenhum usuário com conteúdo criptografado encontrado.");
    }
  } catch (erro) {
    console.error("❌ Erro ao carregar codigoTemas via descriptografia:", erro);
  }

  // ⬇️ 4. Buscar vídeo do YouTube
  carregarUltimoVideo();

  // ⬇️ 5. Buscar revista O Trevo
  buscarRevistaMaisRecente();
});

function incluirCartoes() {
  const incluir = async (id, caminho) => {
    const el = document.getElementById(id);
    if (el) {
      try {
        const resposta = await fetch(caminho);
        if (resposta.ok) {
          const html = await resposta.text();
          el.innerHTML = html;
          console.log(`✅ Cartão incluído: ${id}`);
        }
      } catch (erro) {
        console.error(`❌ Erro ao incluir cartão ${id}:`, erro);
      }
    }
  };

  incluir("cartao-dirigente-container", "componentes/cartaoDirigente.html");
  incluir("cartao2-container", "componentes/cartaoYoutubeRevista.html");
  incluir("cartao-randomico-container", "componentes/cartaoRandomico.html");
}

function buscarMensagensDoDirigente(codigoTemas) {
  buscarPlanilha(codigoTemas, "MDirigente")
    .then(mensagens => {
      const ultima = mensagens?.[mensagens.length - 1];
      document.getElementById("mensagem-dirigente").innerText = ultima || "Nenhuma mensagem encontrada.";
    })
    .catch(err => console.error("❌ Erro ao buscar MDirigente:", err));
}

function buscarMensagemAleatoria(codigoTemas) {
  buscarPlanilha(codigoTemas, "MRandomica")
    .then(mensagens => {
      const aleatoria = mensagens[Math.floor(Math.random() * mensagens.length)];
      document.getElementById("mensagem-randomica").innerText = aleatoria || "Sem mensagens.";
    })
    .catch(err => console.error("❌ Erro ao buscar MRandomica:", err));
}

function buscarPlanilha(codigoTemas, aba) {
  const url = `https://docs.google.com/spreadsheets/d/${codigoTemas}/gviz/tq?sheet=${aba}`;
  console.log(`🔍 Buscando dados da aba '${aba}'...`);

  return fetch(url)
    .then(res => res.text())
    .then(texto => {
      const json = JSON.parse(texto.replace(/.*google\.visualization\.Query\.setResponse\(/s, "").slice(0, -2));
      return json.table.rows.map(row => row.c[1]?.v);
    });
}

function carregarUltimoVideo() {
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
        console.log("✅ Último vídeo do canal embutido com sucesso.");
      } else {
        console.warn("⚠️ Nenhum vídeo encontrado no canal.");
      }
    })
    .catch(err => console.error("❌ Erro ao carregar vídeo do YouTube:", err));
}

async function buscarRevistaMaisRecente() {
  console.log("📰 Buscando última revista O Trevo disponível...");
  const baseUrl = "https://alianca.org.br/site/wp-content/uploads/arquivosotrevo/";
  let num = 531;
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
    } catch {
      break;
    }
  }

  if (ultimoValido) {
    const capa = ultimoValido.replace(".pdf", ".jpg");
    document.getElementById("capa-revista").innerHTML = `
      <a href="${ultimoValido}" target="_blank">
        <img src="${capa}" alt="Capa da Revista O Trevo" style="width:100%; border-radius:8px; box-shadow: 0 2px 6px rgba(0,0,0,0.2);" />
      </a>
    `;
    console.log("✅ Revista O Trevo carregada:", ultimoValido);
  } else {
    console.warn("⚠️ Nenhuma edição recente da Revista O Trevo encontrada.");
  }
}
