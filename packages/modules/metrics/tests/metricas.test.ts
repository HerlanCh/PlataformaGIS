import {
  crearEvento,
  reporteCaducadoV1,
  reporteConfirmadoV1,
  reporteCreadoV1,
  reporteCreadoV2,
  reporteDuplicadoDetectadoV1,
  reporteRechazadoV1,
  reporteResueltoV1,
  votoEmitidoV1,
} from '@gis/contracts';
import { RelojFijo } from '@gis/testing';
import { describe, expect, it } from 'vitest';
import {
  aCsv,
  ConsultarMetricas,
  MAX_DIAS_DE_CONSULTA,
} from '../application/consultar-metricas.js';
import { huellaDelDia, RegistrarActividad } from '../application/registrar-actividad.js';
import { RegistrarEventoDeReporte } from '../application/registrar-evento-de-reporte.js';
import { diaEnLaPaz, diaSiguiente, inicioDelDia, percentil, resumir } from '../domain/metricas.js';
import type { RegistroDeReporte } from '../domain/metricas.js';
import { metricsModulo } from '../index.js';
import { MetricasEnMemoria } from './dobles.js';

const ID = '6f1c2f0e-3b7a-4d2a-9c58-0a4f5b1d2e3f';
const OTRO = '7a2d3f1e-4c8b-4e3b-8d69-1b5f6c2e3f40';
const USUARIO = '11111111-1111-4111-8111-111111111111';
// 08:00 en La Paz.
const creado = new Date('2026-10-24T12:00:00.000Z');
const minutos = (n: number) => new Date(creado.getTime() + n * 60_000);

const registro = (cambios: Partial<RegistroDeReporte> = {}): RegistroDeReporte => ({
  idReporte: ID,
  codigoCategoria: 'bloqueo',
  esOficial: false,
  creadoEn: creado,
  primeraConfirmacionEn: null,
  confirmadoEn: null,
  cierre: null,
  cerradoEn: null,
  ...cambios,
});

let secuencia = 0;
const sobre = (en: Date) => ({
  id: `eeeeeeee-0000-4000-8000-${String((secuencia += 1)).padStart(12, '0')}`,
  ocurridoEn: en,
});

const contenidoCreado = {
  idReporte: ID,
  codigoCategoria: 'bloqueo',
  publicLocation: { latitud: -16.5, longitud: -68.15 },
  estado: 'ACTIVO' as const,
  creadoEn: creado.toISOString(),
  caducaEn: minutos(360).toISOString(),
};

describe('dominio de métricas', () => {
  it('cuenta los días en la hora de Bolivia (UTC−4)', () => {
    expect(diaEnLaPaz(new Date('2026-10-25T03:59:00Z'))).toBe('2026-10-24');
    expect(diaEnLaPaz(new Date('2026-10-25T04:00:00Z'))).toBe('2026-10-25');
    expect(inicioDelDia('2026-10-24')).toEqual(new Date('2026-10-24T04:00:00Z'));
    expect(diaSiguiente('2026-10-31')).toBe('2026-11-01');
  });

  it('calcula percentiles por rango más cercano', () => {
    const muestra = [10, 1, 7, 3, 5];

    expect(percentil(muestra, 50)).toBe(5);
    expect(percentil(muestra, 90)).toBe(10);
    expect(percentil(muestra, 0)).toBe(1);
    expect(() => percentil([], 50)).toThrow(RangeError);
    expect(() => percentil(muestra, 101)).toThrow(RangeError);
  });

  it('resume reportes, confirmación y cierres; lo oficial se cuenta aparte', () => {
    const resumen = resumir(
      [
        registro({ primeraConfirmacionEn: minutos(4), confirmadoEn: minutos(9) }),
        registro({
          idReporte: OTRO,
          primeraConfirmacionEn: minutos(20),
          cierre: 'VOTOS',
          cerradoEn: minutos(60),
        }),
        registro({
          idReporte: '3',
          codigoCategoria: 'robo',
          cierre: 'CADUCIDAD',
          cerradoEn: minutos(120),
        }),
        registro({
          idReporte: '4',
          codigoCategoria: 'robo',
          cierre: 'CADUCIDAD',
          cerradoEn: minutos(120),
        }),
        registro({
          idReporte: '5',
          esOficial: true,
          confirmadoEn: minutos(1),
          cierre: 'MODERACION',
          cerradoEn: minutos(2),
        }),
      ],
      [
        { dia: '2026-10-25', usuariosActivos: 3 },
        { dia: '2026-10-24', usuariosActivos: 7 },
      ],
    );

    expect(resumen.reportes).toEqual({
      total: 5,
      comunitarios: 4,
      oficiales: 1,
      porCategoria: [
        { codigoCategoria: 'bloqueo', total: 3 },
        { codigoCategoria: 'robo', total: 2 },
      ],
    });
    expect(resumen.confirmacion).toEqual({
      conAlgunaConfirmacion: 2,
      confirmados: 1,
      porcentajeConfirmados: 25,
      minutosHastaPrimeraConfirmacion: { mediana: 4, p90: 20 },
    });
    expect(resumen.cierres).toEqual({
      cerrados: 3,
      abiertos: 1,
      porTipo: [
        { cierre: 'CADUCIDAD', total: 2, porcentaje: 66.7 },
        { cierre: 'VOTOS', total: 1, porcentaje: 33.3 },
        { cierre: 'MODERACION', total: 0, porcentaje: 0 },
      ],
    });
    expect(resumen.usuariosActivos.map((a) => a.dia)).toEqual(['2026-10-24', '2026-10-25']);
  });

  it('sin reportes no inventa porcentajes ni tiempos', () => {
    const resumen = resumir([], []);

    expect(resumen.confirmacion.porcentajeConfirmados).toBeNull();
    expect(resumen.confirmacion.minutosHastaPrimeraConfirmacion).toBeNull();
    expect(resumen.cierres.porTipo.every((t) => t.porcentaje === null)).toBe(true);
  });
});

