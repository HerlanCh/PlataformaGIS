// Comprueba que el bundle de la API (apps/api/dist/main.js) carga todos sus módulos. Sin variables
// de entorno debe detenerse en la validación de la configuración; cualquier otro error (por ejemplo,
// una dependencia empaquetada que no carga en ESM) hace fallar la CI antes de desplegar.
// Uso: node tools/arranque/api.mjs (después de `pnpm build`).
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const bundle = fileURLToPath(new URL('../../apps/api/dist/main.js', import.meta.url));
const { stderr, stdout } = spawnSync(process.execPath, [bundle], {
  env: { PATH: process.env.PATH ?? '' },
  encoding: 'utf8',
  timeout: 30_000,
});
const salida = `${stdout}${stderr}`;
if (!salida.includes('Configuración inválida')) {
  console.error(salida);
  console.error('El bundle de la API no llegó a validar la configuración: algún módulo no carga.');
  process.exit(1);
}
console.log('El bundle de la API carga todos sus módulos.');
