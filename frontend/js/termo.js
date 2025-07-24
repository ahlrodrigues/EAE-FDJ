document.addEventListener("DOMContentLoaded", () => {
    const btnAceitar = document.getElementById("btnAceitar");
    const checkboxAceite = document.getElementById("checkboxAceite");
  
    if (!btnAceitar || !checkboxAceite) {
      console.warn("⚠️ Elementos do termo não encontrados.");
      return;
    }
  
    btnAceitar.addEventListener("click", async () => {
      const aceite = checkboxAceite.checked;
  
      if (!aceite) {
        if (window.api?.exibirAviso) {
          await window.api.exibirAviso({
            tipo: "Aviso",
            mensagem: "Você precisa aceitar os termos antes de continuar."
          });
        } else {
          alert("Você precisa aceitar os termos antes de continuar.");
        }
        return;
      }
  
      // ✅ Envia evento ao main que o termo foi aceito
      try {
        window.api?.enviarTermoAceito?.(); // Isso resolve a promessa da janela principal e fecha
      } catch (erro) {
        console.error("❌ Erro ao enviar aceite:", erro);
      }
    });
  });
  