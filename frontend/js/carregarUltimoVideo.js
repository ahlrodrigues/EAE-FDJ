export async function carregarUltimoVideo() {
    const API_KEY = "################################3";
    const CHANNEL_ID = "UCNvAIY83zX7c6j7bWAv7yAQ";
  
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${CHANNEL_ID}&order=date&part=snippet&type=video&maxResults=1`
      );
      const data = await res.json();
      const videoId = data.items?.[0]?.id?.videoId;
  
      if (videoId) {
        const iframe = document.createElement("iframe");
        iframe.src = `https://www.youtube.com/embed/${videoId}`;
        iframe.setAttribute("allowfullscreen", "");
        iframe.setAttribute("frameborder", "0");
        iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture");
        iframe.style.width = "100%";
        iframe.style.height = "100%";
  
        const container = document.getElementById("cartao-youtube");
        container?.appendChild(iframe);
        console.log("✅ Último vídeo carregado.");
      } else {
        console.warn("⚠️ Nenhum vídeo encontrado.");
      }
    } catch (err) {
      console.error("❌ Erro ao buscar vídeo do YouTube:", err);
    }
  }
  