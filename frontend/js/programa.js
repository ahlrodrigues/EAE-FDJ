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

function renderRows(rows, filtro) {
  const body = qs("#programaBody");
  if (!body) return;
  body.innerHTML = "";

  const f = normalize(filtro);
  const filtered = !f
    ? rows
    : rows.filter((r) => {
        const hay = normalize(`${r.aulaNumero} ${r.temaNumero} ${r.temaTexto || ""}`);
        return hay.includes(f);
      });

  for (const r of filtered) {
    const tr = document.createElement("tr");
    const dateVal = r.dataAulaISO || "";
    tr.innerHTML = `
      <td style="padding:10px; border-bottom:1px solid #f0f0f0;">${r.aulaNumero ?? "—"}</td>
      <td style="padding:10px; border-bottom:1px solid #f0f0f0;">${r.temaNumero ?? "—"}</td>
      <td style="padding:10px; border-bottom:1px solid #f0f0f0;">${r.temaTexto || ""}</td>
      <td style="padding:10px; border-bottom:1px solid #f0f0f0;">
        <input data-aula="${r.aulaNumero}" class="programa-data" type="date" value="${dateVal}" />
      </td>
    `;
    body.appendChild(tr);
  }

  return { total: rows.length, shown: filtered.length };
}

async function loadPrograma() {
  // Preferência: se já veio pelo pull (contentStore), usa o item local
  try {
    const local = await window.api?.content?.getItem?.("programa_aulas_eae", "global");
    if (local?.ok && local.item?.temaMap) {
      return { source: "local", dados: local.item };
    }
  } catch {}

  // Fallback: referência empacotada no app
  const res = await window.api?.programa?.getPadrao?.();
  if (!res?.ok) throw new Error(res?.erro || "Falha ao carregar programa padrão.");
  return { source: "bundled", dados: res.dados };
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
  const inputs = Array.from(document.querySelectorAll("input.programa-data"));
  return inputs
    .map((inp) => ({ aulaNumero: Number(inp.dataset.aula), dataAulaISO: String(inp.value || "").trim() }))
    .filter((x) => Number.isFinite(x.aulaNumero) && x.aulaNumero >= 1 && x.aulaNumero <= 118 && /^\d{4}-\d{2}-\d{2}$/.test(x.dataAulaISO));
}

async function saveProgramaDatasLocal({ turmaId, publishedAtHourLocal }) {
  const items = readDatesFromTable();
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
  let rows = [];
  let schedule = null;

  async function refresh() {
    programa = await loadPrograma();
    const aulas = Array.isArray(programa?.dados?.aulas) ? programa.dados.aulas : [];
    const temaMap = Array.isArray(programa?.dados?.temaMap) ? programa.dados.temaMap : [];
    const byAulaTema = new Map(temaMap.map((t) => [Number(t.aulaNumero), t]));

    const turmaId = String(qs("#programaTurmaId")?.value || "").trim();
    schedule = turmaId ? await loadProgramaSchedule(turmaId) : null;
    const byAulaDate = new Map((schedule?.items || []).map((it) => [Number(it.aulaNumero), String(it.dataAulaISO || "")]));

    rows = aulas
      .map((a) => {
        const n = Number(a.aulaNumero);
        const t = byAulaTema.get(n);
        return {
          aulaNumero: n,
          temaNumero: t?.temaNumero ?? null,
          temaTexto: t?.temaTexto || "",
          dataAulaISO: byAulaDate.get(n) || "",
        };
      })
      .sort((x, y) => (x.aulaNumero || 0) - (y.aulaNumero || 0));

    const info = renderRows(rows, qs("#filtroPrograma")?.value || "");
    setMeta(`Fonte: ${programa.source} • Temas mapeados: ${rows.length} • Exibindo: ${info?.shown ?? rows.length}`);
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
    const info = renderRows(rows, e.target.value);
    setMeta(`Fonte: ${programa?.source || "—"} • Temas mapeados: ${rows.length} • Exibindo: ${info?.shown ?? rows.length}`);
  });

  qs("#btnRecarregarPrograma")?.addEventListener("click", async () => {
    try { await refresh(); }
    catch (e) { await exibirAviso({ tipo: "Erro", mensagem: e?.message || "Falha ao recarregar." }); }
  });

  qs("#btnAplicarSemanal")?.addEventListener("click", async () => {
    try {
      const start = String(qs("#programaStartDate")?.value || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) throw new Error("Informe a Data da aula 1.");
      const inputs = Array.from(document.querySelectorAll("input.programa-data"));
      for (const inp of inputs) {
        const aulaNumero = Number(inp.dataset.aula);
        if (!Number.isFinite(aulaNumero)) continue;
        inp.value = addDaysISO(start, (aulaNumero - 1) * 7);
      }
      await exibirAviso({ tipo: "OK", mensagem: "Datas aplicadas semanalmente. Ajuste manualmente se necessário e clique em Salvar." });
    } catch (e) {
      await exibirAviso({ tipo: "Erro", mensagem: e?.message || "Falha ao aplicar datas." });
    }
  });

  qs("#btnSalvarProgramaDatas")?.addEventListener("click", async () => {
    try {
      const turmaId = String(qs("#programaTurmaId")?.value || "").trim();
      if (!turmaId) throw new Error("Informe a Turma ID.");
      if (!isValidTurmaId(turmaId)) throw new Error("Turma ID inválido. Use: TurmaId + letras/números.");
      const resp = await saveProgramaDatasLocal({ turmaId, publishedAtHourLocal: "06:00" });
      await exibirAviso({ tipo: "Sucesso", mensagem: `Datas salvas localmente (v=${resp.manifestVersion}).` });
      await refresh();
    } catch (e) {
      await exibirAviso({ tipo: "Erro", mensagem: e?.message || "Falha ao salvar." });
    }
  });
});
