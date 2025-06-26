const { descriptografarComSenha } = require("./backend/lib/criptografia");

const conteudo = "zEvSyryPGTe9wZb7zpdSSw==:z7rGqs0ih7bvwDw2pxCEiEvAm3JJZxJ+uHCLFg7HXczBsrnaL5vJAYTJJ5H1/x0VQeYm06AmsPt7o9N4QH46soerOKwlTCYJKHYct8DAAmc=";
const chave = "MinhaChaveSecreta123!";

try {
  const resultado = descriptografarComSenha(conteudo, chave);
  console.log("🔓 Texto descriptografado:", resultado);
} catch (erro) {
  console.error("❌ Erro ao descriptografar:", erro.message);
}
