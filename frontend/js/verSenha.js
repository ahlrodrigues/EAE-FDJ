export function inicializarBotaoVerSenha() {
    const botoes = document.querySelectorAll(".btn-olho");
  
    if (!botoes.length) {
      console.warn("👁️ Nenhum botão de 'ver senha' encontrado.");
      return;
    }
  
    botoes.forEach((botao) => {
      botao.addEventListener("click", () => {
        const campoSenha = botao.previousElementSibling;
        if (campoSenha && campoSenha.type === "password") {
          campoSenha.type = "text";
          botao.title = "Ocultar senha";
          botao.textContent = "🙈";
        } else if (campoSenha) {
          campoSenha.type = "password";
          botao.title = "Mostrar senha";
          botao.textContent = "👁️";
        }
      });
    });
  }
  