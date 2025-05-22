export function inicializarRodape() {
    const anoInicial = 2025;
    const anoAtual = new Date().getFullYear();
    const nomeProjeto = "Escola de Aprendizes do Evangelho";
  
    const textoCopyright =
      anoInicial === anoAtual
        ? `© ${anoAtual} ${nomeProjeto}. Todos os direitos reservados.`
        : `© ${anoInicial}-${anoAtual} ${nomeProjeto}. Todos os direitos reservados.`;
  
    const marcaRegistrada = '<a href="https://www.alianca.org.br" target="_blank" style="color: #1e7e34; text-decoration: none;">Aliança Espírita Evangélica</a>';
  
    const footerInfo = document.getElementById("footerInfo");
    const footerTrademark = document.getElementById("footerTrademark");
  
    if (footerInfo) {
      footerInfo.textContent = textoCopyright;
      footerInfo.style.color = "#1e7e34";
      footerInfo.style.textAlign = "center";
    }
  
    if (footerTrademark) {
      footerTrademark.innerHTML = marcaRegistrada;
      footerTrademark.style.color = "#1e7e34";
      footerTrademark.style.textAlign = "center";
    }
  }
  