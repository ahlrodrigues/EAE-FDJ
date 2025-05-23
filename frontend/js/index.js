// index.js
import { componentesCarregados } from "./incluirComponentes.js";

// ⏳ Esperar o carregamento dos componentes visuais
componentesCarregados.then(() => {
  console.log("📦 Componentes carregados. Iniciando aplicação...");

  incluirCartoes().then(() => {
    console.log("🧩 Cartões HTML incluídos.");

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

        buscarMensagensDoDirigente(codigoTemas);
        buscarMensagemAleatoria(codigoTemas);
      } else {
        console.warn("⚠️ Usuário sem conteúdo criptografado.");
      }
    } catch (erro) {
      console.error("❌ Erro ao ler ou descriptografar usuario.json:", erro);
    }

    carregarUltimoVideo();

  });
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
        console.error(`❌ Erro ao incluir ${id}:`, erro);
      }
    }
  };

  return Promise.all([
    incluir("cartao-dirigente-container", "componentes/cartaoDirigente.html"),
    incluir("cartao2-container", "componentes/cartaoYoutubeRevista.html"),
    incluir("cartao-randomico-container", "componentes/cartaoRandomico.html"),
  ]);
}

function buscarMensagensDoDirigente(codigoTemas) {
  buscarPlanilha(codigoTemas, "MDirigente")
    .then((mensagens) => {
      const ultima = mensagens?.[mensagens.length - 1];
      document.getElementById("mensagem-dirigente").innerText =
        ultima || "Nenhuma mensagem encontrada.";
    })
    .catch((err) =>
      console.error("❌ Erro ao buscar mensagens do dirigente:", err)
    );
}

function buscarMensagemAleatoria(codigoTemas) {
  buscarPlanilha(codigoTemas, "MRandomica")
    .then((mensagens) => {
      const aleatoria =
        mensagens[Math.floor(Math.random() * mensagens.length)];
      document.getElementById("mensagem-randomica").innerText =
        aleatoria || "Sem mensagens.";
    })
    .catch((err) =>
      console.error("❌ Erro ao buscar mensagem aleatória:", err)
    );
}

function buscarPlanilha(codigoTemas, aba) {
  const url = `https://docs.google.com/spreadsheets/d/${codigoTemas}/gviz/tq?sheet=${aba}`;
  console.log(`📥 Buscando dados da aba: ${aba}`);
  return fetch(url)
    .then((res) => res.text())
    .then((texto) => {
      const json = JSON.parse(
        texto.replace(
          /.*google\.visualization\.Query\.setResponse\(/s,
          ""
        ).slice(0, -2)
      );
      return json.table.rows.map((row) => row.c[1]?.v);
    });
}

function carregarUltimoVideo() {
  const API_KEY = "################################3";
  const CHANNEL_ID = "UCNvAIY83zX7c6j7bWAv7yAQ";

  fetch(
    `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${CHANNEL_ID}&order=date&part=snippet&type=video&maxResults=1`
  )
    .then((res) => res.json())
    .then((data) => {
      const videoId = data.items?.[0]?.id?.videoId;
      if (videoId) {
        const iframe = document.createElement("iframe");
        iframe.src = `https://www.youtube.com/embed/${videoId}`;
        iframe.setAttribute("allowfullscreen", "");
        iframe.setAttribute("frameborder", "0");
        iframe.setAttribute(
          "allow",
          "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        );
        iframe.style.width = "100%";
        iframe.style.height = "100%";

        const container = document.getElementById("cartao-youtube");
        if (container) {
          container.appendChild(iframe);
          console.log("✅ Último vídeo carregado.");
        } else {
          console.warn("⚠️ #cartao-youtube não encontrado.");
        }
      } else {
        console.warn("⚠️ Nenhum vídeo encontrado.");
      }
    })
    .catch((err) =>
      console.error("❌ Erro ao buscar vídeo do YouTube:", err)
    );
}

