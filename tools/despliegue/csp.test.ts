import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { configuracionParaEntorno, cspParaEntorno, origenDeDsn } from './csp.mjs';

const STAGING = 'plataforma-gis-api.onrender.com';
const PRODUCCION = 'https://plataforma-gis-api-produccion.onrender.com';

const csp = [
  "default-src 'self'",
  `connect-src 'self' https://tile.openstreetmap.org https://${STAGING} wss://${STAGING}`,
  "frame-ancestors 'none'",
].join('; ');

const fuentes = (politica: string, directiva: string) =>
  politica
    .split(';')
    .map((parte) => parte.trim().split(/\s+/))
    .find(([nombre]) => nombre === directiva)!
    .slice(1);

describe('CSP por entorno (roadmap 12)', () => {
  it('RNF-13: producción solo se conecta con su propia API, no con la de staging', () => {
    const conexiones = fuentes(cspParaEntorno(csp, { urlApi: PRODUCCION }), 'connect-src');

    expect(conexiones).toEqual([
      "'self'",
      'https://tile.openstreetmap.org',
      PRODUCCION,
      'wss://plataforma-gis-api-produccion.onrender.com',
    ]);
  });

  it('RNF-13: el resto de directivas no cambia', () => {
    const politica = cspParaEntorno(csp, { urlApi: PRODUCCION });

    expect(fuentes(politica, 'default-src')).toEqual(["'self'"]);
    expect(fuentes(politica, 'frame-ancestors')).toEqual(["'none'"]);
  });

  it('RNF-13: agrega el origen de ingesta de errores del DSN', () => {
    const origen = origenDeDsn('https://clave123@app.glitchtip.com/42');
    const conexiones = fuentes(
      cspParaEntorno(csp, { urlApi: PRODUCCION, otrosOrigenes: [origen] }),
      'connect-src',
    );

    expect(origen).toBe('https://app.glitchtip.com');
    expect(conexiones).toContain('https://app.glitchtip.com');
  });

  it('RNF-13: ajusta la CSP real de vercel.json y conserva las demás cabeceras', () => {
    const configuracion = JSON.parse(
      readFileSync(new URL('../../apps/web/vercel.json', import.meta.url), 'utf8'),
    ) as { headers: { headers: { key: string; value: string }[] }[] };

    const ajustada = configuracionParaEntorno(configuracion, { urlApi: PRODUCCION });
    const cabeceras = ajustada.headers.flatMap((regla) => regla.headers);
    const politica = cabeceras.find((c) => c.key === 'Content-Security-Policy')!.value;

    expect(fuentes(politica, 'connect-src')).toContain(PRODUCCION);
    expect(politica).not.toContain(STAGING);
    expect(cabeceras.map((c) => c.key)).toEqual(
      configuracion.headers.flatMap((regla) => regla.headers).map((c) => c.key),
    );
  });
});
