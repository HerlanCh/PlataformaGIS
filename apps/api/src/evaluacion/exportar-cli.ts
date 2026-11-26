// `pnpm piloto:exportar <carpeta>` (ADR-007): el registro y las herramientas de evaluación, un CSV
// por tabla, contra `DATABASE_URL`.
import { ExportarEvaluacion, RepositorioExportacionPg } from '@gis/module-evaluation';
import { crearDb, crearPool } from '@gis/platform';
import { RAIZ_DEL_REPOSITORIO } from '../administracion/clasificador.js';
import { exportarACarpeta } from './piloto.js';

const [carpeta] = process.argv.slice(2);
const url = process.env.DATABASE_URL;
if (!carpeta || !url) {
  console.error('Uso: DATABASE_URL=… pnpm piloto:exportar <carpeta>');
  process.exit(2);
}

const pool = crearPool(url);
try {
  const archivos = await exportarACarpeta({
    raiz: RAIZ_DEL_REPOSITORIO,
    carpeta,
    exportar: new ExportarEvaluacion(new RepositorioExportacionPg(crearDb(pool))),
  });
  for (const archivo of archivos) console.log(`→ ${archivo}`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
