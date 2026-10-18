// Genera los iconos PNG de la PWA desde apps/web/public/icon.svg (Fase 8c). Los PNG se versionan:
// ejecutar de nuevo solo si cambia el icono. Uso: node tools/iconos/generar.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const publico = fileURLToPath(new URL('../../apps/web/public/', import.meta.url));
const svg = await readFile(`${publico}icon.svg`, 'utf8');

// Versión a sangre (maskable y Apple): fondo de tinta sin esquinas y el dibujo al 80 %, dentro de
// la zona segura que el sistema no recorta.
const contenido = svg.replace(/<svg[^>]*>|<\/svg>|<rect[^>]*\/>/g, '');
const aSangre = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#14181d"/>
  <g transform="translate(51.2 51.2) scale(0.8)">${contenido}</g>
</svg>`;

const iconos = [
  { archivo: 'icon-192.png', fuente: svg, lado: 192 },
  { archivo: 'icon-512.png', fuente: svg, lado: 512 },
  { archivo: 'icon-maskable-512.png', fuente: aSangre, lado: 512 },
  { archivo: 'apple-touch-icon.png', fuente: aSangre, lado: 180 },
];

for (const { archivo, fuente, lado } of iconos) {
  const png = new Resvg(fuente, { fitTo: { mode: 'width', value: lado } }).render().asPng();
  await writeFile(`${publico}${archivo}`, png);
  console.log(`${archivo} (${lado}×${lado}, ${png.length} bytes)`);
}
