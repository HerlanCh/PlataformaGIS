// Migraciones compatibles hacia atrás (roadmap 12): el pipeline migra antes de arrancar la versión
// nueva, así que la versión anterior sigue corriendo un momento sobre el esquema nuevo, y revertir
// la API no revierte la base. Por eso una migración de avance solo puede agregar ("agregar antes de
// quitar"). Una operación destructiva pasa solo si su sentencia lleva `-- compatible: <razón>`.
// Uso: node tools/migraciones/verificar-compatibles.mjs
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Operaciones que rompen a la versión anterior de la API si la base ya las aplicó. */
export const OPERACIONES_DESTRUCTIVAS = [
  { nombre: 'borrar tabla', patron: /\bdrop\s+table\b/i },
  { nombre: 'borrar columna', patron: /\bdrop\s+column\b/i },
  { nombre: 'renombrar', patron: /\brename\b/i },
  { nombre: 'cambiar tipo', patron: /\balter\s+column\s+\S+\s+(set\s+data\s+)?type\b/i },
  { nombre: 'exigir no nulo', patron: /\bset\s+not\s+null\b/i },
];

const JUSTIFICACION = /--\s*compatible:\s*\S/i;

/** Sentencias de una migración de Drizzle, separadas por `--> statement-breakpoint` o `;`. */
function sentencias(sql) {
  return sql
    .split(/-->\s*statement-breakpoint|;\s*\n/)
    .map((sentencia) => sentencia.trim())
    .filter(Boolean);
}

/** Quita los comentarios de línea para no confundir el texto de un comentario con SQL. */
const sinComentarios = (sentencia) => sentencia.replaceAll(/--.*$/gm, '');

/**
 * Hallazgos de una migración de avance: cada sentencia destructiva sin justificación.
 * @param {string} sql
 * @returns {{ operacion: string, sentencia: string }[]}
 */
export function analizarMigracion(sql) {
  const hallazgos = [];
  for (const sentencia of sentencias(sql)) {
    if (JUSTIFICACION.test(sentencia)) continue;
    const codigo = sinComentarios(sentencia);
    for (const { nombre, patron } of OPERACIONES_DESTRUCTIVAS) {
      if (patron.test(codigo)) hallazgos.push({ operacion: nombre, sentencia: codigo.trim() });
    }
  }
  return hallazgos;
}

/** Migraciones de avance (no `.down.sql`) de la plataforma y de cada módulo. */
async function migracionesDeAvance(raiz) {
  const carpetas = [path.join(raiz, 'packages/platform/migrations')];
  for (const modulo of await readdir(path.join(raiz, 'packages/modules'))) {
    carpetas.push(path.join(raiz, 'packages/modules', modulo, 'migrations'));
  }
  const archivos = [];
  for (const carpeta of carpetas) {
    const nombres = await readdir(carpeta).catch(() => []);
    for (const nombre of nombres) {
      if (nombre.endsWith('.sql') && !nombre.endsWith('.down.sql')) {
        archivos.push(path.join(carpeta, nombre));
      }
    }
  }
  return archivos;
}

async function principal() {
  const raiz = fileURLToPath(new URL('../../', import.meta.url));
  const archivos = await migracionesDeAvance(raiz);
  let total = 0;
  for (const archivo of archivos) {
    for (const { operacion, sentencia } of analizarMigracion(await readFile(archivo, 'utf8'))) {
      total += 1;
      console.error(`${path.relative(raiz, archivo)}: ${operacion} sin justificar\n  ${sentencia}`);
    }
  }
  if (total > 0) {
    console.error(
      `\n${total} operación(es) destructiva(s). Agrega antes de quitar, o justifica la sentencia ` +
        'con `-- compatible: <razón>` si la versión anterior de la API no la usa.',
    );
    process.exit(1);
  }
  console.log(`${archivos.length} migraciones de avance, todas compatibles hacia atrás.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await principal();
