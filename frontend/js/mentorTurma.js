// =============================================================================
// Caminho: frontend/js/mentorTurma.js
// Objetivo: preencher o card "Mensagem do Mentor da Turma" a partir do conteúdo
// local baixado via Sync (type=mensagem_mentor_turma, id=<turmaId>).
// =============================================================================

export async function carregarMensagemMentorTurma() {
  const el = document.getElementById("mensagem-mentor-turma");
  if (!el) return;

  try {
    const st = await window.api?.sync?.status?.();
    const turmaId = st?.configured ? st?.turmaId : "";
    if (!turmaId) {
      el.innerText = "—";
      return;
    }

    const resp = await window.api?.content?.getItem?.("mensagem_mentor_turma", turmaId);
    const data = resp?.ok ? resp.item : null;

    // Formatos aceitos:
    // A) { message|mensagem|texto|text: "..." }
    // B) { current: { message... } }
    let msg =
      data?.message ||
      data?.mensagem ||
      data?.texto ||
      data?.text ||
      data?.current?.message ||
      data?.current?.mensagem ||
      data?.current?.texto ||
      data?.current?.text ||
      "";

    msg = String(msg || "").trim();
    el.innerText = msg || "Nenhuma mensagem disponível.";
  } catch (e) {
    console.warn("⚠️ Falha ao carregar mensagem do mentor da turma:", e?.message || e);
    el.innerText = "Nenhuma mensagem disponível.";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // carrega uma vez na entrada da tela
  carregarMensagemMentorTurma();
});

