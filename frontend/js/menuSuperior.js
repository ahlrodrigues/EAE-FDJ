// === menuSuperior.js ===
import { configurarLinksSubmenu } from "./relatorio.js";

// 🔧 Ativa comportamento de clique para submenus (Relatório, Escrever, etc.)
function configurarBotaoSubmenu(btnId) {
  const btn = document.getElementById(btnId);
  const submenuItem = btn?.closest(".submenu");

  if (!btn || !submenuItem) {
    console.warn(`⚠️ Botão ${btnId} ou submenu não encontrado.`);
    return;
  }

  // ⬇️ Toggle de abertura/fechamento
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    submenuItem.classList.toggle("open");
    console.log(`🔁 Toggle submenu ${btnId}`);
  });

  // ⬅️ Fecha ao clicar fora
  document.addEventListener("click", (e) => {
    if (!submenuItem.contains(e.target)) {
      submenuItem.classList.remove("open");
      console.log(`❌ Submenu ${btnId} fechado ao clicar fora`);
    }
  });
}

// ✅ Inicializa todos os submenus quando o menuSuperior estiver pronto
export function configurarMenuCompleto() {
  const menuContainer = document.getElementById("menuSuperior");

  if (!menuContainer) {
    console.warn("⚠️ Container #menuSuperior não encontrado.");
    return;
  }

  // Aguarda o carregamento do menuSuperior
  menuContainer.addEventListener("componenteCarregado", (event) => {
    if (event.detail.id === "menuSuperior") {
      console.log("✅ menuSuperior carregado, configurando submenus...");
      configurarBotaoSubmenu("relatorioBtn");
      configurarBotaoSubmenu("escreverBtn"); // ID que precisamos adicionar!
      configurarLinksSubmenu();
    }
  });
}
