import { configurarLinksSubmenu } from "./relatorio.js";

// 🔧 Configura automaticamente os botões de submenu
function observarBotaoSubmenu(btnId) {
  const menuContainer = document.getElementById("menuSuperior");

  if (!menuContainer) {
    console.warn("⚠️ Container #menuSuperior não encontrado.");
    return;
  }

  const observer = new MutationObserver((mutations, obs) => {
    const btn = document.getElementById(btnId);
    const submenuItem = btn?.closest('.submenu');

    if (btn && submenuItem) {
      console.log(`✅ Botão ${btnId} detectado via observer`);

      // Ativa submenu
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        submenuItem.classList.toggle("open");
        console.log(`🔁 Toggle submenu ${btnId}`);
      });

      // Fecha ao clicar fora
      document.addEventListener("click", (e) => {
        if (!submenuItem.contains(e.target)) {
          submenuItem.classList.remove("open");
          console.log(`❌ Submenu ${btnId} fechado ao clicar fora`);
        }
      });

      // Interrompe a observação depois de encontrado
      obs.disconnect();
    }
  });

  observer.observe(menuContainer, { childList: true, subtree: true });
}

// ✅ Inicializa todos os menus assim que carregados
export function configurarMenuCompleto() {
  setTimeout(() => 
      'relatorioBtn',
      'escreverBtn',
    );
    configurarLinksSubmenu();
  } 100 // tempo suficiente para garantir que o submenu foi incluso


