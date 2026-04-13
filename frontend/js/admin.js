import { exibirAviso } from "./modalAviso.js";
import { componentesCarregados } from "./incluirComponentes.js";

const LOG = "🛠️[ADMIN]";
const qs = (s) => document.querySelector(s);

function env(key) {
  try { return window.nativo?.getEnv?.(key); } catch { return null; }
}

function setStatusLine(text) {
  const el = qs("#adminStatusText");
  if (el) el.textContent = `Status: ${text || "—"}`;
}

function isValidTurmaId(v) {
  const s = String(v || "").trim();
  return /^TurmaId[0-9A-Za-z]+$/.test(s);
}

async function guessTurmaId() {
  try {
    const resp = await window.usuarioAPI?.lerAtual?.();
    const u = resp?.ok ? (resp.dados || {}) : {};
    const rs = (u.remoteSync && typeof u.remoteSync === "object") ? u.remoteSync : {};
    return rs.turmaId || env("SYNC_TURMA_ID") || "";
  } catch {
    return env("SYNC_TURMA_ID") || "";
  }
}

async function publishLocal() {
  const turmaId = String(qs("#adminTurmaId")?.value || "").trim();
  if (!turmaId) throw new Error("Informe a Turma ID.");
  if (!isValidTurmaId(turmaId)) throw new Error("Turma ID inválido. Use: TurmaId + letras/números (ex.: TurmaIdA1B2C3).");

  const avisoTitulo = String(qs("#avisoTitulo")?.value || "").trim();
  const avisoMensagem = String(qs("#avisoMensagem")?.value || "").trim();
  const mentorMensagem = String(qs("#mentorMensagem")?.value || "").trim();
  const temaStartDate = String(qs("#temaStartDate")?.value || "").trim(); // yyyy-mm-dd
  const temaPublishedAtHour = String(qs("#temaPublishedAtHour")?.value || "").trim();

  const payload = {
    turmaId,
    temaScheduleFromPrograma: temaStartDate ? { startDateISO: temaStartDate, publishedAtHourLocal: temaPublishedAtHour } : null,
    avisoDirigente: { titulo: avisoTitulo, mensagem: avisoMensagem },
    mensagemMentorTurma: { mensagem: mentorMensagem },
  };

  const resp = await window.api?.admin?.publishLocal?.(payload);
  if (!resp?.ok) throw new Error(resp?.erro || "Falha ao publicar localmente.");
  setStatusLine(`publicado localmente (turma=${resp.turmaId} v=${resp.manifestVersion})`);
  await exibirAviso({ tipo: "Sucesso", mensagem: "Conteúdo publicado localmente." });
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log(`${LOG} init`);
  await componentesCarregados;

  const tid = await guessTurmaId();
  if (tid) qs("#adminTurmaId").value = tid;

  qs("#adminForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try { await publishLocal(); }
    catch (err) { await exibirAviso({ tipo: "Erro", mensagem: err?.message || "Falha ao publicar." }); }
  });
});
