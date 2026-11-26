// `pnpm piloto:sensibilidad <carpeta> <salida.csv>` (ADR-007): el registro reprocesado con
// umbrales de 2, 3 y 4 y radios y tiempos de vida de 0,5, 1 y 1,5 veces los del SRS.
import { RAIZ_DEL_REPOSITORIO } from '../administracion/clasificador.js';
import { sensibilidadDeCarpeta } from './piloto.js';

const [carpeta, destino] = process.argv.slice(2);
if (!carpeta || !destino) {
  console.error('Uso: pnpm piloto:sensibilidad <carpeta-de-la-exportacion> <salida.csv>');
  process.exit(2);
}

try {
  const filas = await sensibilidadDeCarpeta({ raiz: RAIZ_DEL_REPOSITORIO, carpeta, destino });
  console.log(`${filas} filas (27 combinaciones) → ${destino}`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
