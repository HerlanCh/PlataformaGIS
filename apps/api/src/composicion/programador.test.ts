import { crearEvento, reporteCreadoV2 } from '@gis/contracts';
import { BusDeEventosEnMemoria } from '@gis/event-bus';
import { crearRegistro } from '@gis/platform';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProgramadorDeTareas, suscribirReprogramacionDeCaducidad } from './programador.js';

const registro = crearRegistro('silent');
const MINUTO = 60_000;
const HORA = 60 * MINUTO;

describe('ProgramadorDeTareas (RSK-02)', () => {
  let programador: ProgramadorDeTareas;

  beforeEach(() => {
    vi.useFakeTimers({ now: Date.parse('2026-11-22T12:00:00Z') });
    programador = new ProgramadorDeTareas(registro);
  });

  afterEach(async () => {
    await programador.detener();
    vi.useRealTimers();
  });

  const enMinutos = (minutos: number) => new Date(Date.now() + minutos * MINUTO);

  it('no solapa ejecuciones y registra un fallo sin detener la tarea', async () => {
    let llamadas = 0;
    let liberar!: () => void;
    const tarea = {
      nombre: 't',
      respaldoMs: HORA,
      ejecutar: () => {
        llamadas += 1;
        return new Promise<Date | null>((listo) => (liberar = () => listo(null)));
      },
    };

    const primera = programador.ejecutar(tarea);
    const segunda = programador.ejecutar(tarea);
    liberar();
    await Promise.all([primera, segunda]);
    await programador.ejecutar({ ...tarea, ejecutar: () => Promise.reject(new Error('x')) });

    expect(llamadas).toBe(1);
  });

  it('RSK-02: ejecuta al programar y luego en la fecha que pide la tarea, no a intervalos cortos', async () => {
    const ejecutar = vi.fn(() => Promise.resolve(enMinutos(90)));
    programador.programar({ nombre: 'caducar', respaldoMs: 6 * HORA, ejecutar });

    await vi.advanceTimersByTimeAsync(0);
    expect(ejecutar).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(89 * MINUTO);
    expect(ejecutar).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(MINUTO);
    expect(ejecutar).toHaveBeenCalledTimes(2);
  });

  it('RSK-02: sin fecha pedida espera el respaldo', async () => {
    const ejecutar = vi.fn(() => Promise.resolve(null));
    programador.programar({ nombre: 'caducar', respaldoMs: 6 * HORA, ejecutar });
    await vi.advanceTimersByTimeAsync(0);

    await vi.advanceTimersByTimeAsync(6 * HORA - 1);
    expect(ejecutar).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(ejecutar).toHaveBeenCalledTimes(2);
  });

  it('RSK-02: una fecha ya pasada se reintenta tras una espera mínima, no en un bucle', async () => {
    const ejecutar = vi.fn(() => Promise.resolve(enMinutos(-5)));
    programador.programar({ nombre: 'caducar', respaldoMs: 6 * HORA, ejecutar });

    await vi.advanceTimersByTimeAsync(999);
    expect(ejecutar).toHaveBeenCalledTimes(1);
  });

  it('RSK-02: adelantar a una fecha anterior reprograma; a una posterior, no', async () => {
    const ejecutar = vi.fn(() => Promise.resolve(enMinutos(120)));
    programador.programar({ nombre: 'caducar', respaldoMs: 6 * HORA, ejecutar });
    await vi.advanceTimersByTimeAsync(0);

    programador.adelantar('caducar', enMinutos(300));
    programador.adelantar('caducar', enMinutos(30));
    programador.adelantar('otra', enMinutos(1));

    await vi.advanceTimersByTimeAsync(30 * MINUTO);
    expect(ejecutar).toHaveBeenCalledTimes(2);
  });

  it('tras un fallo reintenta en 5 minutos', async () => {
    const ejecutar = vi.fn(() => Promise.reject(new Error('sin base')));
    programador.programar({ nombre: 'caducar', respaldoMs: 6 * HORA, ejecutar });
    await vi.advanceTimersByTimeAsync(0);

    await vi.advanceTimersByTimeAsync(5 * MINUTO);
    expect(ejecutar).toHaveBeenCalledTimes(2);
  });

  it('detenido, no vuelve a ejecutar', async () => {
    const ejecutar = vi.fn(() => Promise.resolve(enMinutos(1)));
    programador.programar({ nombre: 'caducar', respaldoMs: 6 * HORA, ejecutar });
    await vi.advanceTimersByTimeAsync(0);

    await programador.detener();
    programador.adelantar('caducar', enMinutos(0));
    await vi.advanceTimersByTimeAsync(6 * HORA);

    expect(ejecutar).toHaveBeenCalledTimes(1);
  });

  it('HU-04: un reporte nuevo que vence antes adelanta la caducidad', async () => {
    const ejecutar = vi.fn(() => Promise.resolve(null));
    programador.programar({ nombre: 'caducar-reportes', respaldoMs: 6 * HORA, ejecutar });
    await vi.advanceTimersByTimeAsync(0);
    const bus = new BusDeEventosEnMemoria();
    suscribirReprogramacionDeCaducidad(bus, programador, 'caducar-reportes');

    const vence = enMinutos(120);
    await bus.publicar(
      crearEvento(
        reporteCreadoV2,
        {
          idReporte: '00000000-0000-4000-8000-000000000001',
          codigoCategoria: 'jauria',
          publicLocation: { latitud: -16.5, longitud: -68.15 },
          estado: 'ACTIVO',
          creadoEn: new Date().toISOString(),
          caducaEn: vence.toISOString(),
          fuenteOficial: null,
        },
        { id: '00000000-0000-4000-8000-0000000000e1', ocurridoEn: new Date() },
      ),
    );

    await vi.advanceTimersByTimeAsync(120 * MINUTO);
    expect(ejecutar).toHaveBeenCalledTimes(2);
  });
});
