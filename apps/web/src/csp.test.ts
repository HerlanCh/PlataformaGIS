// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const OSM = 'https://tile.openstreetmap.org';

interface ConfigVercel {
  readonly headers: readonly { readonly headers: readonly { key: string; value: string }[] }[];
}

const config = JSON.parse(
  readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'),
) as ConfigVercel;

const csp = config.headers
  .flatMap((regla) => regla.headers)
  .find((cabecera) => cabecera.key === 'Content-Security-Policy')!.value;

const fuentes = (directiva: string): string[] =>
  csp
    .split(';')
    .map((parte) => parte.trim().split(/\s+/))
    .find(([nombre]) => nombre === directiva)!
    .slice(1);

describe('CSP de la web (vercel.json)', () => {
  it('HU-02: el mapa puede mostrar las teselas de OpenStreetMap', () => {
    expect(fuentes('img-src')).toContain(OSM);
  });

  // El service worker guarda las teselas en caché y las pide con fetch(), que se rige por
  // connect-src. Sin este origen, el mapa queda en blanco desde la segunda visita.
  it('HU-02: el service worker puede descargar las teselas de OpenStreetMap', () => {
    expect(fuentes('connect-src')).toContain(OSM);
  });
});
