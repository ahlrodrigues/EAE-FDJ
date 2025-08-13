// === backend/handlers/temasHandler.js ===
//
// Handler de temas (listar, salvar e ler) com:
// - Caminho padronizado em Linux: ~/.config/escola-aprendizes/temas/<emailHash>/
//   (compatível com decisão do projeto; usa app.getPath("home"))
// - Logs detalhados e claros em cada etapa
// - Validações de entrada e de CRYPTO_SECRET
// - Comentários explicativos
//
// Observações:
// • Não logamos conteúdo sensível (apenas tamanhos), para não vazar dados.
// • listar-temas-salvos retorna metadados úteis (nome, caminho, tamanho, datas).
// • salvar-tema criptografa JSON(dados) com CRYPTO_SECRET.
// • ler-tema lê o arquivo e descriptografa com CRYPTO_SECRET.
//
// Dependências: electron (app), fs/promises, path, dotenv, ../lib/criptografia

const path = require("path");
const fs = require("fs/promises");
const { app } = require("electron");
const dotenv = require("dotenv");
const {
  criptografarComMestra,
  descriptografarComMestra,
} = require("../lib/criptografia");

dotenv.config();

/** Obtém a pasta base dos temas para o emailHash no padrão definido pelo projeto. */
function getTemasDir(emailHash) {
  // Decisão do projeto (#87): ~/.config/escola-aprendizes/temas/<emailHash>/
  const home = app.getPath("home"); // Ex.: /home/USER
  return path.join(home, ".config", "escola-aprendizes", "temas", String(emailHash || "").trim());
}

/** Garante que a pasta exista. */
async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

/** Valida CRYPTO_SECRET e retorna. Lança erro se ausente. */
function getChaveMestraObrigatoria() {
  const chaveMestra = process.env.CRYPTO_SECRET;
  if (!chaveMestra) {
    throw new Error("CRYPTO_SECRET não definida no .env. Impossível criptografar/descriptografar.");
  }
  return chaveMestra;
}

/**
 * Registra os handlers IPC para temas.
 * @param {Electron.IpcMain} ipc - Normalmente `ipcMain`
 */
function registrarTemasHandler(ipc) {
  if (!ipc?.handle) {
    console.error("❌ [MAIN][temas] ipc inválido passado para registrarTemasHandler.");
    return;
  }

  // 📄 Lista arquivos salvos (retorna metadados úteis)
  ipc.handle("listar-temas-salvos", async (_event, emailHash) => {
    try {
      if (!emailHash) {
        throw new Error("emailHash não informado ao listar-temas-salvos.");
      }

      const temasDir = getTemasDir(emailHash);
      console.log(`📂 [MAIN][listar-temas-salvos] Lendo diretório: ${temasDir}`);

      await ensureDir(temasDir);
      const nomes = await fs.readdir(temasDir);

      // Filtra .txt e mapeia para metadados (nome, caminho, tamanho, datas)
      const arquivosTxt = nomes.filter((n) => n.toLowerCase().endsWith(".txt"));

      // Enriquecimento com stat (tamanho e datas)
      const itens = await Promise.all(
        arquivosTxt.map(async (nome) => {
          const caminho = path.join(temasDir, nome);
          try {
            const s = await fs.stat(caminho);
            return {
              nome,
              caminho,           // caminho absoluto para uso direto no renderer (btnVer)
              tamanho: s.size,   // bytes
              mtime: s.mtimeMs,  // última modificação (ms)
              ctime: s.ctimeMs,  // criação (ms) – pode ser igual ao mtime em alguns FS
            };
          } catch (e) {
            console.warn(`⚠️ [MAIN][listar-temas-salvos] Falha ao stat ${caminho}:`, e.message);
            return { nome, caminho, erro: e.message };
          }
        })
      );

      console.log(`✅ [MAIN][listar-temas-salvos] Encontrados ${itens.length} arquivo(s) .txt.`);
      return { ok: true, dir: temasDir, itens };
    } catch (erro) {
      console.warn("📁 [MAIN][listar-temas-salvos] Nenhum tema ou erro ao ler:", erro.message);
      return { ok: false, erro: erro.message, dir: null, itens: [] };
    }
  });

  // 💾 Salvar tema criptografado
  ipc.handle("salvar-tema", async (_event, emailHash, nomeArquivo, dados) => {
    try {
      if (!emailHash) throw new Error("emailHash não informado ao salvar-tema.");
      if (!nomeArquivo) throw new Error("nomeArquivo não informado ao salvar-tema.");
      if (typeof dados === "undefined" || dados === null) {
        throw new Error("dados (conteúdo) não informado ao salvar-tema.");
      }

      const pasta = getTemasDir(emailHash);
      await ensureDir(pasta);

      const chaveMestra = getChaveMestraObrigatoria();
      // Armazenamos como JSON criptografado (pode ser {numero,titulo,texto} ou similar)
      const conteudoJson = JSON.stringify(dados);
      const conteudoCriptografado = criptografarComMestra(conteudoJson, chaveMestra);

      const caminho = path.join(pasta, nomeArquivo);
      await fs.writeFile(caminho, conteudoCriptografado, "utf8");

      console.log(`🔐 [MAIN][salvar-tema] Salvo com sucesso: ${caminho} (bytes criptografados: ${conteudoCriptografado.length})`);
      return { ok: true, caminho };
    } catch (erro) {
      console.error("❌ [MAIN][salvar-tema] Erro ao salvar tema:", erro.message);
      return { ok: false, erro: erro.message };
    }
  });

  // 📖 Ler tema (descriptografar) para exibir no modal (btnVer)
  ipc.handle("ler-tema", async (_event, caminhoArquivoAbsoluto) => {
    try {
      if (!caminhoArquivoAbsoluto) {
        throw new Error("Caminho do arquivo não informado ao ler-tema.");
      }

      console.log(`📄 [MAIN][ler-tema] Lendo arquivo: ${caminhoArquivoAbsoluto}`);
      const brutoCripto = await fs.readFile(caminhoArquivoAbsoluto, "utf8");
      console.log(`📥 [MAIN][ler-tema] Conteúdo criptografado lido (bytes: ${brutoCripto.length})`);

      const chaveMestra = getChaveMestraObrigatoria();
      const textoDescriptografado = descriptografarComMestra(brutoCripto, chaveMestra);

      // Tenta interpretar como JSON de tema; se falhar, retorna como texto puro
      let parsed = null;
      try {
        parsed = JSON.parse(textoDescriptografado);
      } catch {
        // texto puro
      }

      const payload = parsed
        ? { tipo: "json", dados: parsed }
        : { tipo: "texto", dados: textoDescriptografado };

      console.log(`🔓 [MAIN][ler-tema] Descriptografia concluída. Tipo: ${payload.tipo}`);
      return { ok: true, ...payload };
    } catch (erro) {
      console.error("❌ [MAIN][ler-tema] Erro ao ler/descriptografar:", erro.message);
      return { ok: false, erro: erro.message };
    }
  });
}

module.exports = { registrarTemasHandler };
