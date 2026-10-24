// `pnpm piloto:metricas <desde> <hasta> [salida.csv]` (Fase 13): días de Bolivia, ambos incluidos.
// Muestra el resumen y, con un tercer argumento, escribe los reportes del periodo en CSV.
import { ConsultarMetricas, RepositorioMetricasPg } from '@gis/module-metrics';
import { crearDb, crearPool } from '@gis/platform';
import { RAIZ_DEL_REPOSITORIO } from './clasificador.js';
import { exportarMetricas } from './piloto.js';

const [desde, hasta, destino] = process.argv.slice(2);
const url = process.env.DATABASE_URL;
if (!desde || !hasta || !url) {
  console.error('Uso: DATABASE_URL=… pnpm piloto:metricas <desde> <hasta> [salida.csv]');
  process.exit(2);
}

const pool = crearPool(url);
try {
  const salida = await exportarMetricas({
    raiz: RAIZ_DEL_REPOSITORIO,
    desde,
    hasta,
    ...(destino && { destino }),
    consultar: new ConsultarMetricas(new RepositorioMetricasPg(crearDb(pool))),
  });
  console.log(JSON.stringify(salida.resumen, null, 2));
  if (salida.csv) console.log(`${salida.filas} reportes → ${salida.csv}`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
