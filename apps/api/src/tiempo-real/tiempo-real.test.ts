import { crearEvento, reporteCaducadoV1, reporteCreadoV1, votoEmitidoV1 } from '@gis/contracts';
import type { BusDeEventos } from '@gis/event-bus';
import { cargarInterruptores, crearRegistro } from '@gis/platform';
import type { Db } from '@gis/platform';
import { celdaDe, idReporte, idUsuario, PuntoGeo } from '@gis/shared-kernel';
import { describe, expect, it, vi } from 'vitest';
import {
  EnviadorDeNotificacionesEnRegistro,
  suscribirManejadores,
} from '../composicion/manejadores.js';
import { ProgramadorDeTareas } from '../composicion/programador.js';
import { generadorUuid, relojDelSistema } from '../composicion/casos-de-uso.js';
import { CLAVES_PUBLICAS, crearPublicador } from './publicador.js';
import { MAX_SALAS_POR_CLIENTE, salasDePunto, salasDeVentana } from './salas.js';

const ID = '6f1c2f0e-3b7a-4d2a-9c58-0a4f5b1d2e3f';
const laPaz = PuntoGeo.crear(-16.5, -68.15);
const sobre = { id: '00000000-0000-4000-8000-000000000001', ocurridoEn: new Date() };

describe('salas', () => {
  it('una ventana de barrio usa celdas finas (precisión 6)', () => {
    const salas = salasDeVentana({
      latitudMin: -16.505,
      latitudMax: -16.495,
      longitudMin: -68.155,
      longitudMax: -68.145,
    });

    expect(salas).toContain(`celda:${celdaDe(laPaz, 6)}`);
    expect(salas!.every((s) => s.length === 'celda:'.length + 6)).toBe(true);
  });

  it('una ventana de toda la ciudad usa celdas gruesas y no pasa del máximo', () => {
    const salas = salasDeVentana({
      latitudMin: -16.67,
      latitudMax: -16.38,
      longitudMin: -68.33,
      longitudMax: -68.0,
    });

    expect(salas!.length).toBeLessThanOrEqual(MAX_SALAS_POR_CLIENTE);
    expect(salas!.every((s) => s.length === 'celda:'.length + 5)).toBe(true);
  });

  it('una ventana del tamaño de un país no se admite', () => {
    expect(
      salasDeVentana({ latitudMin: -22, latitudMax: -10, longitudMin: -69, longitudMax: -58 }),
    ).toBeNull();
  });

  it('un punto pertenece a su celda fina y a su celda gruesa', () => {
    expect(salasDePunto(laPaz)).toEqual([
      `celda:${celdaDe(laPaz, 6)}`,
      `celda:${celdaDe(laPaz, 5)}`,
    ]);
  });
});

describe('publicador en Socket.io', () => {
  it('ReporteCreado se difunde a la celda de su ubicación pública, sin consultar', async () => {
    const difundir = vi.fn();
    const ubicacion = vi.fn();
    const creado = crearEvento(
      reporteCreadoV1,
      {
        idReporte: ID,
        codigoCategoria: 'bloqueo',
        publicLocation: { latitud: -16.5, longitud: -68.15 },
        estado: 'ACTIVO',
        creadoEn: sobre.ocurridoEn.toISOString(),
        caducaEn: sobre.ocurridoEn.toISOString(),
      },
      sobre,
    );

    await crearPublicador({ difundir }, ubicacion)(creado);

    expect(ubicacion).not.toHaveBeenCalled();
    expect(difundir).toHaveBeenCalledWith(creado, laPaz);
  });

  it('los demás eventos consultan la ubicación pública; sin reporte no se difunden', async () => {
    const difundir = vi.fn();
    const caducado = crearEvento(reporteCaducadoV1, { idReporte: ID }, sobre);

    await crearPublicador({ difundir }, () => Promise.resolve(laPaz))(caducado);
    await crearPublicador({ difundir }, () => Promise.resolve(null))(caducado);

    expect(difundir).toHaveBeenCalledOnce();
    expect(difundir).toHaveBeenCalledWith(caducado, laPaz);
  });

  it('solo los eventos públicos llegan a los clientes', () => {
    expect(CLAVES_PUBLICAS).toContain('ReporteCreado.v1');
    expect(CLAVES_PUBLICAS).not.toContain(votoEmitidoV1.clave);
    expect(CLAVES_PUBLICAS).not.toContain('ReporteDuplicadoDetectado.v1');
  });
});

