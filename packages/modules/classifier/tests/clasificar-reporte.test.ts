import { crearEvento, descripcionAgregadaV1, reporteCreadoV1 } from '@gis/contracts';
import type { EventoDeIntegracion } from '@gis/contracts';
import type { IdReporte } from '@gis/shared-kernel';
import { GeneradorDeIdSecuencial, RelojFijo } from '@gis/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClasificadorConRespaldo } from '../adapters/clasificador-con-respaldo.js';
import { ClasificadorPorReglas } from '../adapters/clasificador-por-reglas.js';
import { ClasificarReporte } from '../application/clasificar-reporte.js';
import type {
  ConsultaParaClasificar,
  UnidadDeTrabajoDeClasificacion,
} from '../application/ports.js';
import type {
  Clasificacion,
  Clasificador,
  DatosParaClasificar,
  RegistroDeClasificacion,
} from '../domain/clasificacion.js';
import { classifierModulo } from '../index.js';

const ID = '6f1c2f0e-3b7a-4d2a-9c58-0a4f5b1d2e3f';
const ahora = new Date('2026-10-19T12:00:00.000Z');
const sobre = { id: 'eeeeeeee-0000-4000-8000-000000000001', ocurridoEn: ahora };

const creado = crearEvento(
  reporteCreadoV1,
  {
    idReporte: ID,
    codigoCategoria: 'bloqueo',
    publicLocation: { latitud: -16.5, longitud: -68.15 },
    estado: 'ACTIVO',
    creadoEn: ahora.toISOString(),
    caducaEn: ahora.toISOString(),
  },
  sobre,
);
const descrito = crearEvento(descripcionAgregadaV1, { idReporte: ID }, sobre);

class ConsultaFalsa implements ConsultaParaClasificar {
  constructor(readonly datos = new Map<string, DatosParaClasificar>()) {}

  datosDe(id: IdReporte): Promise<DatosParaClasificar | null> {
    return Promise.resolve(this.datos.get(id) ?? null);
  }
}

class UnidadEnMemoria implements UnidadDeTrabajoDeClasificacion {
  readonly registros: RegistroDeClasificacion[] = [];
  readonly eventos: EventoDeIntegracion[] = [];

  registrar(c: RegistroDeClasificacion, eventos: readonly EventoDeIntegracion[]): Promise<void> {
    this.registros.push(c);
    this.eventos.push(...eventos);
    return Promise.resolve();
  }
}

function escenario(
  datos: DatosParaClasificar | null,
  clasificador: Clasificador = new ClasificadorPorReglas(),
) {
  const consulta = new ConsultaFalsa();
  if (datos) consulta.datos.set(ID, datos);
  const unidadDeTrabajo = new UnidadEnMemoria();
  const caso = new ClasificarReporte({
    consulta,
    clasificador,
    unidadDeTrabajo,
    reloj: new RelojFijo(ahora),
    ids: new GeneradorDeIdSecuencial('cccccccc'),
  });
  return { caso, unidadDeTrabajo };
}

describe('ClasificarReporte', () => {
  it('HU-10: tras DescripcionAgregada marca como sospechoso un reporte con un enlace', async () => {
    const { caso, unidadDeTrabajo } = escenario({
      descripcion: 'mira https://spam.example',
      reportesRecientesDelAutor: 1,
    });

    await caso.manejar(descrito);

    expect(unidadDeTrabajo.registros).toEqual([
      expect.objectContaining({
        idReporte: ID,
        sospechoso: true,
        motivos: ['ENLACE'],
        clasificador: 'reglas-v1',
        creadoEn: ahora,
      }),
    ]);
    expect(unidadDeTrabajo.eventos).toEqual([
      expect.objectContaining({
        tipo: 'ReporteClasificado',
        version: 1,
        contenido: {
          idReporte: ID,
          sospechoso: true,
          motivos: ['ENLACE'],
          clasificador: 'reglas-v1',
        },
      }),
    ]);
  });

  it('HU-10: tras ReporteCreado clasifica sin descripción y emite el resultado limpio', async () => {
    const { caso, unidadDeTrabajo } = escenario({
      descripcion: null,
      reportesRecientesDelAutor: 1,
    });

    await caso.manejar(creado);

    expect(unidadDeTrabajo.eventos[0]?.contenido).toEqual({
      idReporte: ID,
      sospechoso: false,
      motivos: [],
      clasificador: 'reglas-v1',
    });
  });

  it('un reporte que ya no existe no se clasifica', async () => {
    const { caso, unidadDeTrabajo } = escenario(null);

    await caso.manejar(creado);

    expect(unidadDeTrabajo.registros).toEqual([]);
    expect(unidadDeTrabajo.eventos).toEqual([]);
  });

  it('escucha la creación y la descripción de un reporte', () => {
    expect(ClasificarReporte.eventos).toEqual(['ReporteCreado.v1', 'DescripcionAgregada.v1']);
  });
});

describe('ClasificadorConRespaldo', () => {
  const datos: DatosParaClasificar = { descripcion: 'gratis', reportesRecientesDelAutor: 1 };
  const modelo = (clasificar: () => Promise<Clasificacion>): Clasificador => ({ clasificar });
  const delModelo: Clasificacion = {
    sospechoso: false,
    motivos: [],
    puntaje: 0.1,
    clasificador: 'modelo-v1',
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  it('usa el principal cuando responde a tiempo', async () => {
    const alFallar = vi.fn();
    const clasificador = new ClasificadorConRespaldo(
      modelo(() => Promise.resolve(delModelo)),
      new ClasificadorPorReglas(),
      { tiempoLimiteMs: 1000, alFallar },
    );

    expect(await clasificador.clasificar(datos)).toEqual(delModelo);
    expect(alFallar).not.toHaveBeenCalled();
  });

  it('HU-10: con el servicio de IA caído clasifica con las reglas locales', async () => {
    const alFallar = vi.fn();
    const clasificador = new ClasificadorConRespaldo(
      modelo(() => Promise.reject(new Error('ECONNREFUSED'))),
      new ClasificadorPorReglas(),
      { tiempoLimiteMs: 1000, alFallar },
    );

    expect(await clasificador.clasificar(datos)).toMatchObject({
      sospechoso: true,
      motivos: ['SPAM'],
      clasificador: 'reglas-v1',
    });
    expect(alFallar).toHaveBeenCalledWith(expect.objectContaining({ message: 'ECONNREFUSED' }));
  });

  it('HU-10: si el principal tarda más que el límite, usa las reglas', async () => {
    vi.useFakeTimers();
    const clasificador = new ClasificadorConRespaldo(
      modelo(() => new Promise<Clasificacion>(() => {})),
      new ClasificadorPorReglas(),
      { tiempoLimiteMs: 500 },
    );

    const resultado = clasificador.clasificar(datos);
    await vi.advanceTimersByTimeAsync(600);

    expect(await resultado).toMatchObject({ clasificador: 'reglas-v1' });
  });
});

describe('módulo classifier', () => {
  it('declara sus migraciones', () => {
    expect(classifierModulo.migraciones?.nombre).toBe('classifier');
  });
});
