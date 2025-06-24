export async function carregarVideoAleatorio() {
    const API_KEY = window.nativo?.getEnv("YOUTUBE_API");
    const CHANNEL_ID = "UCNvAIY83zX7c6j7bWAv7yAQ";
    const VIDEO_ALTERNATIVO = "M7lc1UVf-VE";
    const container = document.getElementById("youtubeContainer");
  
    if (!container) {
      console.warn("⚠️ Container #youtubeContainer não encontrado.");
      return;
    }
  
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${CHANNEL_ID}` +
        `&order=date&part=snippet&type=video&maxResults=25`
      );
      const data = await res.json();
      const videos = data.items?.filter(item => item.id?.videoId);
  
      if (!videos || videos.length === 0) throw new Error("Nenhum vídeo disponível.");
  
      // 🔀 Seleciona um vídeo aleatório
      const randomIndex = Math.floor(Math.random() * videos.length);
      const videoId = videos[randomIndex].id.videoId;
      console.log("🎲 Vídeo aleatório selecionado:", videoId);
  
      // Verifica se o vídeo é embeddable
      const statusRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?key=${API_KEY}&id=${videoId}&part=status`
      );
      const statusData = await statusRes.json();
      const embeddable = statusData.items?.[0]?.status?.embeddable;
  
      if (!embeddable) throw new Error("Vídeo não pode ser incorporado.");
  
      exibirVideo(videoId, container, false);
      console.log("✅ Vídeo aleatório incorporado com sucesso.");
  
    } catch (err) {
      console.warn("⚠️ Falha ao carregar vídeo aleatório:", err.message);
      exibirVideo(VIDEO_ALTERNATIVO, container, true);
    }
  }
  
  function exibirVideo(videoId, container, mostrarBotao = false) {
    const iframe = document.createElement("iframe");
    iframe.src = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
    iframe.setAttribute("allowfullscreen", "");
    iframe.setAttribute("frameborder", "0");
    iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture");
    iframe.style.width = "100%";
    iframe.style.aspectRatio = "16 / 9";
    iframe.style.height = "100%";
  
    container.innerHTML = "";
    container.appendChild(iframe);
  
    if (mostrarBotao) {
      const link = document.createElement("a");
      link.href = "https://www.youtube.com/channel/UCNvAIY83zX7c6j7bWAv7yAQ";
      link.target = "_blank";
      link.textContent = "🔗 Ver no YouTube";
      link.style.display = "inline-block";
      link.style.marginTop = "0.5rem";
      link.style.color = "#0077cc";
      link.style.fontWeight = "bold";
      link.style.textDecoration = "none";
      container.appendChild(link);
    }
  
    console.log("📥 iframe inserido no container:", videoId);
  }
  