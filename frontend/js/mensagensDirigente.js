import { buscarPlanilha } from "./buscarPlanilha.js";

export async function buscarMensagensDoDirigente(codigoTemas) {
  try {
    const mensagens = await buscarPlanilha(codigoTemas, "MDirigente");
    const ultima = mensagens?.[mensagens.length - 1];
    document.getElementById("mensagem-dirigente").innerText =
      ultima || "Nenhuma mensagem encontrada.";
  } catch (err) {
    console.error("❌ Erro ao buscar mensagens do dirigente:", err);
  }
}
