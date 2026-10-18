// Presupuesto de la PWA (RNF de rendimiento): el JavaScript inicial comprimido debe pesar menos
// de 250 KB. Mide los scripts que carga apps/web/dist/index.html, con gzip como los sirve Vercel.
// Uso: node tools/presupuesto/js-inicial.mjs (después de `pnpm build`).
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const LIMITE_KB = 250;
const dist = fileURLToPath(new URL('../../apps/web/dist/', import.meta.url));
const html = await readFile(`${dist}index.html`, 'utf8');
const scripts = [
  ...html.matchAll(/<script[^>]+src="\/([^"]+\.js)"/g),
  ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\/([^"]+\.js)"/g),
].map((m) => m[1]);

let total = 0;
for (const script of new Set(scripts)) {
  const kb = gzipSync(await readFile(`${dist}${script}`)).length / 1024;
  total += kb;
  console.log(`${script}: ${kb.toFixed(1)} KB`);
}
console.log(`JS inicial comprimido: ${total.toFixed(1)} KB (límite ${LIMITE_KB} KB)`);
if (scripts.length === 0 || total >= LIMITE_KB) process.exit(1);
