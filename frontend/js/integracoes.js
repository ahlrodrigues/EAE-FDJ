import { exibirAviso } from "./modalAviso.js";
import { componentesCarregados } from "./incluirComponentes.js";

const LOG = "🧩[INTEGRACOES]";
const qs = (s) => document.querySelector(s);

const DEFAULT_HTTP_BASE_URL = "https://api.geea.com.br";

function env(key) {
  try { return window.nativo?.getEnv?.(key); } catch { return null; }
}

function setStatusLine(text) {
  const el = qs("#syncStatusText");
  if (el) el.textContent = `Status: ${text || "—"}`;
}

function setPkgOut(v) {
  const el = qs("#pkgDebugOut");
  if (!el) return;
  if (typeof v === "string") el.textContent = v;
  else el.textContent = JSON.stringify(v, null, 2);
}

function parseJsonSafe(s) {
  try { return JSON.parse(String(s || "")); } catch { return null; }
}

function getRolesFromUser(u) {
  const roles = Array.isArray(u?.roles) ? u.roles : [];
  return roles.map((r) => String(r || "").trim().toLowerCase()).filter(Boolean);
}

function applyRoleVisibility(rootEl, roles) {
  const set = new Set(Array.isArray(roles) ? roles : []);
  const nodes = Array.from((rootEl || document).querySelectorAll("[data-roles]"));
  for (const el of nodes) {
    const req = String(el.getAttribute("data-roles") || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const allowed = req.length === 0 || req.some((r) => set.has(r));
    el.style.display = allowed ? "" : "none";
  }
}

async function loadRemoteSync() {
  const resp = await window.usuarioAPI?.lerAtual?.();
  const u = resp?.ok ? (resp.dados || {}) : {};
  const rs = (u.remoteSync && typeof u.remoteSync === "object") ? u.remoteSync : {};

  const httpBaseUrl = rs.httpBaseUrl || env("SYNC_HTTP_BASE_URL") || DEFAULT_HTTP_BASE_URL;
  const wsUrl = rs.wsUrl || env("SYNC_WS_URL") || "";
  const turmaId = rs.turmaId || env("SYNC_TURMA_ID") || "";
  const token = rs.token || env("SYNC_TOKEN") || "";

  qs("#syncHttpBaseUrl").value = httpBaseUrl;
  qs("#syncWsUrl").value = wsUrl;
  qs("#syncTurmaId").value = turmaId;
  qs("#syncToken").value = token;
}

function isValidTurmaId(v) {
  const s = String(v || "").trim();
  // Sugestão baseada na regra "TurmaId+x" (x = letras/números)
  return /^TurmaId[0-9A-Za-z]+$/.test(s);
}

async function saveRemoteSync() {
  const turmaId = qs("#syncTurmaId")?.value || "";
  if (turmaId && !isValidTurmaId(turmaId)) {
    throw new Error("Turma ID inválido. Use o formato: TurmaId + letras/números (ex.: TurmaIdA1B2C3).");
  }

  const patch = {
    remoteSync: {
      httpBaseUrl: qs("#syncHttpBaseUrl")?.value || "",
      wsUrl: qs("#syncWsUrl")?.value || "",
      turmaId,
      token: qs("#syncToken")?.value || "",
    },
  };

  const res = await window.usuarioAPI?.atualizarAtual?.(patch);
  if (!res?.ok) throw new Error(res?.erro || "Falha ao salvar integrações.");
}

async function showSyncStatus() {
  const st = await window.api?.sync?.status?.();
  if (!st?.ok) {
    setStatusLine(st?.erro || "erro");
    return;
  }
  if (!st.configured) {
    setStatusLine("não configurado");
    return;
  }
  const ver = st.manifestVersion != null ? `v${st.manifestVersion}` : "—";
  const when = st.updatedAtISO ? new Date(st.updatedAtISO).toLocaleString() : "—";
  setStatusLine(`turma=${st.turmaId} versão=${ver} atualizado=${when}`);
}

async function pullNow() {
  const resp = await window.api?.sync?.pullNow?.();
  if (resp?.ok) {
    const msg = resp.changed
      ? `Conteúdo atualizado. Itens baixados: ${resp.downloaded ?? 0}`
      : (resp.message || "Sem atualizações.");
    await exibirAviso({ tipo: "Atualização", mensagem: msg });
    await showSyncStatus();
    return;
  }
  throw new Error(resp?.erro || "Falha ao atualizar.");
}

async function checkNow() {
  const resp = await window.api?.sync?.check?.();
  if (!resp?.ok) throw new Error(resp?.erro || "Falha ao checar atualizações.");
  if (!resp.configured) {
    await exibirAviso({ tipo: "Info", mensagem: "Sync não configurado." });
    return;
  }
  if (resp.changed) {
    const ver = resp.remoteManifestVersion != null ? `v${resp.remoteManifestVersion}` : "—";
    await exibirAviso({ tipo: "Atualização", mensagem: `Há atualizações disponíveis (${ver}).` });
  } else {
    await exibirAviso({ tipo: "Info", mensagem: "Sem atualizações." });
  }
  await showSyncStatus();
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log(`${LOG} init`);
  await componentesCarregados;

  const uResp = await window.usuarioAPI?.lerAtual?.().catch(() => null);
  const u = uResp?.ok ? (uResp.dados || {}) : {};
  applyRoleVisibility(document, getRolesFromUser(u));

  await loadRemoteSync();
  await showSyncStatus();
  setPkgOut("(saída)");

  qs("#formSync")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await saveRemoteSync();
      await exibirAviso({ tipo: "Sucesso", mensagem: "Integrações salvas." });
      await showSyncStatus();
    } catch (err) {
      await exibirAviso({ tipo: "Erro", mensagem: err?.message || "Falha ao salvar." });
    }
  });

  qs("#btnSyncStatus")?.addEventListener("click", () => showSyncStatus());
  qs("#btnSyncCheck")?.addEventListener("click", async () => {
    try { await checkNow(); }
    catch (err) { await exibirAviso({ tipo: "Erro", mensagem: err?.message || "Falha ao checar." }); }
  });
  qs("#btnSyncPull")?.addEventListener("click", async () => {
    try { await pullNow(); }
    catch (err) { await exibirAviso({ tipo: "Erro", mensagem: err?.message || "Falha ao atualizar." }); }
  });

  qs("#btnLinkInvite")?.addEventListener("click", async () => {
    try {
      const alunoId = String(qs("#linkAlunoId")?.value || "").trim();
      if (!alunoId) throw new Error("Informe o Aluno ID (emailHash).");
      const resp = await window.api?.links?.invite?.(alunoId);
      setPkgOut(resp || { ok: false, erro: "API indisponível" });
      if (resp?.ok) {
        await exibirAviso({ tipo: "Sucesso", mensagem: `Convite criado (linkId=${resp.link?.linkId || "—"})` });
        const linkId = resp.link?.linkId;
        if (linkId) qs("#linkIdConfirm").value = linkId;
      }
    } catch (err) {
      await exibirAviso({ tipo: "Erro", mensagem: err?.message || "Falha ao convidar vínculo." });
    }
  });

  qs("#btnLinkConfirm")?.addEventListener("click", async () => {
    try {
      const linkId = String(qs("#linkIdConfirm")?.value || "").trim();
      if (!linkId) throw new Error("Informe o Link ID.");
      const resp = await window.api?.links?.confirm?.(linkId);
      setPkgOut(resp || { ok: false, erro: "API indisponível" });
      if (resp?.ok) await exibirAviso({ tipo: "Sucesso", mensagem: "Vínculo confirmado." });
    } catch (err) {
      await exibirAviso({ tipo: "Erro", mensagem: err?.message || "Falha ao confirmar vínculo." });
    }
  });

  qs("#btnLinkList")?.addEventListener("click", async () => {
    try {
      const resp = await window.api?.links?.listMine?.();
      setPkgOut(resp || { ok: false, erro: "API indisponível" });
    } catch (err) {
      setPkgOut({ ok: false, erro: err?.message || "Falha ao listar vínculos." });
    }
  });

  qs("#btnReqCreate")?.addEventListener("click", async () => {
    try {
      const toId = String(qs("#reqToId")?.value || "").trim();
      if (!toId) throw new Error("Informe o To ID (aluno).");
      const type = String(qs("#reqType")?.value || "materials_request").trim();
      const availableAtISO = String(qs("#reqAvailableAt")?.value || "").trim();

      const resp = await window.api?.requests?.create?.(toId, "", type, availableAtISO, "");
      setPkgOut(resp || { ok: false, erro: "API indisponível" });
      if (resp?.ok) await exibirAviso({ tipo: "Sucesso", mensagem: `Solicitação criada (requestId=${resp.request?.requestId || "—"})` });
    } catch (err) {
      await exibirAviso({ tipo: "Erro", mensagem: err?.message || "Falha ao criar request." });
    }
  });

  qs("#btnReqList")?.addEventListener("click", async () => {
    try {
      const resp = await window.api?.requests?.listOpen?.();
      setPkgOut(resp || { ok: false, erro: "API indisponível" });
    } catch (err) {
      setPkgOut({ ok: false, erro: err?.message || "Falha ao listar requests." });
    }
  });

  qs("#btnPkgList")?.addEventListener("click", async () => {
    try {
      const resp = await window.api?.packages?.listPending?.();
      setPkgOut(resp || { ok: false, erro: "API indisponível" });
    } catch (err) {
      setPkgOut({ ok: false, erro: err?.message || "Falha ao listar packages." });
    }
  });

  qs("#btnRespSend")?.addEventListener("click", async () => {
    try {
      const requestId = String(qs("#respRequestId")?.value || "").trim();
      if (!requestId) throw new Error("Informe o requestId.");
      const payloadRaw = String(qs("#respPayload")?.value || "").trim();
      const payload = parseJsonSafe(payloadRaw);
      if (payloadRaw && payload == null) throw new Error("Payload JSON inválido.");

      const resp = await window.api?.responses?.uploadForRequest?.(requestId, payload ?? {});
      setPkgOut(resp || { ok: false, erro: "API indisponível" });
      if (resp?.ok) await exibirAviso({ tipo: "Sucesso", mensagem: `Resposta enviada (packageId=${resp.packageId})` });
    } catch (err) {
      await exibirAviso({ tipo: "Erro", mensagem: err?.message || "Falha ao enviar resposta." });
    }
  });

  qs("#btnRespSendAuto")?.addEventListener("click", async () => {
    try {
      const requestId = String(qs("#respRequestId")?.value || "").trim();
      if (!requestId) throw new Error("Informe o requestId.");
      const resp = await window.api?.responses?.uploadForRequestAuto?.(requestId, false);
      setPkgOut(resp || { ok: false, erro: "API indisponível" });
      if (resp?.skipped) {
        await exibirAviso({ tipo: "Info", mensagem: resp.reason || "Sem mudanças." });
        return;
      }
      if (resp?.ok) await exibirAviso({ tipo: "Sucesso", mensagem: `Incremental enviado (packageId=${resp.packageId})` });
    } catch (err) {
      await exibirAviso({ tipo: "Erro", mensagem: err?.message || "Falha ao enviar incremental." });
    }
  });

  qs("#btnPkgDownload")?.addEventListener("click", async () => {
    try {
      const packageId = String(qs("#pkgId")?.value || "").trim();
      if (!packageId) throw new Error("Informe o packageId.");
      const resp = await window.api?.packages?.download?.(packageId);
      setPkgOut(resp || { ok: false, erro: "API indisponível" });
      if (resp?.ok) await exibirAviso({ tipo: "Info", mensagem: `Baixado em: ${resp.filePath}` });
    } catch (err) {
      await exibirAviso({ tipo: "Erro", mensagem: err?.message || "Falha ao baixar." });
    }
  });

  qs("#btnPkgApplied")?.addEventListener("click", async () => {
    try {
      const packageId = String(qs("#pkgId")?.value || "").trim();
      if (!packageId) throw new Error("Informe o packageId.");
      const resp = await window.api?.packages?.markApplied?.(packageId, true, "");
      setPkgOut(resp || { ok: false, erro: "API indisponível" });
      if (resp?.ok) await exibirAviso({ tipo: "Sucesso", mensagem: "Aplicação confirmada." });
    } catch (err) {
      await exibirAviso({ tipo: "Erro", mensagem: err?.message || "Falha ao confirmar." });
    }
  });
});
