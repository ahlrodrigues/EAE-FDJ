export async function incluirCartoes() {
    const incluir = async (id, caminho) => {
      const el = document.getElementById(id);
      if (el) {
        try {
          const resposta = await fetch(caminho);
          if (resposta.ok) {
            const html = await resposta.text();
            el.innerHTML = html;
            console.log(`✅ Cartão incluído: ${id}`);
          }
        } catch (erro) {
          console.error(`❌ Erro ao incluir ${id}:`, erro);
        }
      }
    };
  
    return Promise.all([
      incluir("cartao-dirigente-container", "componentes/cartaoDirigente.html"),
      incluir("cartao2-container", "componentes/cartaoYoutubeRevista.html"),
      incluir("cartao-randomico-container", "componentes/cartaoRandomico.html"),
    ]);
  }
  