// backend/handlers/notas/salvarAnotacao.js
const fs = require("fs");
const path = require("path");
const os = require("os");
const { criptografarComMestra } = require("../../backend/lib/criptografia");

async function handleSalvarAnotacao(_, conteudo, nomeArquivo) {
  console.log("📝 [MAIN] Pedido para salvar anotação recebido.");

  try {
    const usuarioPath = path.join(os.homedir(), ".config", "escola-aprendizes", "config", "usuario.json");

    if (!fs.existsSync(usuarioPath)) {
      console.error("❌ Arquivo usuario.json não encontrado.");
      return { sucesso: false, erro: "Usuário não encontrado." };
    }

    const dadosStr = await fs.promises.readFile(usuarioPath, "utf-8");
    const dados = JSON.parse(dadosStr);

    const listaEmailHashes = Object.keys(dados.usuarios || {});
    if (listaEmailHashes.length === 0) {
      console.error("❌ Nenhum usuário encontrado no arquivo.");
      return { sucesso: false, erro: "Nenhum usuário disponível." };
    }

    const emailHash = listaEmailHashes[0]; // Você pode trocar isso se tiver um emailHash ativo
    const usuario = dados.usuarios[emailHash];

    if (!usuario?.emailHash) {
      console.error("❌ emailHash não encontrado no usuário.");
      return { sucesso: false, erro: "Usuário inválido." };
    }

    const pastaNotas = path.join(os.homedir(), ".config", "escola-aprendizes", "notas", emailHash);
    await fs.promises.mkdir(pastaNotas, { recursive: true });

    const conteudoCriptografado = criptografarComMestra(conteudo, process.env.CRYPTO_SECRET);
    const caminhoFinal = path.join(pastaNotas, nomeArquivo);

    await fs.promises.writeFile(caminhoFinal, conteudoCriptografado, "utf-8");

    console.log("✅ Anotação salva com sucesso em:", caminhoFinal);
    return { sucesso: true };
  } catch (erro) {
    console.error("❌ Erro ao salvar anotação:", erro.message);
    return { sucesso: false, erro: "Erro ao salvar anotação." };
  }
}

module.exports = { handleSalvarAnotacao };
