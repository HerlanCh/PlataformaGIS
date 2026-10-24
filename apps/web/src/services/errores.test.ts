import { describe, expect, it, vi } from 'vitest';
import { reportarErroresDeLaVentana } from './errores.js';

const DSN = 'https://clave456@app.glitchtip.com/29131';

/** Una ventana mínima que guarda sus oyentes para dispararlos en la prueba. */
function ventanaFalsa(pathname = '/datos-abiertos') {
  const oyentes = new Map<string, (evento: unknown) => void>();
  return {
    location: { pathname } as Location,
    addEventListener: ((tipo: string, oyente: (evento: unknown) => void) => {
      oyentes.set(tipo, oyente);
    }) as Window['addEventListener'],
    disparar: (tipo: string, evento: unknown) => oyentes.get(tipo)?.(evento),
    oyentes,
  };
}

const enviados = (enviar: { mock: { calls: [string, string][] } }) =>
  enviar.mock.calls.map(([, cuerpo]) => JSON.parse(cuerpo) as Record<string, unknown>);

describe('Errores de la PWA a GlitchTip (roadmap 12)', () => {
  it('sin VITE_SENTRY_DSN no escucha nada', () => {
    const ventana = ventanaFalsa();

    expect(
      reportarErroresDeLaVentana(ventana, { dsn: undefined, version: 'v', entorno: 'e' }),
    ).toBe(false);
    expect(ventana.oyentes.size).toBe(0);
  });

  it('envía los errores no atrapados y las promesas rechazadas con la ruta, sin la consulta', async () => {
    const ventana = ventanaFalsa();
    const enviar = vi.fn<(url: string, cuerpo: string) => Promise<void>>(() => Promise.resolve());

    const activo = reportarErroresDeLaVentana(ventana, {
      dsn: DSN,
      version: 'abc123',
      entorno: 'produccion',
      enviar,
    });
    ventana.disparar('error', { error: new Error('falló el mapa'), message: 'x' });
    ventana.disparar('error', { error: null, message: 'Script error.' });
    ventana.disparar('unhandledrejection', { reason: new Error('sin red') });
    await Promise.resolve();

    expect(activo).toBe(true);
    expect(enviar.mock.calls[0]?.[0]).toContain('/api/29131/store/?sentry_key=clave456');
    expect(enviados(enviar)).toEqual([
      expect.objectContaining({
        platform: 'javascript',
        release: 'abc123',
        tags: { ruta: '/datos-abiertos' },
        exception: { values: [expect.objectContaining({ value: 'falló el mapa' })] },
      }),
      expect.objectContaining({
        exception: { values: [expect.objectContaining({ value: 'Script error.' })] },
      }),
      expect.objectContaining({
        exception: { values: [expect.objectContaining({ value: 'sin red' })] },
      }),
    ]);
  });
});
