// Exporta las descripciones moderadas como conjunto etiquetado para el modelo de la Fase 13
// (HU-10): `pnpm clasificador:exportar <archivo.jsonl>`. Solo texto y etiqueta: sin autores,
// ubicaciones ni IDs.
import { writeFile } from 'node:fs/promises';
import { aJsonl, ExportarConjuntoEtiquetado } from '@gis/module-classifier';
import { HistorialDeDecisionesPg } from '@gis/module-moderation';
import { RepositorioReportesPostgis } from '@gis/module-reports';
import { crearDb, crearPool } from '@gis/platform';
import { fuenteDeDecisiones } from '../composicion/puentes.js';

const [destino] = process.argv.slice(2);
const url = process.env.DATABASE_URL;
if (!destino || !url) {
  console.error('Uso: DATABASE_URL=… pnpm clasificador:exportar <archivo.jsonl>');
  process.exit(2);
}

const pool = crearPool(url);
try {
  const db = crearDb(pool);
  const fuente = fuenteDeDecisiones(
    new HistorialDeDecisionesPg(db),
    new RepositorioReportesPostgis(db),
  );
  const ejemplos = await new ExportarConjuntoEtiquetado(fuente).ejecutar();
  await writeFile(destino, aJsonl(ejemplos));
  console.log(`${ejemplos.length} ejemplos → ${destino}`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
