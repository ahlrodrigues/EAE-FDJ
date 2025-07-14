import { configurarLinksSubmenu } from "./relatorio.js";

// 🔧 Ativa o submenu ao clicar no botão "Relatório"
export function configurarMenuRelatorio() {
  const relatorioBtn = document.getElementById('relatorioBtn');
  const submenuItem = relatorioBtn?.closest('.submenu');

  if (!relatorioBtn) {
    console.warn("⚠️ Botão #relatorioBtn não encontrado.");
    return;
  }

  if (!submenuItem) {
    console.warn("⚠️ Elemento .submenu não encontrado.");
    return;
  }

  console.log("✅ Botão Relatório encontrado:", relatorioBtn);

  relatorioBtn.addEventListener('click', (e) => {
    e.preventDefault();
    submenuItem.classList.toggle('open');
    console.log("🔁 Toggle submenu:", submenuItem.classList.contains('open'));
  });

  document.addEventListener('click', (e) => {
    if (!submenuItem.contains(e.target)) {
      submenuItem.classList.remove('open');
      console.log("❌ Submenu fechado ao clicar fora");
    }
  });
}

// ✅ Inicializa tudo depois que o menu for carregado
export function configurarMenuCompleto() {
  configurarMenuRelatorio();
  configurarLinksSubmenu();
}
