import { describe, expect, it } from 'vitest';
import { analizar, mediana } from './analisis.js';
import type { DatosDeEvaluacion, EnvioDato } from './datos.js';

const MIN = 60_000;
const cero = Date.parse('2026-11-22T12:00:00.000Z');
const en = (minuto: number) => cero + minuto * MIN;
const R1 = 'r1';
const R2 = 'r2';
const R3 = 'r3';
const S1 = 's1';
const TTL = new Map([
  ['bloqueo', 360],
  ['accidente', 180],
]);

const envio = (
  idEnvio: string,
  idReporte: string,
  minuto: number,
  categoria = 'bloqueo',
): EnvioDato => ({
  idEnvio,
  tipo: idEnvio === idReporte ? 'CREADO' : 'DUPLICADO',
  idReporte,
  codigoCategoria: categoria,
  latitud: -16.5,
  longitud: -68.15,
  fuenteOficial: null,
  recibidoEn: en(minuto),
});

/**
 * Tres reportes: r1 (bloqueo real hasta el minuto 120, confirmado, con un duplicado), r2 (accidente
 * falso) y r3 (sin verificar, que juntó dos incidentes distintos). Una instantánea en el minuto 60 y
 * una tarea por vista.
 */
const datos: DatosDeEvaluacion = {
  envios: [
    envio(R1, R1, 0),
    envio('e2', R1, 5),
    envio(R2, R2, 10, 'accidente'),
    envio(R3, R3, 20),
    envio('e5', R3, 25),
  ],
  transiciones: [
    { idReporte: R1, estado: 'ACTIVO', caducaEn: en(360), ocurridoEn: en(0) },
    { idReporte: R1, estado: 'CONFIRMADO', caducaEn: en(540), ocurridoEn: en(30) },
    { idReporte: R2, estado: 'ACTIVO', caducaEn: en(190), ocurridoEn: en(10) },
    { idReporte: R3, estado: 'ACTIVO', caducaEn: en(380), ocurridoEn: en(20) },
  ],
  votos: [],
  instantaneas: [{ id: S1, nombre: 'E1', instante: en(60) }],
  puntos: [
    ...[R1, R2, R3].map((p) => ({
      idInstantanea: S1,
      vista: 'PROCESADA' as const,
      idPunto: p,
      idReporte: p,
    })),
    ...[R1, 'e2', R2, R3, 'e5'].map((p) => ({
      idInstantanea: S1,
      vista: 'BASE' as const,
      idPunto: p,
      idReporte: p,
    })),
  ],
  tareas: (['PROCESADA', 'BASE'] as const).map((vista, i) => ({
    idTarea: `t${i}`,
    codigoParticipante: 'P01',
    secuencia: 2,
    orden: i + 1,
    vista,
    escenario: 'E1',
    idInstantanea: S1,
    duracionMs: (i + 1) * 60_000,
    agotada: false,
  })),
  marcas: [
    ...[R1, R2, R3].map((idPunto) => ({ idTarea: 't0', idPunto, msDesdeInicio: 1000 })),
    ...[R1, 'e2', R3].map((idPunto) => ({ idTarea: 't1', idPunto, msDesdeInicio: 1000 })),
  ],
  etiquetas: [
    { evaluador: 'A', idEnvio: R1, grupo: 'g1' },
    { evaluador: 'B', idEnvio: R1, grupo: 'otro' },
    { evaluador: 'CONSENSO', idEnvio: R1, grupo: 'g1' },
    { evaluador: 'A', idEnvio: 'e2', grupo: 'g1' },
    { evaluador: 'B', idEnvio: R2, grupo: 'g2' },
    { evaluador: 'A', idEnvio: R3, grupo: 'g3' },
    { evaluador: 'A', idEnvio: 'e5', grupo: 'g4' },
  ],
  verificaciones: [
    { idReporte: R1, resultado: 'REAL', finEn: en(120) },
    { idReporte: R2, resultado: 'FALSO', finEn: null },
  ],
};

const resultado = analizar(datos, TTL);
const indicador = (nombre: string, vista: string) =>
  resultado.indicadores.find((i) => i.indicador === nombre && i.vista === vista)?.valor;

describe('análisis del piloto (ADR-007)', () => {
  it('HU-14: cuenta aciertos, omisiones, marcados de más y neutras contra la clave de la instantánea', () => {
    expect(resultado.tareas).toEqual([
      {
        participante: 'P01',
        secuencia: 2,
        orden: 1,
        vista: 'PROCESADA',
        escenario: 'E1',
        duracion_ms: 60_000,
        agotada: false,
        aciertos: 1,
        omisiones: 0,
        de_mas: 1,
        neutras: 1,
      },
      {
        participante: 'P01',
        secuencia: 2,
        orden: 2,
        vista: 'BASE',
        escenario: 'E1',
        duracion_ms: 120_000,
        agotada: false,
        aciertos: 1,
        omisiones: 0,
        de_mas: 1,
        neutras: 1,
      },
    ]);
    expect(indicador('tiempo de la tarea', 'BASE')).toBe(120);
  });

  it('HU-14: la base repite el incidente real y la procesada lo muestra una vez', () => {
    expect(indicador('puntos por incidente real', 'PROCESADA')).toBe(1);
    expect(indicador('puntos por incidente real', 'BASE')).toBe(2);
  });

  it('HU-14: una fusión es errónea si el reporte juntó envíos de incidentes distintos', () => {
    expect(resultado.costos.find((c) => c.indicador === 'fusiones erróneas')).toMatchObject({
      casos: 1,
      total: 2,
    });
  });

  it('HU-14: veracidad, reales sin confirmar y latencia salen de la verificación, no de los votos', () => {
    expect(resultado.veracidad).toEqual([
      { id_reporte: R1, categoria: 'bloqueo', confirmado: true, real: true },
      { id_reporte: R2, categoria: 'accidente', confirmado: false, real: false },
    ]);
    expect([
      indicador('reales entre lo mostrado', 'PROCESADA'),
      indicador('reales entre lo mostrado', 'BASE'),
    ]).toEqual([1, 0.5]);
    expect(indicador('latencia de confirmación', 'PROCESADA')).toBe(30);
    expect(resultado.costos.find((c) => c.indicador === 'reales sin confirmar')).toMatchObject({
      casos: 0,
      total: 1,
    });
  });

  it('HU-14: mide cuánto siguió visible después de terminar en cada vista, y si salió antes', () => {
    // Procesada: hasta la caducidad extendida (540). Base: 24 h después del último envío (5).
    expect(resultado.vigencia).toEqual([
      {
        id_reporte: R1,
        categoria: 'bloqueo',
        exceso_procesada_min: 420,
        exceso_base_min: 1325,
        prematuro: false,
      },
    ]);
    expect(resultado.supervivencia).toEqual([
      { id_reporte: R1, categoria: 'bloqueo', minutos: 120, evento: 1, ttl_minutos: 360 },
    ]);
  });

  it('la mediana interpola como R y es nula sin datos', () => {
    expect([mediana([3, 1, 2]), mediana([1, 2, 3, 4]), mediana([])]).toEqual([2, 2.5, null]);
  });
});
