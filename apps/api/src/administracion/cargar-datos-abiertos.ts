// Carga en los datos abiertos los reportes que terminaron antes de activar `open-data` (HU-11):
// `pnpm datos-abiertos:cargar`. Se puede repetir: lo ya cargado no se duplica.
import {
  CargarHistorico,
  RegistrarDatoAbierto,
  RepositorioDatosAbiertosPg,
} from '@gis/module-open-data';
import { RepositorioReportesPostgis } from '@gis/module-reports';
import { crearDb, crearPool } from '@gis/platform';
import { consultaDeReportesFinalizados } from '../composicion/puentes.js';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Uso: DATABASE_URL=… pnpm datos-abiertos:cargar');
  process.exit(2);
}

const pool = crearPool(url);
try {
  const db = crearDb(pool);
  const reportes = consultaDeReportesFinalizados(new RepositorioReportesPostgis(db));
  const registrar = new RegistrarDatoAbierto(reportes, new RepositorioDatosAbiertosPg(db));
  const nuevas = await new CargarHistorico(reportes, registrar).ejecutar();
  console.log(`datos abiertos: ${nuevas} filas nuevas`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
