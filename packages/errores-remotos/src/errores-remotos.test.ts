import { describe, expect, it, vi } from 'vitest';
import {
  crearReportador,
  eventoDeError,
  leerDsn,
  marcosDe,
  reportadorNulo,
  sinDatosPersonales,
} from './index.js';

const DSN = 'https://clave123@app.glitchtip.com/29130';
const ID = '00000000-0000-4000-8000-0000000000e1';
const config = {
  entorno: 'produccion',
  version: 'abc123',
  plataforma: 'node' as const,
  generarId: () => ID,
  ahora: () => new Date('2026-10-24T12:00:00Z'),
};

const PILA_V8 = [
  'Error: falló',
  '    at buscarCercanos (/app/apps/api/dist/main.js:10:5)',
  '    at async Object.<anonymous> (/app/node_modules/fastify/lib/route.js:20:3)',
  '    at node:internal/process/task_queues:95:5',
].join('\n');

describe('Errores a GlitchTip (roadmap 12)', () => {
  it('lee el DSN y arma la URL de envío con la clave pública', () => {
    expect(leerDsn(DSN).url).toBe(
      'https://app.glitchtip.com/api/29130/store/?sentry_key=clave123&sentry_version=7',
    );
    expect(() => leerDsn('https://app.glitchtip.com/29130')).toThrow(/DSN inválido/);
    expect(() => leerDsn('https://clave@app.glitchtip.com/')).toThrow(/DSN inválido/);
  });

  it('RNF-14: quita ids, coordenadas y parámetros de URL antes de enviar', () => {
    const texto = sinDatosPersonales(
      `reporte ${ID} en -16.50012,-68.13011 de /v1/reportes?bbox=-68.2,-16.6,-68.1,-16.5&t=x`,
    );

    expect(texto).toBe('reporte <id> en <coordenada>,<coordenada> de /v1/reportes');
    expect(sinDatosPersonales('x'.repeat(900))).toHaveLength(500);
  });

  it('lee la pila de V8 y la de Firefox, del marco más antiguo al más reciente', () => {
    const v8 = marcosDe(PILA_V8);
    const gecko = marcosDe('cargar@https://web/assets/index.js?v=1:3:9\n@https://web/a.js:1:1');

    expect(v8.map((m) => m.filename)).toEqual([
      'node:internal/process/task_queues',
      '/app/node_modules/fastify/lib/route.js',
      '/app/apps/api/dist/main.js',
    ]);
    expect(v8.at(-1)).toEqual({
      function: 'buscarCercanos',
      filename: '/app/apps/api/dist/main.js',
      lineno: 10,
      colno: 5,
      in_app: true,
    });
    expect(v8.map((m) => m.in_app)).toEqual([false, false, true]);
    expect(gecko.at(-1)).toMatchObject({
      function: 'cargar',
      filename: 'https://web/assets/index.js',
    });
    expect(gecko[0]).not.toHaveProperty('function');
    expect(marcosDe(undefined)).toEqual([]);
  });

  it('RNF-14: el evento lleva la versión, el entorno y la ruta, sin datos personales', () => {
    const error = new Error(`no existe ${ID}`);
    error.stack = PILA_V8;

    const evento = eventoDeError(error, config, { ruta: '/v1/reportes/:id' });

    expect(evento).toMatchObject({
      event_id: '000000000000400080000000000000e1',
      timestamp: '2026-10-24T12:00:00.000Z',
      platform: 'node',
      environment: 'produccion',
      release: 'abc123',
      tags: { ruta: '/v1/reportes/:id' },
    });
    expect(evento.exception.values[0]).toMatchObject({ type: 'Error', value: 'no existe <id>' });
    expect(JSON.stringify(evento)).not.toContain(ID);
  });

  it('un valor que no es Error también se reporta', () => {
    const evento = eventoDeError('se cayó', config);

    expect(evento.exception.values[0]).toMatchObject({ type: 'Error', value: 'se cayó' });
    expect(evento).not.toHaveProperty('tags');
  });

  it('envía el evento sin esperar, y un envío fallido no lanza', async () => {
    const enviar = vi.fn(() => Promise.reject(new Error('sin red')));
    const reportador = crearReportador({ ...config, dsn: DSN, enviar });

    expect(() => reportador.reportar(new Error('falló'))).not.toThrow();
    await Promise.resolve();

    expect(enviar).toHaveBeenCalledOnce();
    const [url, cuerpo] = enviar.mock.calls[0] as unknown as [string, string];
    expect(url).toContain('/api/29130/store/');
    expect(JSON.parse(cuerpo)).toMatchObject({ level: 'error', release: 'abc123' });
  });

  it('si armar el evento falla, tampoco lanza', () => {
    const enviar = vi.fn(() => Promise.resolve());
    const reportador = crearReportador({
      ...config,
      dsn: DSN,
      enviar,
      generarId: () => {
        throw new Error('sin aleatoriedad');
      },
    });

    expect(() => reportador.reportar(new Error('falló'))).not.toThrow();
    expect(enviar).not.toHaveBeenCalled();
    expect(() => reportadorNulo.reportar(new Error('x'))).not.toThrow();
  });
});
