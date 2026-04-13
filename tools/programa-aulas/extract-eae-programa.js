/* eslint-disable no-console */
// Extrai o "Programa de aulas e assuntos..." do PDF EAE (Vivência) e gera JSON.
//
// Uso (2 passos, por compatibilidade com ambientes que bloqueiam spawn de binários):
//   1) pdftotext -layout -f 39 -l 60 /tmp/EAE.pdf /tmp/EAE_table_layout_39_60.txt
//   2) node tools/programa-aulas/extract-eae-programa.js /tmp/EAE_table_layout_39_60.txt backend/data/programa_aulas_eae.json

const fs = require("fs");
const path = require("path");

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function normalizeSpace(s) {
  return String(s || "")
    .replace(/\u00ad/g, "") // soft hyphen
    .replace(/\s+/g, " ")
    .trim();
}

function extractRows(layoutText) {
  const lines = String(layoutText || "").split(/\r?\n/).map((l) => l.replace(/\t/g, "    "));

  // Estratégia robusta:
  // - Detecta linhas de aula por número no início.
  // - Detecta o tema por ocorrência de "<n>- " em qualquer coluna da linha.
  // - Continua o tema em linhas seguintes usando a mesma coluna (offset).

  const rowStartRe = /^\s*(\d{1,3})\b/;
  const themeRe = /\b(\d{1,2})\s*-\s*/;

  const aulaNumeros = new Set();
  const temaMapByAula = new Map(); // aulaNumero -> {aulaNumero, temaNumero, temaTexto, _colStart}

  let inTable = false;
  let currentAulaNumero = null;
  let currentTema = null;

  for (const raw of lines) {
    const line = raw;
    const up = line.toUpperCase();

    if (!inTable) {
      if (up.includes("N0") && up.includes("AULA") && up.includes("ASSUNTOS") && up.includes("TEMAS")) {
        inTable = true;
      }
      continue;
    }

    if (/^\s*\d{3}\s*$/.test(line)) continue; // paginação "198"
    if (up.includes("VIVÊNCIA DO ESPIRITISMO RELIGIOSO")) continue;
    if (up.includes("N0") && up.includes("AULA") && up.includes("ASSUNTOS") && up.includes("TEMAS")) continue;

    const mRow = line.match(rowStartRe);
    if (mRow) {
      const aulaNumero = Number.parseInt(mRow[1], 10);
      if (!Number.isFinite(aulaNumero)) continue;
      if (aulaNumero < 1 || aulaNumero > 118) continue;

      aulaNumeros.add(aulaNumero);
      currentAulaNumero = aulaNumero;
      currentTema = null;

      const mTema = line.match(themeRe);
      if (mTema) {
        const temaNumero = Number.parseInt(mTema[1], 10);
        const idx = line.search(themeRe);
        const after = idx >= 0 ? line.slice(idx + mTema[0].length) : "";
        currentTema = {
          aulaNumero,
          temaNumero,
          temaTexto: normalizeSpace(after),
          _colStart: idx >= 0 ? idx : null,
        };
        temaMapByAula.set(aulaNumero, currentTema);
      }
      continue;
    }

    // Continuação do tema na mesma aula
    if (currentAulaNumero != null) {
      const t = temaMapByAula.get(currentAulaNumero);
      if (t && Number.isInteger(t._colStart) && line.length > t._colStart) {
        const col = normalizeSpace(line.slice(t._colStart));
        if (col) t.temaTexto = normalizeSpace(`${t.temaTexto} ${col}`);
      }
    }
  }

  const maxAula = aulaNumeros.size ? Math.max(...aulaNumeros) : 118;
  const aulas = [];
  for (let i = 1; i <= Math.min(maxAula, 118); i++) aulas.push({ aulaNumero: i });

  const temaMap = Array.from(temaMapByAula.values())
    .map((t) => ({ aulaNumero: t.aulaNumero, temaNumero: t.temaNumero, temaTexto: t.temaTexto || "" }))
    .sort((a, b) => a.aulaNumero - b.aulaNumero);

  return { aulas, temaMap };
}

function main() {
  const layoutPath = process.argv[2];
  const outPath = process.argv[3];
  if (!layoutPath) die("Uso: node tools/programa-aulas/extract-eae-programa.js <layout.txt> <saida.json>");
  if (!outPath) die("Uso: node tools/programa-aulas/extract-eae-programa.js <EAE.pdf> <saida.json>");

  const layout = fs.readFileSync(layoutPath, "utf8");
  const extracted = extractRows(layout);

  const out = {
    schemaVersion: 1,
    type: "programa_aulas_eae",
    source: {
      layout: path.basename(layoutPath),
      extractedFromPages: { from: 39, to: 60 },
    },
    extractedAtISO: new Date().toISOString(),
    aulas: extracted.aulas,
    // Mapeamento mínimo para gerar schedule (aula -> tema)
    temaMap: extracted.temaMap,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log(`OK: gerado ${outPath} com ${out.temaMap.length} temas mapeados (de ${out.aulas.length} aulas detectadas).`);
}

main();
