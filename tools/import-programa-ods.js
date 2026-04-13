#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const XLSX = require("xlsx");

function normalizeHeader(h) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

function asNonEmptyString(v) {
  const s = String(v ?? "").trim();
  return s ? s : "";
}

function parseDateToISO_BR(ddmmyyyy) {
  const m = String(ddmmyyyy || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (!(yyyy >= 1900 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31)) return "";
  const d = new Date(yyyy, mm - 1, dd);
  if (Number.isNaN(d.getTime())) return "";
  const iso = `${String(yyyy).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  return iso;
}

function genRowId(seed) {
  return `row_${crypto.createHash("sha1").update(String(seed), "utf8").digest("hex").slice(0, 12)}`;
}

function main() {
  const input = process.argv[2] || "/home/ahlr/Downloads/PROGRAMA EAE.ods";
  const output = process.argv[3] || path.join(__dirname, "..", "backend", "data", "programa_aulas_eae.json");

  if (!fs.existsSync(input)) {
    console.error("Arquivo não encontrado:", input);
    process.exit(2);
  }

  const wb = XLSX.readFile(input);
  const sheetName = wb.SheetNames[0];
  const sh = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: "" });
  if (!rows.length) throw new Error("Planilha vazia.");

  const header = rows[0] || [];
  const headerNorm = header.map(normalizeHeader);
  const idx = (name) => headerNorm.findIndex((h) => h === normalizeHeader(name));

  const colIdx = {
    data: idx("DATA"),
    aula: idx("AULA"),
    cap: idx("Cap."),
    temaAula: idx("TEMA"),
    assunto: idx("ASSUNTO A SER ABORDADO PELO DIRIGENTE"),
    temaAtividade: (() => {
      // há 2 colunas "TEMA"; a primeira é o título da aula e a segunda costuma estar vazia/extra
      const first = idx("TEMA");
      const all = headerNorm
        .map((h, i) => ({ h, i }))
        .filter((x) => x.h === "tema")
        .map((x) => x.i);
      return all.length >= 2 ? all[1] : first;
    })(),
    facilitadores: idx("facilitadores"),
    email: idx("Email"),
    whatsapp: idx("Whatsapp"),
  };

  const columns = [
    { key: "dataAulaISO", label: "Data", type: "date", width: 140 },
    { key: "aulaNumero", label: "Aula", type: "number", width: 80 },
    { key: "capitulo", label: "Cap.", type: "text", width: 90 },
    { key: "temaAula", label: "Tema (aula)", type: "text", width: 260 },
    { key: "assuntoDirigente", label: "Assunto (dirigente)", type: "text", width: 420 },
    { key: "temaAtividade", label: "Tema (atividade)", type: "text", width: 220 },
    { key: "facilitadores", label: "Facilitadores", type: "text", width: 220, rolesHidden: ["analista"] },
    { key: "email", label: "Email", type: "text", width: 220, rolesHidden: ["analista"] },
    { key: "whatsapp", label: "Whatsapp", type: "text", width: 160, rolesHidden: ["analista"] },
  ];

  const dataRows = rows.slice(1);
  const outRows = [];

  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i] || [];
    const hasAny = r.some((v) => asNonEmptyString(v));
    if (!hasAny) continue;

    const rawData = asNonEmptyString(r[colIdx.data]);
    const dataAulaISO =
      parseDateToISO_BR(rawData) ||
      (String(rawData).trim().match(/^\d{4}-\d{2}-\d{2}$/) ? String(rawData).trim() : "");

    const aulaCell = r[colIdx.aula];
    const aulaNumero = Number.isFinite(Number(aulaCell)) ? Number(aulaCell) : asNonEmptyString(aulaCell);

    const rowObj = {
      rowId: genRowId(`${sheetName}:${i + 1}`),
      order: i + 1,
      dataAulaISO,
      aulaNumero,
      capitulo: asNonEmptyString(r[colIdx.cap]),
      temaAula: asNonEmptyString(r[colIdx.temaAula]),
      assuntoDirigente: asNonEmptyString(r[colIdx.assunto]),
      temaAtividade: asNonEmptyString(r[colIdx.temaAtividade]),
      facilitadores: asNonEmptyString(r[colIdx.facilitadores]),
      email: asNonEmptyString(r[colIdx.email]),
      whatsapp: asNonEmptyString(r[colIdx.whatsapp]),
    };

    outRows.push(rowObj);
  }

  const aulaNums = outRows
    .map((r) => Number(r.aulaNumero))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  const uniqueAulas = Array.from(new Set(aulaNums));

  const aulas = uniqueAulas.map((n) => ({ aulaNumero: n }));

  // TemaMap: por padrão, usa aulaNumero como temaNumero.
  const temaByAula = new Map();
  for (const r of outRows) {
    const aulaNumero = Number(r.aulaNumero);
    if (!Number.isFinite(aulaNumero) || aulaNumero <= 0) continue;
    const temaTexto = asNonEmptyString(r.temaAula);
    if (!temaTexto) continue;
    if (!temaByAula.has(aulaNumero)) temaByAula.set(aulaNumero, { aulaNumero, temaNumero: aulaNumero, temaTexto });
  }
  const temaMap = Array.from(temaByAula.values()).sort((a, b) => a.aulaNumero - b.aulaNumero);

  const payload = {
    schemaVersion: 2,
    type: "programa_aulas_eae",
    source: {
      file: path.basename(input),
      sheetName,
    },
    extractedAtISO: new Date().toISOString(),
    columns,
    rows: outRows,
    aulas,
    temaMap,
  };

  fs.writeFileSync(output, JSON.stringify(payload, null, 2), "utf8");
  console.log("OK:", output, `(${outRows.length} linhas)`);
}

main();
