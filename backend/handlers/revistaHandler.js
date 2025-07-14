const fs = require('fs');
const path = require('path');
const { app, ipcMain } = require('electron');

// 📁 Caminhos para salvar os arquivos localmente
const pastaRaiz = path.join(app.getPath('appData'), 'escola-aprendizes', 'revista');
const caminhoCapa = path.join(pastaRaiz, 'capa.jpg'); // sempre salvamos como capa.jpg
const caminhoControle = path.join(pastaRaiz, 'ultima-edicao.json');

// 🔄 Compatibilidade com CommonJS
async function getFetch() {
  const { default: fetch } = await import('node-fetch');
  return fetch;
}

// 🔍 Busca a última edição disponível testando diferentes nomes de capa
async function descobrirUltimaEdicaoDisponivel(base = 531, maxTentativas = 30) {
  const fetch = await getFetch();
  let edicao = base;
  let ultimaValida = null;
  let nomeCapaValido = null;

  const nomesPossiveis = ['capa.jpg', 'capa_edicao.jpg'];

  for (let i = 0; i < maxTentativas; i++) {
    let encontrou = false;

    for (const nome of nomesPossiveis) {
      const url = `https://alianca.org.br/site/trevo/${edicao}/images/${nome}`;
      console.log(`🔍 Verificando: ${url}`);

      try {
        const res = await fetch(url, { method: 'GET' });

        if (res.ok) {
          console.log(`✅ Edição ${edicao} encontrada com ${nome}`);
          ultimaValida = edicao;
          nomeCapaValido = nome;
          encontrou = true;
          break;
        } else {
          console.log(`❌ Não encontrada: ${url} (status ${res.status})`);
        }
      } catch (e) {
        console.warn(`⚠️ Erro ao verificar ${url}:`, e.message);
      }
    }

    if (!encontrou) break;
    edicao++;
  }

  if (ultimaValida && nomeCapaValido) {
    return { edicao: ultimaValida, nomeCapa: nomeCapaValido };
  } else {
    throw new Error("Nenhuma edição válida encontrada.");
  }
}

// 🧠 Verifica se há nova edição e salva a capa localmente
async function verificarAtualizacaoCapaEmSegundoPlano(base = 531, maxTentativas = 30) {
  console.log("🔄 Verificando nova capa da revista...");
  fs.mkdirSync(pastaRaiz, { recursive: true });

  let edicaoAnterior = null;

  if (fs.existsSync(caminhoControle)) {
    try {
      const json = JSON.parse(fs.readFileSync(caminhoControle, 'utf-8'));
      edicaoAnterior = json.edicao;
    } catch (e) {
      console.warn("⚠️ Erro ao ler controle anterior:", e.message);
    }
  }

  try {
    const { edicao, nomeCapa } = await descobrirUltimaEdicaoDisponivel(base, maxTentativas);

    if (edicao === edicaoAnterior && fs.existsSync(caminhoCapa)) {
      console.log("📗 Já temos a última edição:", edicao);
      return;
    }

    const url = `https://alianca.org.br/site/trevo/${edicao}/images/${nomeCapa}`;
    const fetch = await getFetch();
    const res = await fetch(url);

    if (res.ok) {
      const buffer = await res.buffer();
      fs.writeFileSync(caminhoCapa, buffer);

      fs.writeFileSync(
        caminhoControle,
        JSON.stringify(
          {
            edicao,
            nomeCapa,
            atualizado: new Date().toISOString()
          },
          null,
          2
        )
      );

      console.log("✅ Nova capa salva:", edicao, nomeCapa);
    } else {
      console.warn("❌ Falha ao baixar a capa:", res.status);
    }
  } catch (e) {
    console.error("❌ Erro durante atualização da capa:", e.message);
  }
}

// 📥 Retorna o caminho da capa local (usada no renderer)
function obterCaminhoCapaLocal() {
  if (fs.existsSync(caminhoCapa)) {
    console.log("📥 Capa local encontrada.");
    return caminhoCapa;
  } else {
    console.warn("⚠️ Nenhuma capa local disponível.");
    return null;
  }
}

// 🔌 Registra o IPC para fornecer a capa ao renderer
function registrarRevistaHandler() {
  ipcMain.handle('revista:obter-caminho-capa', () => {
    const caminho = obterCaminhoCapaLocal();
    return caminho ? `file://${caminho}` : null;
  });
}

module.exports = {
  registrarRevistaHandler,
  verificarAtualizacaoCapaEmSegundoPlano
};
