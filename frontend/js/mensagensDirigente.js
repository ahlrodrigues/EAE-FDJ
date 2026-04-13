import { buscarPlanilha } from "./buscarPlanilha.js";

export async function buscarMensagensDoDirigente(codigoTemas) {
  try {
    // Preferência: conteúdo local baixado via Sync (aviso_dirigente_feed)
    try {
      const st = await window.api?.sync?.status?.();
      const turmaId = st?.configured ? st?.turmaId : "";
      if (turmaId && window.api?.content?.getItem) {
        const resp = await window.api.content.getItem("aviso_dirigente_feed", turmaId);
        const feed = resp?.ok ? resp.item : null;

        // Formatos aceitos:
        // A) { items: [{ message|mensagem|texto, createdAtISO?... }, ...] }
        // B) { items: ["msg1","msg2"] }
        const items = Array.isArray(feed?.items) ? feed.items : [];
        let ultima = null;
        if (items.length && typeof items[items.length - 1] === "string") {
          ultima = items[items.length - 1];
        } else if (items.length && typeof items[items.length - 1] === "object") {
          const last = items[items.length - 1] || {};
          ultima = last.message || last.mensagem || last.texto || last.text || "";
        }

        if (ultima) {
          document.getElementById("mensagem-dirigente").innerText = ultima;
          return;
        }
      }
    } catch (e) {
      // fallback para planilha antiga
      console.warn("⚠️ Aviso do dirigente via sync indisponível. Usando fallback planilha.", e?.message || e);
    }

    const mensagens = await buscarPlanilha(codigoTemas, "MDirigente");
    const ultima = mensagens?.[mensagens.length - 1];
    document.getElementById("mensagem-dirigente").innerText =
      ultima || "Nenhuma mensagem encontrada.";
  } catch (err) {
    console.error("❌ Erro ao buscar mensagens do dirigente:", err);
  }
}
