// Análisis del piloto (Fase 13): compara la plataforma con el grupo de WhatsApp vecinal en los tres
// indicadores del Propósito de la matriz de marco lógico (docs/marco-logico.md):
// 1. tiempo hasta que aparece un incidente;
// 2. porcentaje de reportes ciertos;
// 3. tiempo que sigue visible un reporte que ya no es cierto.
// Uso: node tools/piloto/analizar.mjs <metricas.csv> <whatsapp.csv> <verificacion.csv> <fin> [salida.md]
// `metricas.csv` sale de `pnpm piloto:metricas`; las otras dos planillas, de docs/piloto/. `fin` es el
// último instante del piloto (ISO 8601): lo que nunca se corrigió cuenta como visible hasta ahí.
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

/**
 * Registros del CSV: un salto de línea dentro de comillas no corta el registro.
 * @param {string} texto
 */
function registros(texto) {
  const resultado = [];
  let pendiente = null;
  let comillas = 0;
  for (const linea of texto.split(/\r?\n/)) {
    pendiente = pendiente === null ? linea : `${pendiente}\n${linea}`;
    comillas += linea.split('"').length - 1;
    if (comillas % 2 === 0) {
      resultado.push(pendiente);
      pendiente = null;
      comillas = 0;
    }
  }
  if (pendiente !== null) resultado.push(pendiente);
  return resultado;
}

/**
 * Campos de un registro. Admite comas y comillas dobladas dentro de un campo entre comillas.
 * @param {string} registro
 */
function campos(registro) {
  const valores = [];
  let campo = '';
  let entreComillas = false;
  for (let i = 0; i < registro.length; i += 1) {
    const c = registro[i];
    if (c === '"' && entreComillas && registro[i + 1] === '"') {
      campo += '"';
      i += 1;
    } else if (c === '"') entreComillas = !entreComillas;
    else if (c === ',' && !entreComillas) {
      valores.push(campo);
      campo = '';
    } else campo += c;
  }
  valores.push(campo);
  return valores;
}

/**
 * CSV con encabezado a una lista de objetos, como lo exporta una hoja de cálculo.
 * @param {string} texto
 * @returns {Record<string, string>[]}
 */
export function leerCsv(texto) {
  const [encabezado = [], ...datos] = registros(texto)
    .filter((r) => r.trim() !== '')
    .map(campos);
  return datos.map((f) =>
    Object.fromEntries(encabezado.map((nombre, j) => [nombre.trim(), (f[j] ?? '').trim()])),
  );
}

// ISO 8601 con zona horaria: `2026-11-03T08:00-04:00`. `Date.parse` aceptaría «3/11/2026» como 11 de
// marzo, sin avisar.
const ISO_CON_ZONA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** @param {string} valor */
const fecha = (valor) => {
  if (!valor) return null;
  const ms = ISO_CON_ZONA.test(valor) ? Date.parse(valor) : Number.NaN;
  if (Number.isNaN(ms)) throw new Error(`Fecha inválida (usa 2026-11-03T08:00-04:00): ${valor}`);
  return ms;
};

/** @param {number} ms */
const minutos = (ms) => Math.round((ms / 60_000) * 10) / 10;

/**
 * Mediana (rango más cercano por arriba en muestras pares, como en el módulo `metrics`).
 * @param {number[]} valores
 */
export function mediana(valores) {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  return ordenados[Math.max(1, Math.ceil(ordenados.length / 2)) - 1];
}

/** @param {number} parte @param {number} total */
const porcentaje = (parte, total) => (total === 0 ? null : Math.round((parte / total) * 1000) / 10);

/**
 * Indicador 1: para cada incidente del grupo emparejado con un reporte, minutos entre que se
 * publicó en WhatsApp y que se creó en la plataforma. Negativo: la plataforma fue antes.
 */
export function tiempoDeAparicion(whatsapp, metricas) {
  const creadoEn = new Map(metricas.map((m) => [m.id_reporte, fecha(m.creado_en)]));
  const diferencias = [];
  for (const w of whatsapp) {
    const enPlataforma = w.id_reporte_plataforma && creadoEn.get(w.id_reporte_plataforma);
    if (enPlataforma) diferencias.push(minutos(enPlataforma - fecha(w.publicado_en)));
  }
  return {
    incidentesDelGrupo: whatsapp.length,
    emparejados: diferencias.length,
    plataformaAntes: diferencias.filter((d) => d < 0).length,
    medianaMinutos: mediana(diferencias),
  };
}

/** Indicador 2: ciertos sobre los que se pudo comprobar (`si` o `no`). */
export function porcentajeDeCiertos(filas) {
  const comprobados = filas.filter((f) => f.cierto === 'si' || f.cierto === 'no');
  const ciertos = comprobados.filter((f) => f.cierto === 'si').length;
  return {
    total: filas.length,
    comprobados: comprobados.length,
    ciertos,
    porcentaje: porcentaje(ciertos, comprobados.length),
  };
}

