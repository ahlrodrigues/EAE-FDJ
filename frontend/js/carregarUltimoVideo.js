export async function carregarUltimoVideo() {
  const API_KEY = window.nativo?.getEnv("YOUTUBE_API");
  const CHANNEL_ID = "UCNvAIY83zX7c6j7bWAv7yAQ";
  const VIDEO_ALTERNATIVO = "M7lc1UVf-VE";

  console.log("🚀 Iniciando carregarUltimoVideo()");
  console.log("🔑 API_KEY existe?", Boolean(API_KEY));

  const container = document.getElementById("youtubeContainer");
  if (!container) {
    console.error("❌ #youtubeContainer não encontrado no DOM");
    return;
  }
  console.log("✅ #youtubeContainer encontrado");

  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${CHANNEL_ID}&order=date&part=snippet&type=video&maxResults=1`);
    console.log("📦 fetch search status:", res.status);
    const data = await res.json();
    console.log("📃 search response:", data);

    const videoId = data.items?.[0]?.id?.videoId;
    console.log("📹 videoId encontrado:", videoId);
    if (!videoId) throw new Error("Nenhum videoId");

    const statusRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?key=${API_KEY}&id=${videoId}&part=status`);
    console.log("📦 fetch status status:", statusRes.status);
    const statusData = await statusRes.json();
    console.log("🔍 statusData:", statusData);
    const embeddable = statusData.items?.[0]?.status?.embeddable;
    console.log("✔ embeddable:", embeddable);

    if (!embeddable) throw new Error("Video nao embeddable");

    exibirVideo(videoId, container);
    console.log("✅ iframe do video do canal inserido");
  } catch (err) {
    console.warn("⚠️ fallback ativado:", err.message);
    exibirVideo(VIDEO_ALTERNATIVO, container);
    console.log("✅ iframe do video alternativo inserido");
  }
}

function exibirVideo(videoId, container) {
  console.log("🎬 exibirVideo:", videoId);
  const iframe = document.createElement("iframe");
  iframe.src = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
  iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
  iframe.setAttribute("allowfullscreen", "");
  iframe.style.width = "100%";
  iframe.style.aspectRatio = "16 / 9";
  iframe.style.height = "100%";

  container.innerHTML = "";
  container.appendChild(iframe);
  console.log("📥 iframe inserido no container");
}
