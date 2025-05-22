export function inicializarCabecalho() {
    const cabecalho = document.getElementById("cabecalho");
    if (cabecalho) {
      cabecalho.innerHTML = `
        <header class="cabecalho">
          <h1>Escola de Aprendizes do Evangelho</h1>
        </header>
      `;
      console.log("✅ Cabeçalho incluído");
    } else {
      console.warn("⚠️ Elemento #cabecalho não encontrado.");
    }
  }
  