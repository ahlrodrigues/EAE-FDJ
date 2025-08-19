/* /frontend/js/radio-icon.js */
(() => {
    const LOG = "[IconRadio]";
    const img = document.getElementById("iconRadio");
    if (!img) return console.error(`${LOG} #iconRadio não encontrado`);
    // liga PB padrão ao carregar
    img.classList.add("pb");
    console.log(`${LOG} aplicado grayscale por CSS`);
  })();
  