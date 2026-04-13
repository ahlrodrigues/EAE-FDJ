import { exibirAviso } from "./modalAviso.js";

const LOG = "🧭[PERFIL]";
const qs = (s) => document.querySelector(s);

function normalizeRoles(input) {
  const roles = Array.isArray(input) ? input : [];
  const cleaned = roles
    .map((r) => String(r || "").trim().toLowerCase())
    .filter(Boolean);
  return cleaned.length ? cleaned : ["aluno"];
}

function labelFor(role) {
  if (role === "analista") return "Analista";
  if (role === "dirigente") return "Dirigente";
  return "Aluno";
}

function pickDefault(roles) {
  const set = new Set(roles);
  if (set.has("aluno")) return "aluno";
  if (set.has("dirigente")) return "dirigente";
  if (set.has("analista")) return "analista";
  return roles[0] || "aluno";
}

async function setActiveRole(role) {
  const r = String(role || "").trim().toLowerCase();
  sessionStorage.setItem("activeRole", r);
  try { await window.api?.session?.setActiveRole?.(r); } catch {}
}

async function main() {
  console.log(`${LOG} init`);

  const emailHash = sessionStorage.getItem("emailHash");
  if (!emailHash) {
    window.location.href = "login.html";
    return;
  }

  const resp = await window.usuarioAPI?.lerAtual?.();
  const u = resp?.ok ? (resp.dados || {}) : {};
  const roles = normalizeRoles(u.roles);

  const meta = qs("#perfilMeta");
  if (meta) meta.textContent = `Perfis disponíveis: ${roles.map(labelFor).join(", ")}`;

  if (roles.length <= 1) {
    await setActiveRole(roles[0] || "aluno");
    window.location.href = "index.html";
    return;
  }

  const buttons = qs("#perfilButtons");
  if (!buttons) return;
  buttons.innerHTML = "";

  const makeBtn = (role, cls) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = cls;
    b.textContent = labelFor(role);
    b.addEventListener("click", async () => {
      await setActiveRole(role);
      window.location.href = "index.html";
    });
    return b;
  };

  // Ordem preferida: Aluno → Dirigente → Analista
  const order = ["aluno", "dirigente", "analista"].filter((r) => roles.includes(r));
  for (const r of order) {
    const cls = (r === "aluno") ? "btn-principal" : "btn-secundario";
    buttons.appendChild(makeBtn(r, cls));
  }

  // Se já houver activeRole válida, assume e segue
  const prev = String(sessionStorage.getItem("activeRole") || "").trim().toLowerCase();
  if (prev && roles.includes(prev)) {
    await setActiveRole(prev);
    window.location.href = "index.html";
    return;
  }

  // Default: aluno (se existir), senão o primeiro
  await setActiveRole(pickDefault(roles));
}

main().catch((e) => {
  console.warn(`${LOG} falhou`, e?.message || e);
  exibirAviso({ tipo: "Erro", mensagem: e?.message || "Falha ao selecionar perfil." });
});
