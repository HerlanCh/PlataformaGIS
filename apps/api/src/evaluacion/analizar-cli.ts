// `pnpm piloto:analizar <carpeta> <salida>` (ADR-007): los indicadores de beneficio y de costo de
// H1a a H1d desde la exportación, y los CSV que lee `tools/piloto/contraste.R`.
import { RAIZ_DEL_REPOSITORIO } from '../administracion/clasificador.js';
import { aMarkdown, analizarCarpeta } from './piloto.js';

const [carpeta, salida] = process.argv.slice(2);
if (!carpeta || !salida) {
  console.error('Uso: pnpm piloto:analizar <carpeta-de-la-exportacion> <carpeta-de-salida>');
  process.exit(2);
}

try {
  console.log(aMarkdown(await analizarCarpeta({ raiz: RAIZ_DEL_REPOSITORIO, carpeta, salida })));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
