import { describe, expect, it } from 'vitest';
import { esTesela, pluginsDeTeselas } from './teselas.js';

/**
 * Si Workbox guardaría la respuesta: sin un plugin `cacheWillUpdate`, solo guarda las de estado
 * 200; con alguno, decide la cadena de plugins.
 */
const seGuarda = async (response: Response): Promise<boolean> => {
  const plugins = pluginsDeTeselas().filter((plugin) => plugin.cacheWillUpdate);
  if (plugins.length === 0) return response.status === 200;
  let actual: Response | null = response;
  for (const plugin of plugins) {
    if (!actual || !plugin.cacheWillUpdate) continue;
    actual =
      (await plugin.cacheWillUpdate({
        response: actual,
        request: new Request('https://tile.openstreetmap.org/15/1/1.png'),
        event: new Event('fetch') as ExtendableEvent,
        state: {},
      })) ?? null;
  }
  return actual !== null;
};

// Una <img> de otro origen se pide sin CORS: el service worker recibe una respuesta opaca, con
// estado 0, y Workbox no la guarda salvo que se le permita.
// El constructor de Response no admite el estado 0: se ajusta una respuesta real.
const opaca = (): Response =>
  Object.defineProperties(new Response(null), {
    status: { value: 0 },
    type: { value: 'opaque' },
  });

describe('Teselas sin conexión', () => {
  it('HU-02: reconoce solo las teselas de OpenStreetMap', () => {
    expect(esTesela({ url: new URL('https://tile.openstreetmap.org/15/1/1.png') })).toBe(true);
    expect(esTesela({ url: new URL('https://plataforma-gis-api.onrender.com/v1') })).toBe(false);
  });

  it('HU-02: guarda en caché las teselas aunque lleguen como respuesta opaca', async () => {
    expect(await seGuarda(opaca())).toBe(true);
    expect(await seGuarda(new Response('png', { status: 200 }))).toBe(true);
  });

  it('HU-02: no guarda una tesela fallida', async () => {
    expect(await seGuarda(new Response(null, { status: 404 }))).toBe(false);
  });
});