describe('ProgramadorDeTareas', () => {
  const registro = crearRegistro('silent');

  it('no solapa ejecuciones y registra un fallo sin detener la tarea', async () => {
    const programador = new ProgramadorDeTareas(registro);
    let llamadas = 0;
    let liberar!: () => void;
    const tarea = {
      nombre: 't',
      intervaloMs: 60_000,
      ejecutar: () => {
        llamadas += 1;
        return new Promise<void>((listo) => (liberar = listo));
      },
    };

    const primera = programador.ejecutar(tarea);
    const segunda = programador.ejecutar(tarea);
    liberar();
    await Promise.all([primera, segunda]);
    await programador.ejecutar({ ...tarea, ejecutar: () => Promise.reject(new Error('x')) });

    expect(llamadas).toBe(1);
  });

  it('ejecuta la tarea en cada intervalo hasta que se detiene', async () => {
    vi.useFakeTimers();
    const programador = new ProgramadorDeTareas(registro);
    const ejecutar = vi.fn(() => Promise.resolve(0));
    programador.programar({ nombre: 'p', intervaloMs: 1000, ejecutar });

    await vi.advanceTimersByTimeAsync(3500);
    await programador.detener();
    await vi.advanceTimersByTimeAsync(3000);
    vi.useRealTimers();

    expect(ejecutar).toHaveBeenCalledTimes(3);
  });
});

describe('suscripción de manejadores', () => {
  const busQueAnota = () => {
    const suscritos: [string, string][] = [];
    const bus: BusDeEventos = {
      publicar: () => Promise.resolve(),
      suscribir: (clave: string, nombre: string) => {
        suscritos.push([clave, nombre]);
        return () => {};
      },
    };
    return { bus, suscritos };
  };
  const suscribir = (env: Record<string, string>) => {
    const { bus, suscritos } = busQueAnota();
    suscribirManejadores({
      bus,
      db: {} as Db,
      interruptores: cargarInterruptores(env),
      registro: crearRegistro('silent'),
      tiempoReal: { difundir: vi.fn() },
      reloj: relojDelSistema,
      ids: generadorUuid,
    });
    return suscritos;
  };

  it('suscribe las reacciones entre módulos y el tiempo real a cada evento público', () => {
    const suscritos = suscribir({});

    expect(suscritos).toEqual(
      expect.arrayContaining([
        ['VotoEmitido.v1', 'reports.aplicar-decision'],
        ['RechazoDeModeracion.v1', 'reports.aplicar-rechazo'],
        ['ReporteDuplicadoDetectado.v1', 'verification.confirmar-duplicado'],
        ['ReporteConfirmado.v1', 'verification.ajustar-reputacion'],
        ['ReporteCreado.v1', 'tiempo-real'],
      ]),
    );
  });

  it('desacoplamiento: los avisos a suscriptores solo existen con su módulo activo', () => {
    const notificar = (s: [string, string][]) => s.some(([, n]) => n === 'subscriptions.notificar');

    expect(notificar(suscribir({}))).toBe(false);
    expect(notificar(suscribir({ FEATURE_SUBSCRIPTIONS: 'true' }))).toBe(true);
  });

  it('el enviador de la Fase 7 deja el aviso en el log, solo con datos públicos', async () => {
    const lineas: string[] = [];
    const enviador = new EnviadorDeNotificacionesEnRegistro(
      crearRegistro('info', { write: (linea) => lineas.push(linea) }),
    );

    await enviador.enviar({
      idUsuario: idUsuario(ID),
      idReporte: idReporte(ID),
      codigoCategoria: 'bloqueo' as never,
      publicLocation: laPaz,
    });

    expect(lineas[0]).toContain('aviso a suscriptor');
    expect(lineas[0]).not.toContain('"location"');
  });
});
