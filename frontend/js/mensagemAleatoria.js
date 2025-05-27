import { buscarPlanilha } from "./buscarPlanilha.js";

export async function buscarMensagemAleatoria(codigoTemas) {
  try {
    const mensagens = await buscarPlanilha(codigoTemas, "MRandomica");
    const aleatoria = mensagens[Math.floor(Math.random() * mensagens.length)];
    document.getElementById("mensagem-randomica").innerText =
      aleatoria || "Sem mensagens.";
  } catch (err) {
    console.error("❌ Erro ao buscar mensagem aleatória:", err);
  }
}
