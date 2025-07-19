// === buscarPlanilha.js ===

export async function buscarTemasFormatados(codigoTemas) {
  const url = `https://docs.google.com/spreadsheets/d/${codigoTemas}/gviz/tq?sheet=temas`;
  const res = await fetch(url);
  const texto = await res.text();
  const json = JSON.parse(
    texto.replace(/.*google\.visualization\.Query\.setResponse\(/s, "").slice(0, -2)
  );

  return json.table.rows.map(row => ({
    data: row.c[0]?.v || "",
    numero: row.c[1]?.v || "",
    titulo: row.c[2]?.v || "",
  }));
}

export async function buscarPlanilha(codigo, aba) {
  const url = `https://docs.google.com/spreadsheets/d/${codigo}/gviz/tq?sheet=${aba}`;
  const res = await fetch(url);
  const texto = await res.text();
  const json = JSON.parse(
    texto.replace(/.*google\.visualization\.Query\.setResponse\(/s, "").slice(0, -2)
  );

  return json.table.rows.map(row => row.c[1]?.v || "");
}