/**
 * Indicador 3: minutos que un reporte siguió visible después de dejar de ser cierto. En la
 * plataforma deja de verse al cerrarse; en el grupo, cuando alguien lo desmiente. Lo que nunca
 * se cerró ni se desmintió cuenta hasta `fin`.
 */
export function tiempoVisibleSinSerCierto(filas, finDeVisibilidad, fin) {
  const tiempos = [];
  let sinCorregir = 0;
  for (const f of filas) {
    const dejo = fecha(f.dejo_de_ser_cierto_en);
    if (!dejo) continue;
    const corregido = finDeVisibilidad(f);
    if (!corregido) sinCorregir += 1;
    tiempos.push(minutos(Math.max(0, (corregido ?? fin) - dejo)));
  }
  return { casos: tiempos.length, sinCorregir, medianaMinutos: mediana(tiempos) };
}

/** Los tres indicadores, plataforma frente a grupo. */
export function analizar({ metricas, whatsapp, verificacion, fin }) {
  const finMs = fecha(fin);
  const cerradoEn = new Map(metricas.map((m) => [m.id_reporte, fecha(m.cerrado_en)]));
  // Solo los reportes de la comunidad: los oficiales los publica un moderador (HU-13).
  const oficiales = new Set(
    metricas.filter((m) => m.es_oficial === 'true').map((m) => m.id_reporte),
  );
  const verificados = verificacion.filter((v) => !oficiales.has(v.id_reporte));
  return {
    aparicion: tiempoDeAparicion(whatsapp, metricas),
    ciertos: {
      plataforma: porcentajeDeCiertos(verificados),
      whatsapp: porcentajeDeCiertos(whatsapp),
    },
    visibleSinSerCierto: {
      plataforma: tiempoVisibleSinSerCierto(verificados, (v) => cerradoEn.get(v.id_reporte), finMs),
      whatsapp: tiempoVisibleSinSerCierto(whatsapp, (w) => fecha(w.desmentido_en), finMs),
    },
  };
}

/** @param {number | null} valor @param {string} unidad */
const cifra = (valor, unidad = '') =>
  valor === null ? 'sin datos' : `${String(valor).replace('.', ',')}${unidad}`;

/** Informe en Markdown para `docs/piloto/resultados.md`. */
export function aMarkdown(r, fin) {
  const { aparicion: a, ciertos: c, visibleSinSerCierto: v } = r;
  return `# Resultados del piloto: plataforma frente al grupo de WhatsApp

Generado con \`node tools/piloto/analizar.mjs\`. Fin del periodo: ${fin}. Indicadores del Propósito de la
[matriz de marco lógico](../marco-logico.md). Solo reportes de la comunidad: los incidentes oficiales (HU-13) no
cuentan.

## 1. Tiempo hasta que aparece un incidente

| Medida | Valor |
| :-- | --: |
| Incidentes registrados en el grupo | ${a.incidentesDelGrupo} |
| Emparejados con un reporte de la plataforma | ${a.emparejados} |
| La plataforma lo mostró antes | ${a.plataformaAntes} de ${a.emparejados} |
| Mediana plataforma − grupo | ${cifra(a.medianaMinutos, ' min')} |

Un valor negativo significa que la plataforma lo mostró antes que el grupo.

## 2. Porcentaje de reportes ciertos

| | Comprobados | Ciertos | Porcentaje |
| :-- | --: | --: | --: |
| Plataforma | ${c.plataforma.comprobados} de ${c.plataforma.total} | ${c.plataforma.ciertos} | ${cifra(c.plataforma.porcentaje, ' %')} |
| Grupo de WhatsApp | ${c.whatsapp.comprobados} de ${c.whatsapp.total} | ${c.whatsapp.ciertos} | ${cifra(c.whatsapp.porcentaje, ' %')} |

## 3. Tiempo visible después de dejar de ser cierto

| | Casos | Nunca se corrigieron | Mediana |
| :-- | --: | --: | --: |
| Plataforma (hasta que se cierra) | ${v.plataforma.casos} | ${v.plataforma.sinCorregir} | ${cifra(v.plataforma.medianaMinutos, ' min')} |
| Grupo (hasta que alguien lo desmiente) | ${v.whatsapp.casos} | ${v.whatsapp.sinCorregir} | ${cifra(v.whatsapp.medianaMinutos, ' min')} |
`;
}

async function principal() {
  const [metricas, whatsapp, verificacion, fin, salida] = process.argv.slice(2);
  if (!metricas || !whatsapp || !verificacion || !fin) {
    console.error(
      'Uso: node tools/piloto/analizar.mjs <metricas.csv> <whatsapp.csv> <verificacion.csv> <fin> [salida.md]',
    );
    process.exit(2);
  }
  const leer = async (ruta) => leerCsv(await readFile(ruta, 'utf8'));
  const resultado = analizar({
    metricas: await leer(metricas),
    whatsapp: await leer(whatsapp),
    verificacion: await leer(verificacion),
    fin,
  });
  const informe = aMarkdown(resultado, fin);
  if (salida) await writeFile(salida, informe);
  else console.log(informe);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await principal();
