// === js/incluirComponentes.js ===
// Carrega cabeçalho, menuSuperior, rodapé e modalAviso se os elementos existirem

export const componentesCarregados = (async function incluirComponentes() {
  const incluirHTML = async (id, arquivo) => {
    console.log(`🔍 Procurando #${id} para injetar ${arquivo}`);
    const el = document.getElementById(id);

    if (!el) {
      console.warn(`⚠️ Elemento #${id} não encontrado no DOM. Ignorando ${arquivo}`);
      return;
    }

    try {
      const resposta = await fetch(arquivo);
      if (resposta.ok) {
        const html = await resposta.text();
        el.innerHTML = html;
        console.log(`✅ Componente incluído em #${id}: ${arquivo}`);
      } else {
        console.error(`❌ Falha ao carregar ${arquivo}: status ${resposta.status}`);
      }
    } catch (erro) {
      console.error(`❌ Erro ao carregar ${arquivo}:`, erro);
    }
  };

  // Cabeçalho sempre incluso se existir
  await incluirHTML("cabecalho", "componentes/cabecalho.html");

  // 🔐 Menu superior só é incluído se houver sessão ativa
  const emailHash = sessionStorage.getItem("emailHash");
  if (emailHash) {
    await incluirHTML("menuSuperior", "componentes/menuSuperior.html");
  } else {
    console.log("⛔ Nenhuma sessão ativa (emailHash). Menu superior não será carregado.");
  }

  // Rodapé sempre incluso se existir
  await incluirHTML("rodape", "componentes/rodape.html");

  // Modal de aviso (usado em todas as telas)
  await incluirHTML("modalAvisoContainer", "componentes/modalAviso.html");
  
  // Regras de senha
  await incluirHTML("senhaRegrasContainer", "componentes/senhaRegras.html");


})();

function normalizeRoles(input) {
  const roles = Array.isArray(input) ? input : [];
  const cleaned = roles
    .map((r) => String(r || "").trim().toLowerCase())
    .filter(Boolean);
  return cleaned.length ? cleaned : ["aluno"];
}

function primaryRole(roles) {
  const set = new Set(normalizeRoles(roles));
  if (set.has("analista")) return "analista";
  if (set.has("dirigente")) return "dirigente";
  return "aluno";
}

async function getRolesFromSessionOrDefault() {
  try {
    const resp = await window.usuarioAPI?.lerAtual?.();
    const u = resp?.ok ? (resp.dados || {}) : {};
    return normalizeRoles(u.roles);
  } catch {
    return ["aluno"];
  }
}

function applyRoleVisibility(rootEl, roles) {
  const set = new Set(normalizeRoles(roles));
  const nodes = Array.from((rootEl || document).querySelectorAll("[data-roles]"));
  for (const el of nodes) {
    const required = String(el.getAttribute("data-roles") || "")
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
    const allowed = required.length === 0 || required.some((r) => set.has(r));
    el.style.display = allowed ? "" : "none";
  }
}

function applyRoleTheme(roles) {
  const role = primaryRole(roles);
  try {
    document.documentElement.dataset.role = role;
    document.documentElement.dataset.roles = normalizeRoles(roles).join(",");
  } catch {}
}

async function applyRoleUi() {
  try {
    const roles = await getRolesFromSessionOrDefault();
    applyRoleVisibility(document, roles);
    applyRoleTheme(roles);
  } catch (e) {
    console.warn("[Componentes] falha ao aplicar UI por roles:", e?.message || e);
  }
}

componentesCarregados.then(async () => {
  const menuEl = document.getElementById("menuSuperior");
  if (menuEl && menuEl.querySelector("#webRadioImg") && menuEl.querySelector("#webRadioPlayer")) {
    console.log("[Componentes] menuSuperior injetado com sucesso (contém rádio).");
    window.dispatchEvent(new CustomEvent("menu:ready", { detail: { source: "menuSuperior" } }));
  } else if (menuEl) {
    console.warn("[Componentes] menuSuperior injetado, mas rádio não encontrado (verifique IDs).");
  }

  await applyRoleUi();
});

// 🔔 Inicializa cliente de sync (WS opcional) quando houver sessão
try {
  const getEnv = (k) => {
    try { return window.nativo?.getEnv?.(k); } catch { return null; }
  };
  const flag = (k) => {
    const v = String(getEnv(k) || "").trim().toLowerCase();
    return v === "1" || v === "true" || v === "yes" || v === "on";
  };

  const emailHash = sessionStorage.getItem("emailHash");
  const devAllowOnLogin = flag("SYNC_DEV_WS_ON_LOGIN") || flag("SYNC_DEV_AUTO_PULL");

  if (emailHash || devAllowOnLogin) {
    import("./syncWsClient.js")
      .then((m) => m.startSyncWsClient?.())
      .catch((e) => console.warn("⚠️ [syncWS] falha ao iniciar:", e?.message || e));
  }
} catch {}