describe('RegistrarEventoDeReporte', () => {
  const escenario = () => {
    const metricas = new MetricasEnMemoria();
    return { metricas, manejador: new RegistrarEventoDeReporte(metricas) };
  };

  it('sigue un reporte desde que se crea hasta que caduca, con la hora de cada evento', async () => {
    const { metricas, manejador } = escenario();

    await manejador.manejar(
      crearEvento(reporteCreadoV2, { ...contenidoCreado, fuenteOficial: null }, sobre(creado)),
    );
    await manejador.manejar(
      crearEvento(
        reporteDuplicadoDetectadoV1,
        {
          idReporteExistente: ID,
          idReportante: USUARIO,
          ubicacionReportante: { latitud: -16.5, longitud: -68.15 },
        },
        sobre(minutos(3)),
      ),
    );
    await manejador.manejar(
      crearEvento(
        votoEmitidoV1,
        {
          idReporte: ID,
          idVotante: USUARIO,
          valor: 'CONFIRMACION',
          peso: 1,
          decision: 'CONFIRMAR',
        },
        sobre(minutos(8)),
      ),
    );
    await manejador.manejar(
      crearEvento(
        reporteConfirmadoV1,
        { idReporte: ID, caducaEn: minutos(540).toISOString() },
        sobre(minutos(8)),
      ),
    );
    await manejador.manejar(crearEvento(reporteCaducadoV1, { idReporte: ID }, sobre(minutos(540))));
    await manejador.manejar(crearEvento(reporteResueltoV1, { idReporte: ID }, sobre(minutos(600))));

    expect(metricas.reportes.get(ID)).toEqual(
      registro({
        primeraConfirmacionEn: minutos(3),
        confirmadoEn: minutos(8),
        cierre: 'CADUCIDAD',
        cerradoEn: minutos(540),
      }),
    );
  });

  it('una negación no es confirmación; el rechazo cierra por moderación', async () => {
    const { metricas, manejador } = escenario();
    await manejador.manejar(crearEvento(reporteCreadoV1, contenidoCreado, sobre(creado)));

    await manejador.manejar(
      crearEvento(
        votoEmitidoV1,
        { idReporte: ID, idVotante: USUARIO, valor: 'NEGACION', peso: 1, decision: 'NINGUNA' },
        sobre(minutos(5)),
      ),
    );
    await manejador.manejar(
      crearEvento(reporteRechazadoV1, { idReporte: ID, motivo: 'MODERACION' }, sobre(minutos(6))),
    );

    expect(metricas.reportes.get(ID)).toMatchObject({
      primeraConfirmacionEn: null,
      cierre: 'MODERACION',
    });
  });

  it('HU-13: marca los incidentes de fuente oficial', async () => {
    const { metricas, manejador } = escenario();

    await manejador.manejar(
      crearEvento(reporteCreadoV2, { ...contenidoCreado, fuenteOficial: 'ABC' }, sobre(creado)),
    );

    expect(metricas.reportes.get(ID)?.esOficial).toBe(true);
  });

  it('RNF-14: no guarda autor, votantes ni ubicación', async () => {
    const { metricas, manejador } = escenario();
    await manejador.manejar(
      crearEvento(reporteCreadoV2, { ...contenidoCreado, fuenteOficial: null }, sobre(creado)),
    );

    expect(Object.keys(metricas.reportes.get(ID)!).sort()).toEqual([
      'cerradoEn',
      'cierre',
      'codigoCategoria',
      'confirmadoEn',
      'creadoEn',
      'esOficial',
      'idReporte',
      'primeraConfirmacionEn',
    ]);
  });

  it('escucha la creación, los votos, los duplicados, la confirmación y los tres cierres', () => {
    expect(RegistrarEventoDeReporte.eventos).toEqual([
      'ReporteCreado.v1',
      'ReporteCreado.v2',
      'VotoEmitido.v1',
      'ReporteDuplicadoDetectado.v1',
      'ReporteConfirmado.v1',
      'ReporteCaducado.v1',
      'ReporteResuelto.v1',
      'ReporteRechazado.v1',
    ]);
  });
});

