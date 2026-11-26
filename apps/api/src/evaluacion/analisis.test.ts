import { describe, expect, it } from 'vitest';
import { analizar, mediana, veracidadPonderada } from './analisis.js';
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
  claves: [],
  verificaciones: [
    { idReporte: R1, resultado: 'REAL', finEn: en(120) },
    { idReporte: R2, resultado: 'FALSO', finEn: null },
  ],
};

const resultado = analizar(datos, TTL);
const indicador = (nombre: string, vista: string) =>
  resultado.indicadores.find((i) => i.indicador === nombre && i.vista === vista)?.valor;
const tarea = (vista: string, cambios: object) => ({
  participante: 'P01',
  secuencia: 2,
  orden: vista === 'PROCESADA' ? 1 : 2,
  vista,
  escenario: 'E1',
  duracion_ms: vista === 'PROCESADA' ? 60_000 : 120_000,
  agotada: false,
  ...cambios,
});

describe('análisis del piloto (ADR-007, perfil v5)', () => {
  it('HU-14: sin clave fijada usa la calculada, cuenta aciertos, omisiones y marcas, y lo advierte', () => {
    // Clave calculada: solo g1 (real y vigente en el minuto 60). r2 es falso y r3 no se verificó.
    expect(resultado.tareas).toEqual([
      tarea('PROCESADA', {
        aciertos: 1,
        omisiones: 0,
        de_mas: 1,
        neutras: 1,
        tasa_acierto: 1,
        tasa_omision: 0,
      }),
      tarea('BASE', {
        aciertos: 1,
        omisiones: 0,
        de_mas: 1,
        neutras: 1,
        tasa_acierto: 1,
        tasa_omision: 0,
      }),
    ]);
    expect(resultado.avisos).toEqual([expect.stringContaining('La clave de E1 se calculó')]);
    expect(indicador('segundos para identificar los incidentes activos', 'BASE')).toBe(120);
  });

  it('HU-14: con la clave que fijaron los evaluadores, lo que está en ella es acierto (perfil v5, 6.3)', () => {
    const conClave = analizar(
      { ...datos, claves: ['g1', 'g2', 'g9'].map((grupo) => ({ idInstantanea: S1, grupo })) },
      TTL,
    );

    // g2 (r2) está en la clave; g3 (r3) sigue sin verificar: neutra. g9 no se marcó: omisión.
    expect(conClave.tareas[0]).toMatchObject({
      aciertos: 2,
      omisiones: 1,
      de_mas: 0,
      neutras: 1,
      tasa_acierto: 0.667,
      tasa_omision: 0.333,
    });
    expect(conClave.avisos).toEqual([]);
  });

  it('HU-14: los ítems por incidente único se cuentan por grupo del etiquetado en cada vista (H1b)', () => {
    expect(resultado.incidentes.toSorted((a, b) => a.grupo.localeCompare(b.grupo))).toEqual([
      { grupo: 'g1', categoria: 'bloqueo', items_base: 2, items_procesada: 1 },
      { grupo: 'g2', categoria: 'accidente', items_base: 1, items_procesada: 1 },
      { grupo: 'g3', categoria: 'bloqueo', items_base: 1, items_procesada: 1 },
      { grupo: 'g4', categoria: 'bloqueo', items_base: 1, items_procesada: 1 },
    ]);
    expect(resultado.costos.find((c) => c.indicador === 'fusiones erróneas')).toMatchObject({
      casos: 1,
      total: 2,
    });
  });

  it('HU-14: veracidad, exhaustividad, no verificables y latencia salen de la verificación (H1c)', () => {
    expect(resultado.veracidad).toEqual([
      { id_reporte: R1, categoria: 'bloqueo', confirmado: true, real: true },
      { id_reporte: R2, categoria: 'accidente', confirmado: false, real: false },
    ]);
    expect(indicador('alertas que corresponden a incidentes reales', 'PROCESADA')).toBe(1);
    expect(indicador('exhaustividad (reales confirmados / reales)', 'PROCESADA')).toBe(1);
    expect(indicador('minutos hasta la confirmación', 'PROCESADA')).toBe(30);
    expect(resultado.costos.find((c) => c.indicador === 'no verificables')).toMatchObject({
      casos: 0,
      total: 2,
    });
  });

  it('HU-14: la veracidad de la base pondera cada estrato por su tamaño en el total de reportes (perfil v5, 6.5)', () => {
    // 8 confirmados (la mitad reales en la muestra) y 2 sin confirmar (todos reales en la muestra):
    // (8 × 0,5 + 2 × 1) / 10 = 0,6, no los 2/3 de la muestra sin ponderar.
    const poblacion = [
      ...Array.from({ length: 8 }, () => ({ categoria: 'bloqueo', confirmado: true })),
      ...Array.from({ length: 2 }, () => ({ categoria: 'bloqueo', confirmado: false })),
    ];
    const muestra = [true, false].map((real, i) => ({
      id_reporte: `c${i}`,
      categoria: 'bloqueo',
      confirmado: true,
      real,
    }));
    muestra.push({ id_reporte: 'n0', categoria: 'bloqueo', confirmado: false, real: true });

    expect(veracidadPonderada(poblacion, muestra)).toBe(0.6);
    expect(veracidadPonderada(poblacion, [])).toBeNull();
  });

  it('HU-14: la vigencia es por incidente con hora de fin, con anticipo si salió antes (H1d)', () => {
    // Procesada: hasta la caducidad extendida (540). Base: 24 h después del último envío (5).
    expect(resultado.vigencia).toEqual([
      {
        grupo: 'g1',
        categoria: 'bloqueo',
        exceso_procesada_min: 420,
        exceso_base_min: 1325,
        prematuro: false,
        anticipo_min: null,
      },
    ]);
    const temprano = analizar(
      { ...datos, verificaciones: [{ idReporte: R1, resultado: 'REAL', finEn: en(600) }] },
      TTL,
    );
    expect(temprano.vigencia[0]).toMatchObject({
      exceso_procesada_min: 0,
      prematuro: true,
      anticipo_min: 60,
    });
    expect(resultado.supervivencia).toEqual([
      { grupo: 'g1', categoria: 'bloqueo', minutos: 120, evento: 1, ttl_minutos: 360 },
    ]);
  });

  it('la mediana interpola como R y es nula sin datos', () => {
    expect([mediana([3, 1, 2]), mediana([1, 2, 3, 4]), mediana([])]).toEqual([2, 2.5, null]);
  });
});
