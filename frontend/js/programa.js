import { componentesCarregados } from "./incluirComponentes.js";
import { exibirAviso } from "./modalAviso.js";

const LOG = "📘[PROGRAMA]";
const qs = (s) => document.querySelector(s);

function setMeta(text) {
  const el = qs("#programaMeta");
  if (el) el.textContent = text || "—";
}

function normalize(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function addDaysISO(yyyyMmDd, days) {
  const m = String(yyyyMmDd || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + Number(days || 0));
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getActiveRole() {
  try {
    const v = String(document.documentElement?.dataset?.role || "").trim().toLowerCase();
    if (v) return v;
  } catch {}
  const s = String(sessionStorage.getItem("activeRole") || "").trim().toLowerCase();
  return s || "aluno";
}

function normalizeColumns(cols) {
  const arr = Array.isArray(cols) ? cols : [];
  return arr
    .map((c) => ({
      key: String(c?.key || "").trim(),
      label: String(c?.label || c?.key || "").trim(),
      type: String(c?.type || "text").trim(),
      width: Number(c?.width) || null,
      rolesHidden: Array.isArray(c?.rolesHidden) ? c.rolesHidden.map((r) => String(r || "").trim().toLowerCase()).filter(Boolean) : [],
      readonly: !!c?.readonly,
    }))
    .filter((c) => c.key);
}

function normalizeRows(rows) {
  const arr = Array.isArray(rows) ? rows : [];
  return arr
    .map((r, idx) => ({
      rowId: String(r?.rowId || `row_${idx + 1}`),
      order: Number.isFinite(Number(r?.order)) ? Number(r.order) : idx + 1,
      ...r,
    }))
    .filter((r) => r.rowId);
}

function isColumnVisibleForRole(col, role) {
  const hidden = Array.isArray(col?.rolesHidden) ? col.rolesHidden : [];
  return !hidden.includes(String(role || "").toLowerCase());
}

function buildSearchHaystack(row, cols) {
  return normalize(
    cols
      .map((c) => String(row?.[c.key] ?? ""))
      .join(" ")
  );
}

function renderGrid({ rows, columns, filtro, role, onInsertBelow, onDeleteRow, onEditCell }) {
  const body = qs("#programaBody");
  const head = qs("#programaHead");
  if (!body || !head) return;
  body.innerHTML = "";
  head.innerHTML = "";

  const f = normalize(filtro);

  const visibleCols = columns.filter((c) => isColumnVisibleForRole(c, role));

  // HEAD
  const trh = document.createElement("tr");
  const thActions = document.createElement("th");
  thActions.textContent = "Ações";
  thActions.style.width = "110px";
  trh.appendChild(thActions);
  for (const c of visibleCols) {
    const th = document.createElement("th");
    th.textContent = c.label;
    if (c.width) th.style.width = `${c.width}px`;
    trh.appendChild(th);
  }
  head.appendChild(trh);

  // FILTER
  const filtered = !f
    ? rows
    : rows.filter((r) => buildSearchHaystack(r, visibleCols).includes(f));

  // BODY
  for (const r of filtered) {
    const tr = document.createElement("tr");

    const tdAct = document.createElement("td");
    tdAct.setAttribute("data-label", "Ações");
    tdAct.innerHTML = `
      <div class="programa-row-actions">
        <button type="button" data-act="insert" title="Inserir linha abaixo">＋</button>
        <button type="button" data-act="del" title="Excluir linha">🗑</button>
      </div>
    `;
    tdAct.querySelector('[data-act="insert"]')?.addEventListener("click", () => onInsertBelow?.(r.rowId));
    tdAct.querySelector('[data-act="del"]')?.addEventListener("click", () => onDeleteRow?.(r.rowId));
    tr.appendChild(tdAct);

    for (const c of visibleCols) {
      const td = document.createElement("td");
      td.setAttribute("data-label", c.label);

      const v = r?.[c.key] ?? "";
      const ro = !!c.readonly || c.key === "aulaNumero";
      if (c.type === "date") {
        const inp = document.createElement("input");
        inp.type = "date";
        inp.className = "programa-cell-date";
        inp.value = String(v || "");
        inp.disabled = ro;
        inp.addEventListener("input", () => onEditCell?.(r.rowId, c.key, inp.value));
        td.appendChild(inp);
      } else if (c.type === "number") {
        const inp = document.createElement("input");
        inp.type = "number";
        inp.inputMode = "numeric";
        inp.className = "programa-cell-number";
        inp.value = v === null || v === undefined ? "" : String(v);
        inp.disabled = ro;
        inp.addEventListener("input", () => onEditCell?.(r.rowId, c.key, inp.value === "" ? "" : Number(inp.value)));
        td.appendChild(inp);
      } else if (String(v || "").length > 70 || c.key === "assuntoDirigente" || c.key === "assuntos") {
        const ta = document.createElement("textarea");
        ta.className = "programa-cell-textarea";
        ta.value = String(v || "");
        ta.rows = 2;
        ta.disabled = ro;
        ta.addEventListener("input", () => onEditCell?.(r.rowId, c.key, ta.value));
        td.appendChild(ta);
      } else {
        const inp = document.createElement("input");
        inp.type = "text";
        inp.className = "programa-cell-input";
        inp.value = String(v || "");
        inp.disabled = ro;
        inp.addEventListener("input", () => onEditCell?.(r.rowId, c.key, inp.value));
        td.appendChild(inp);
      }

      tr.appendChild(td);
    }

    body.appendChild(tr);
  }

  return { total: rows.length, shown: filtered.length, visibleColsCount: visibleCols.length };
}

async function loadPrograma() {
  // Preferência: se já veio pelo pull (contentStore), usa o item local
  try {
    const local = await window.api?.content?.getItem?.("programa_aulas_eae", "global");
    if (local?.ok && (Array.isArray(local.item?.rows) || Array.isArray(local.item?.temaMap))) {
      return { source: "local", dados: local.item };
    }
  } catch {}

  // Fallback: referência empacotada no app
  const res = await window.api?.programa?.getPadrao?.();
  if (!res?.ok) throw new Error(res?.erro || "Falha ao carregar programa padrão.");
  return { source: "bundled", dados: res.dados };
}

function hasAnyMissingProgramaFields(rows) {
  const arr = Array.isArray(rows) ? rows : [];
  for (const r of arr) {
    const cap = String(r?.capitulo || "").trim();
    const aula = String(r?.aulaTitulo || "").trim();
    if (!cap || !aula) return true;
  }
  return false;
}

async function backfillCapituloEAulaFromBundledIfNeeded(localDados) {
  const rows = Array.isArray(localDados?.rows) ? localDados.rows : null;
  if (!rows || !rows.length) return localDados;
  if (!hasAnyMissingProgramaFields(rows)) return localDados;

  let bundled = null;
  try {
    const res = await window.api?.programa?.getPadrao?.();
    if (res?.ok) bundled = res.dados;
  } catch {}
  if (!bundled || !Array.isArray(bundled.rows) || !bundled.rows.length) return localDados;

  const byOrder = new Map();
  for (const r of bundled.rows) {
    const k = Number.isFinite(Number(r?.order)) ? Number(r.order) : (Number.isFinite(Number(r?.aulaNumero)) ? Number(r.aulaNumero) : null);
    if (k == null) continue;
    if (!byOrder.has(k)) byOrder.set(k, r);
  }

  const mergedRows = rows.map((r) => {
    const k = Number.isFinite(Number(r?.order)) ? Number(r.order) : (Number.isFinite(Number(r?.aulaNumero)) ? Number(r.aulaNumero) : null);
    const b = k == null ? null : byOrder.get(k);
    if (!b) return r;
    const cap = String(r?.capitulo || "").trim();
    const aula = String(r?.aulaTitulo || "").trim();
    return {
      ...r,
      capitulo: cap ? r.capitulo : (b.capitulo || ""),
      aulaTitulo: aula ? r.aulaTitulo : (b.aulaTitulo || ""),
    };
  });

  return { ...localDados, rows: mergedRows };
}

async function loadProgramaSchedule(turmaId) {
  try {
    const local = await window.api?.content?.getItem?.("programa_aulas_eae_schedule", turmaId);
    if (local?.ok && local.item?.items) return local.item;
  } catch {}
  return null;
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
    return rs.turmaId || "";
  } catch {
    return "";
  }
}

function readDatesFromTable() {
  // (mantido por compat) — agora preferimos ler das rows em memória
  return [];
}

async function saveProgramaDatasLocal({ turmaId, publishedAtHourLocal }) {
  // items serão preenchidos a partir das rows em memória (abaixo)
  const items = [];
  const payload = {
    turmaId,
    programaSchedule: {
      timezone: "America/Sao_Paulo",
      publishedAtHourLocal: publishedAtHourLocal || "06:00",
      items,
    },
  };

  const resp = await window.api?.admin?.publishLocal?.(payload);
  if (!resp?.ok) throw new Error(resp?.erro || "Falha ao salvar datas.");
  return resp;
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log(`${LOG} init`);
  await componentesCarregados;

  let programa = null;
  let allColumns = [];
  let allRows = [];
  let schedule = null;
  const role = getActiveRole();
  let dirtyPrograma = false;

  function setDirty(on) {
    dirtyPrograma = !!on;
    const btn = qs("#btnSalvarProgramaLocal");
    if (btn) btn.textContent = dirtyPrograma ? "Salvar programa (pendente)" : "Salvar programa (local)";
  }

  function renumberRowsInPlace() {
    // ✅ Mantém N.o incremental (1..fim), independente do conteúdo do ODS
    allRows.sort((a, b) => (Number(a?.order) || 0) - (Number(b?.order) || 0));
    for (let i = 0; i < allRows.length; i++) {
      const n = i + 1;
      allRows[i] = { ...allRows[i], order: n, aulaNumero: n };
    }
  }

  function renderNow() {
    renumberRowsInPlace();
    const info = renderGrid({
      rows: allRows,
      columns: allColumns,
      filtro: qs("#filtroPrograma")?.value || "",
      role,
      onInsertBelow: (rowId) => {
        const idx = allRows.findIndex((x) => x.rowId === rowId);
        const newRow = {
          rowId: `row_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
          order: (idx >= 0 ? idx + 1 : allRows.length + 1) + 0.1,
        };
        allRows.splice(idx >= 0 ? idx + 1 : allRows.length, 0, newRow);
        renumberRowsInPlace();
        setDirty(true);
        renderNow();
      },
      onDeleteRow: (rowId) => {
        const idx = allRows.findIndex((x) => x.rowId === rowId);
        if (idx < 0) return;
        if (!window.confirm("Excluir esta linha do programa?")) return;
        allRows.splice(idx, 1);
        renumberRowsInPlace();
        setDirty(true);
        renderNow();
      },
      onEditCell: (rowId, key, value) => {
        const idx = allRows.findIndex((x) => x.rowId === rowId);
        if (idx >= 0) {
          allRows[idx] = { ...allRows[idx], [key]: value };
          setDirty(true);
        }
      },
    });

    setMeta(`Fonte: ${programa?.source || "—"} • Linhas: ${allRows.length} • Exibindo: ${info?.shown ?? allRows.length}`);
    return info;
  }

  function buildDefaultColumnsAndRowsFromLegacy(dados) {
    const aulas = Array.isArray(dados?.aulas) ? dados.aulas : [];
    const temaMap = Array.isArray(dados?.temaMap) ? dados.temaMap : [];
    const byAulaTema = new Map(temaMap.map((t) => [Number(t.aulaNumero), t]));
    const columns = normalizeColumns([
      { key: "dataAulaISO", label: "DATA", type: "date", width: 140 },
      { key: "aulaNumero", label: "N.o", type: "number", width: 80, readonly: true },
      { key: "capitulo", label: "CAPÍTULO", type: "text", width: 90 },
      { key: "aulaTitulo", label: "AULA", type: "text", width: 300 },
      { key: "assuntos", label: "ASSUNTOS", type: "text", width: 520 },
      { key: "temaFacilitador", label: "TEMA FACILITADOR", type: "text", width: 240, rolesHidden: ["analista"] },
      { key: "email", label: "EMAIL", type: "text", width: 220, rolesHidden: ["analista"] },
      { key: "contato", label: "CONTATO", type: "text", width: 160, rolesHidden: ["analista"] },
    ]);
    const rows = aulas.map((a, idx) => {
      const n = Number(a.aulaNumero);
      const t = byAulaTema.get(n);
      return {
        rowId: `row_${idx + 1}`,
        order: idx + 1,
        dataAulaISO: "",
        aulaNumero: n,
        capitulo: "",
        aulaTitulo: t?.temaTexto || "",
        assuntos: "",
        temaFacilitador: "",
        email: "",
        contato: "",
      };
    });
    return { columns, rows };
  }

  function deriveScheduleItemsFromRows(rows) {
    return rows
      .map((r) => ({
        aulaNumero: Number(r?.aulaNumero),
        dataAulaISO: String(r?.dataAulaISO || "").trim(),
      }))
      .filter((x) => Number.isFinite(x.aulaNumero) && x.aulaNumero >= 1 && /^\d{4}-\d{2}-\d{2}$/.test(x.dataAulaISO));
  }

  async function refresh() {
    programa = await loadPrograma();
    let dados = programa?.dados || {};
    if (programa?.source === "local") {
      dados = await backfillCapituloEAulaFromBundledIfNeeded(dados);
      programa = { ...programa, dados };
    }
    allColumns = normalizeColumns(dados.columns);
    allRows = normalizeRows(dados.rows);

    const turmaId = String(qs("#programaTurmaId")?.value || "").trim();
    schedule = turmaId ? await loadProgramaSchedule(turmaId) : null;
    const byAulaDate = new Map((schedule?.items || []).map((it) => [Number(it.aulaNumero), String(it.dataAulaISO || "")]));

    // Se ainda não tem grid (schema novo), cria a partir do legado
    if (!allColumns.length || !allRows.length) {
      const legacy = buildDefaultColumnsAndRowsFromLegacy(dados);
      allColumns = legacy.columns;
      allRows = legacy.rows;
    }

    // Garante numeração incremental sempre
    renumberRowsInPlace();

    // Aplica datas do schedule (se existir) em memória
    for (const r of allRows) {
      const aulaNumero = Number(r?.aulaNumero);
      if (!Number.isFinite(aulaNumero)) continue;
      const dt = byAulaDate.get(aulaNumero);
      if (dt) r.dataAulaISO = dt;
    }
    setDirty(false);
    renderNow();
  }

  try {
    const tid = await guessTurmaId();
    if (tid) qs("#programaTurmaId").value = tid;
    await refresh();
  } catch (e) {
    setMeta("Erro ao carregar.");
    await exibirAviso({ tipo: "Erro", mensagem: e?.message || "Falha ao carregar o programa." });
  }

  qs("#filtroPrograma")?.addEventListener("input", (e) => {
    renderNow();
  });

  qs("#btnRecarregarPrograma")?.addEventListener("click", async () => {
    try { await refresh(); }
    catch (e) { await exibirAviso({ tipo: "Erro", mensagem: e?.message || "Falha ao recarregar." }); }
  });

  qs("#btnAplicarSemanal")?.addEventListener("click", async () => {
    try {
      const start = String(qs("#programaStartDate")?.value || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) throw new Error("Informe a Data da aula 1.");
      for (const r of allRows) {
        const aulaNumero = Number(r?.aulaNumero);
        if (!Number.isFinite(aulaNumero) || aulaNumero < 1) continue;
        r.dataAulaISO = addDaysISO(start, (aulaNumero - 1) * 7);
      }
      setDirty(true);
      renderNow();
      await exibirAviso({ tipo: "OK", mensagem: "Datas aplicadas semanalmente. Ajuste manualmente se necessário e clique em Salvar." });
    } catch (e) {
      await exibirAviso({ tipo: "Erro", mensagem: e?.message || "Falha ao aplicar datas." });
    }
  });

  qs("#btnAdicionarLinhaFim")?.addEventListener("click", async () => {
    allRows.push({ rowId: `row_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`, order: allRows.length + 1 });
    renumberRowsInPlace();
    setDirty(true);
    renderNow();
  });

  qs("#btnSalvarProgramaLocal")?.addEventListener("click", async () => {
    try {
      const turmaId = String(qs("#programaTurmaId")?.value || "").trim();
      if (!turmaId) throw new Error("Informe a Turma ID.");
      if (!isValidTurmaId(turmaId)) throw new Error("Turma ID inválido. Use: TurmaId + letras/números.");

      // Deriva aulas e temaMap (compat com outras rotinas)
      const aulaNums = allRows
        .map((r) => Number(r?.aulaNumero))
        .filter((n) => Number.isFinite(n) && n > 0)
        .sort((a, b) => a - b);
      const aulas = Array.from(new Set(aulaNums)).map((n) => ({ aulaNumero: n }));
      const temaByAula = new Map();
      for (const r of allRows) {
        const aulaNumero = Number(r?.aulaNumero);
        if (!Number.isFinite(aulaNumero) || aulaNumero <= 0) continue;
        const temaTexto = String(r?.aulaTitulo || r?.temaAula || r?.temaTexto || "").trim();
        if (!temaTexto) continue;
        if (!temaByAula.has(aulaNumero)) temaByAula.set(aulaNumero, { aulaNumero, temaNumero: aulaNumero, temaTexto });
      }
      const temaMap = Array.from(temaByAula.values()).sort((a, b) => a.aulaNumero - b.aulaNumero);

      const payload = {
        schemaVersion: 2,
        type: "programa_aulas_eae",
        columns: allColumns,
        rows: allRows,
        aulas,
        temaMap,
        extractedAtISO: programa?.dados?.extractedAtISO || null,
        source: programa?.dados?.source || null,
      };

      const resp = await window.api?.admin?.publishLocal?.({ turmaId, programaAulasEae: payload });
      if (!resp?.ok) throw new Error(resp?.erro || "Falha ao salvar programa.");
      setDirty(false);
      await exibirAviso({ tipo: "Sucesso", mensagem: `Programa salvo localmente (v=${resp.manifestVersion}).` });
      await refresh();
    } catch (e) {
      await exibirAviso({ tipo: "Erro", mensagem: e?.message || "Falha ao salvar programa." });
    }
  });

  qs("#btnSalvarProgramaDatas")?.addEventListener("click", async () => {
    try {
      const turmaId = String(qs("#programaTurmaId")?.value || "").trim();
      if (!turmaId) throw new Error("Informe a Turma ID.");
      if (!isValidTurmaId(turmaId)) throw new Error("Turma ID inválido. Use: TurmaId + letras/números.");

      const items = deriveScheduleItemsFromRows(allRows);
      const resp = await window.api?.admin?.publishLocal?.({
        turmaId,
        programaSchedule: {
          timezone: "America/Sao_Paulo",
          publishedAtHourLocal: "06:00",
          items,
        },
      });
      if (!resp?.ok) throw new Error(resp?.erro || "Falha ao salvar datas.");
      await exibirAviso({ tipo: "Sucesso", mensagem: `Datas salvas localmente (v=${resp.manifestVersion}).` });
      await refresh();
    } catch (e) {
      await exibirAviso({ tipo: "Erro", mensagem: e?.message || "Falha ao salvar." });
    }
  });
});