describe('RegistrarActividad', () => {
  it('cuenta una vez por persona y día, y al cambiar de día consolida y borra las huellas', async () => {
    const metricas = new MetricasEnMemoria();
    const reloj = new RelojFijo(creado);
    const registrar = new RegistrarActividad(metricas, reloj, 'sal-de-prueba');

    await registrar.ejecutar(USUARIO);
    await registrar.ejecutar(USUARIO);
    await registrar.ejecutar('22222222-2222-4222-8222-222222222222');
    reloj.avanzarMinutos(24 * 60);
    await registrar.ejecutar(USUARIO);

    expect(metricas.diarias.get('2026-10-24')).toBe(2);
    expect(metricas.huellas.has('2026-10-24')).toBe(false);
    expect(metricas.huellas.get('2026-10-25')?.size).toBe(1);
  });

  it('la huella no revela el ID y cambia con el día y con la sal', () => {
    const huella = huellaDelDia('sal', '2026-10-24', USUARIO);

    expect(huella).toMatch(/^[0-9a-f]{64}$/);
    expect(huella).not.toContain(USUARIO.slice(0, 8));
    expect(huellaDelDia('sal', '2026-10-25', USUARIO)).not.toBe(huella);
    expect(huellaDelDia('otra', '2026-10-24', USUARIO)).not.toBe(huella);
  });
});

describe('ConsultarMetricas', () => {
  const escenario = async () => {
    const metricas = new MetricasEnMemoria();
    await metricas.registrarCreacion(registro());
    // 23:30 del 24 en La Paz: cuenta en el día 24, aunque en UTC ya es el 25.
    await metricas.registrarCreacion(
      registro({ idReporte: OTRO, creadoEn: new Date('2026-10-25T03:30:00Z') }),
    );
    await metricas.registrarCreacion(
      registro({ idReporte: '3', creadoEn: new Date('2026-10-25T04:30:00Z') }),
    );
    await metricas.registrarActividad('2026-10-24', 'a'.repeat(64));
    return new ConsultarMetricas(metricas);
  };

  it('resume los reportes de los días de Bolivia pedidos, ambos incluidos', async () => {
    const consultar = await escenario();

    const periodo = await consultar.ejecutar({
      rolActor: 'MODERADOR',
      desde: '2026-10-24',
      hasta: '2026-10-24',
    });

    expect(periodo).toMatchObject({ desde: '2026-10-24', hasta: '2026-10-24' });
    expect(periodo.reportes.total).toBe(2);
    expect(periodo.usuariosActivos).toEqual([{ dia: '2026-10-24', usuariosActivos: 1 }]);
  });

  it('solo un moderador puede verlas', async () => {
    const consultar = await escenario();

    await expect(
      consultar.ejecutar({ rolActor: 'CIUDADANO', desde: '2026-10-24', hasta: '2026-10-24' }),
    ).rejects.toMatchObject({ tipo: 'PROHIBIDO', codigo: 'ROL_INSUFICIENTE' });
  });

  it('rechaza un periodo invertido, demasiado largo o con fechas mal escritas', async () => {
    const consultar = await escenario();
    const pedir = (desde: string, hasta: string) =>
      consultar.ejecutar({ rolActor: 'MODERADOR', desde, hasta });

    await expect(pedir('2026-10-25', '2026-10-24')).rejects.toMatchObject({
      codigo: 'PERIODO_INVALIDO',
    });
    await expect(pedir('2025-01-01', '2026-10-24')).rejects.toMatchObject({
      codigo: 'PERIODO_INVALIDO',
    });
    await expect(pedir('24/10/2026', '2026-10-24')).rejects.toMatchObject({
      tipo: 'VALIDACION_FALLIDA',
    });
    expect(MAX_DIAS_DE_CONSULTA).toBe(366);
  });

  it('exporta los reportes del periodo como CSV sin datos personales', async () => {
    const consultar = await escenario();

    const csv = aCsv(
      await consultar.exportar({ rolActor: 'MODERADOR', desde: '2026-10-24', hasta: '2026-10-25' }),
    );

    const [encabezado, primera, ...resto] = csv.trimEnd().split('\n');
    expect(encabezado).toBe(
      'id_reporte,codigo_categoria,es_oficial,creado_en,primera_confirmacion_en,confirmado_en,cierre,cerrado_en',
    );
    expect(primera).toBe(`${ID},bloqueo,false,2026-10-24T12:00:00.000Z,,,,`);
    expect(resto).toHaveLength(2);
  });
});

describe('módulo metrics', () => {
  it('expone su nombre y sus migraciones', () => {
    expect(metricsModulo.nombre).toBe('metrics');
    expect(metricsModulo.migraciones?.nombre).toBe('metrics');
  });
});
