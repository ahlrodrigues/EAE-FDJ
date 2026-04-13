import { componentesCarregados } from "./incluirComponentes.js";
import { exibirAviso } from "./modalAviso.js";

const LOG = "🩺[DIAG]";
const qs = (s) => document.querySelector(s);

function setOut(v) {
  const el = qs("#diagOut");
  if (!el) return;
  if (typeof v === "string") el.textContent = v;
  else el.textContent = JSON.stringify(v, null, 2);
}

function setMeta(id, text) {
  const el = qs(id);
  if (el) el.textContent = text || "—";
}

function fmtISO(iso) {
  try { return iso ? new Date(iso).toLocaleString() : "—"; } catch { return "—"; }
}

async function loadUser() {
  const resp = await window.usuarioAPI?.lerAtual?.();
  const u = resp?.ok ? (resp.dados || {}) : {};
  const roles = Array.isArray(u.roles) ? u.roles : [];
  const primary = roles.includes("analista") ? "analista" : (roles.includes("dirigente") ? "dirigente" : "aluno");
  const rs = (u.remoteSync && typeof u.remoteSync === "object") ? u.remoteSync : {};

  setMeta("#diagUserMeta", `roles=${roles.join(",") || "aluno"} | primary=${primary} | turmaId=${rs.turmaId || "—"} | base=${rs.httpBaseUrl || "—"}`);
  return { u, roles, rs };
}

async function syncStatus() {
  const st = await window.api?.sync?.status?.();
  if (!st?.ok) throw new Error(st?.erro || "Falha no sync:status");
  setMeta("#diagSyncMeta", st.configured ? `sync turma=${st.turmaId} ver=${st.manifestVersion ?? "—"} pulled=${fmtISO(st.updatedAtISO)}` : "sync não configurado");
  return st;
}

async function syncCheck() {
  const st = await window.api?.sync?.check?.();
  setOut(st || { ok: false, erro: "API indisponível" });
  return st;
}

async function syncPull() {
  const st = await window.api?.sync?.pullNow?.();
  setOut(st || { ok: false, erro: "API indisponível" });
  return st;
}

async function listLinks() {
  const resp = await window.api?.links?.listMine?.();
  setOut(resp || { ok: false, erro: "API indisponível" });
  return resp;
}

async function listRequests() {
  const resp = await window.api?.requests?.listOpen?.();
  setOut(resp || { ok: false, erro: "API indisponível" });
  return resp;
}

async function listPackages() {
  const resp = await window.api?.packages?.listPending?.();
  setOut(resp || { ok: false, erro: "API indisponível" });
  return resp;
}

async function pkgDownload() {
  const packageId = String(qs("#diagPkgId")?.value || "").trim();
  if (!packageId) throw new Error("Informe o packageId.");
  const resp = await window.api?.packages?.download?.(packageId);
  setOut(resp || { ok: false, erro: "API indisponível" });
  return resp;
}

async function pkgApplied() {
  const packageId = String(qs("#diagPkgId")?.value || "").trim();
  if (!packageId) throw new Error("Informe o packageId.");
  const resp = await window.api?.packages?.markApplied?.(packageId, true, "");
  setOut(resp || { ok: false, erro: "API indisponível" });
  return resp;
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log(`${LOG} init`);
  await componentesCarregados;
  setOut("(saída)");

  try {
    await loadUser();
    await syncStatus();
  } catch {}

  qs("#btnDiagSyncStatus")?.addEventListener("click", async () => {
    try { await syncStatus(); }
    catch (e) { await exibirAviso({ tipo: "Erro", mensagem: e?.message || "Falha no status." }); }
  });

  qs("#btnDiagSyncCheck")?.addEventListener("click", async () => {
    try { await syncCheck(); }
    catch (e) { await exibirAviso({ tipo: "Erro", mensagem: e?.message || "Falha no check." }); }
  });

  qs("#btnDiagSyncPull")?.addEventListener("click", async () => {
    try { await syncPull(); await syncStatus(); }
    catch (e) { await exibirAviso({ tipo: "Erro", mensagem: e?.message || "Falha no pull." }); }
  });

  qs("#btnDiagLinks")?.addEventListener("click", async () => {
    try { await listLinks(); }
    catch (e) { await exibirAviso({ tipo: "Erro", mensagem: e?.message || "Falha ao listar vínculos." }); }
  });

  qs("#btnDiagRequests")?.addEventListener("click", async () => {
    try { await listRequests(); }
    catch (e) { await exibirAviso({ tipo: "Erro", mensagem: e?.message || "Falha ao listar requests." }); }
  });

  qs("#btnDiagPackages")?.addEventListener("click", async () => {
    try { await listPackages(); }
    catch (e) { await exibirAviso({ tipo: "Erro", mensagem: e?.message || "Falha ao listar packages." }); }
  });

  qs("#btnDiagPkgDownload")?.addEventListener("click", async () => {
    try {
      const resp = await pkgDownload();
      if (resp?.ok) await exibirAviso({ tipo: "Info", mensagem: `Baixado em: ${resp.filePath}` });
    } catch (e) {
      await exibirAviso({ tipo: "Erro", mensagem: e?.message || "Falha ao baixar." });
    }
  });

  qs("#btnDiagPkgApplied")?.addEventListener("click", async () => {
    try {
      const resp = await pkgApplied();
      if (resp?.ok) await exibirAviso({ tipo: "Sucesso", mensagem: "Aplicação confirmada." });
    } catch (e) {
      await exibirAviso({ tipo: "Erro", mensagem: e?.message || "Falha ao confirmar." });
    }
  });
});

