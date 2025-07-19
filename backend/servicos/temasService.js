// === backend/servicos/temasService.js ===

import fs from "fs/promises";
import path from "path";
import { app } from "electron";
import { criptografar } from "../lib/crypto.js";

// 📁 Caminho base da pasta de temas por usuário
function getPastaTemas(emailHash) {
  const base = app.getPath("appData");
  return path.join(base, "escola-aprendizes", "temas", emailHash);
}

// 💾 Salva o tema criptografado
export async function salvarTema(emailHash, nomeArquivo, dados) {
  const pasta = getPastaTemas(emailHash);
  await fs.mkdir(pasta, { recursive: true });

  const conteudo = `Data: ${dados.data}\nNúmero: ${dados.numero}\nTema: ${dados.titulo}\n\n${dados.texto}`;
  const conteudoCriptografado = criptografar(conteudo);

  const caminho = path.join(pasta, nomeArquivo);
  await fs.writeFile(caminho, conteudoCriptografado, "utf-8");

  console.log("📝 Tema salvo em:", caminho);
}
