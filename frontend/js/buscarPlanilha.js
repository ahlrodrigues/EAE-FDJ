export async function buscarPlanilha(codigoTemas, aba) {
    const url = `https://docs.google.com/spreadsheets/d/${codigoTemas}/gviz/tq?sheet=${aba}`;
    console.log(`📥 Buscando dados da aba: ${aba}`);
    const res = await fetch(url);
    const texto = await res.text();
    const json = JSON.parse(
      texto.replace(/.*google\.visualization\.Query\.setResponse\(/s, "").slice(0, -2)
    );
    return json.table.rows.map((row) => row.c[1]?.v);
  }
  