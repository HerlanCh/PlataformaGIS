import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exportacionACsv } from '@gis/module-evaluation';
import type { Exportacion, NombreDeTabla } from '@gis/module-evaluation';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { escribirCsv, leerCsv } from './csv.js';
import { leerExportacion } from './datos.js';
import { analizarCarpeta, exportarACarpeta, sensibilidadDeCarpeta } from './piloto.js';
import { MALLA } from './sensibilidad.js';

const iso = (minuto: number) => new Date(Date.parse('2026-11-22T12:00:00.000Z') + minuto * 60_000);
const ID = (n: number) => `6f1c2f0e-3b7a-4d2a-9c58-${String(n).padStart(12, '0')}`;

/** Una exportación mínima: un bloqueo confirmado y verificado real, con un duplicado. */
const EXPORTACION: Exportacion = {
  envios: [
    {
      id_envio: ID(1),
      tipo: 'CREADO',
      id_reporte: ID(1),
      codigo_categoria: 'bloqueo',
      latitud: -16.5,
      longitud: -68.15,
      fuente_oficial: null,
      recibido_en: iso(0),
    },
    {
      id_envio: ID(2),
      tipo: 'DUPLICADO',
      id_reporte: ID(1),
      codigo_categoria: 'bloqueo',
      latitud: -16.5002,
      longitud: -68.15,
      fuente_oficial: null,
      recibido_en: iso(5),
    },
  ],
  transiciones: [
    {
      id_evento: ID(10),
      id_reporte: ID(1),
      estado: 'ACTIVO',
      caduca_en: iso(360),
      ocurrido_en: iso(0),
    },
  ],
  votos: [
    {
      id_evento: ID(20),
      id_reporte: ID(1),
      valor: 'CONFIRMACION',
      peso: 1,
      decision: 'NINGUNA',
      ocurrido_en: iso(5),
    },
  ],
  instantaneas: [
    {
      id: ID(30),
      nombre: 'E1',
      instante: iso(30),
      latitud_min: -16.51,
      latitud_max: -16.49,
      longitud_min: -68.16,
      longitud_max: -68.14,
      creada_en: iso(31),
    },
  ],
  puntos: [
    {
      id_instantanea: ID(30),
      vista: 'PROCESADA',
      id_punto: ID(1),
      id_reporte: ID(1),
      codigo_categoria: 'bloqueo',
      latitud: -16.5,
      longitud: -68.15,
      estado: 'ACTIVO',
      caduca_en: iso(360),
      recibido_en: null,
      fuente_oficial: null,
    },
  ],
  tareas: [
    {
      id_tarea: ID(40),
      codigo_participante: 'P01',
      secuencia: 2,
      orden: 1,
      vista: 'PROCESADA',
      escenario: 'E1',
      id_instantanea: ID(30),
      iniciada_en: iso(40),
      terminada_en: iso(41),
      duracion_ms: 60_000,
      agotada: false,
    },
  ],
  marcas: [{ id_tarea: ID(40), id_punto: ID(1), ms_desde_inicio: 2_000 }],
  etiquetas: [
    { evaluador: 'A', id_envio: ID(1), grupo: '1' },
    { evaluador: 'A', id_envio: ID(2), grupo: '1' },
  ],
  claves: [{ id_instantanea: ID(30), grupo: '1' }],
  verificaciones: [
    {
      id_reporte: ID(1),
      resultado: 'REAL',
      fin_en: iso(200),
      fuente: 'CAMPO',
      detalle_fuente: 'Visita, "a pie"',
      registrada_en: iso(300),
    },
  ],
};

const textos = () =>
  Object.fromEntries(
    Object.entries(EXPORTACION).map(([t, filas]) => [
      t,
      exportacionACsv(t as NombreDeTabla, filas),
    ]),
  ) as Record<NombreDeTabla, string>;

let raiz: string;

beforeEach(async () => {
  raiz = await mkdtemp(join(tmpdir(), 'evaluacion-'));
});

afterEach(async () => {
  await rm(raiz, { recursive: true, force: true });
});

describe('comandos del análisis del piloto (ADR-007)', () => {
  it('HU-14: exporta un CSV por tabla, analiza la carpeta y deja lo que lee contraste.R', async () => {
    const archivos = await exportarACarpeta({
      raiz,
      carpeta: 'exportacion',
      exportar: { ejecutar: () => Promise.resolve(textos()) },
    });

    const resultado = await analizarCarpeta({ raiz, carpeta: 'exportacion', salida: 'analisis' });

    expect(archivos).toHaveLength(10);
    expect(resultado.tareas).toEqual([
      expect.objectContaining({ vista: 'PROCESADA', aciertos: 1, omisiones: 0 }),
    ]);
    const tareas = leerCsv(await readFile(join(raiz, 'analisis', 'tareas.csv'), 'utf8'));
    expect(tareas[0]).toMatchObject({ participante: 'P01', aciertos: '1', duracion_ms: '60000' });
    expect(await readFile(join(raiz, 'analisis', 'resumen.md'), 'utf8')).toContain(
      '| H1a | tasa de acierto |',
    );
    for (const nombre of [
      'indicadores',
      'incidentes',
      'veracidad',
      'vigencia',
      'supervivencia',
      'costos',
    ]) {
      expect(
        (await readFile(join(raiz, 'analisis', `${nombre}.csv`), 'utf8')).length,
      ).toBeGreaterThan(0);
    }
  });

  it('HU-14: la sensibilidad recorre las 27 combinaciones de la malla', async () => {
    await exportarACarpeta({
      raiz,
      carpeta: 'exportacion',
      exportar: { ejecutar: () => Promise.resolve(textos()) },
    });

    const filas = await sensibilidadDeCarpeta({
      raiz,
      carpeta: 'exportacion',
      destino: 'sensibilidad.csv',
    });

    const csv = leerCsv(await readFile(join(raiz, 'sensibilidad.csv'), 'utf8'));
    expect(MALLA).toHaveLength(27);
    expect(filas).toBe(csv.length);
    expect(
      new Set(csv.map((f) => `${f['umbral']}-${f['factor_radio']}-${f['factor_ttl']}`)).size,
    ).toBe(27);
    // Con los parámetros del SRS el bloqueo queda con sus dos envíos: ninguna fusión errónea.
    const delSrs = csv.find(
      (f) =>
        f['umbral'] === '3' &&
        f['factor_radio'] === '1' &&
        f['factor_ttl'] === '1' &&
        f['indicador'] === 'fusiones erróneas',
    );
    expect(delSrs).toMatchObject({ valor: '0', n: '1' });
  });

  it('una ruta fuera del repositorio se rechaza', async () => {
    await expect(
      analizarCarpeta({ raiz, carpeta: '../fuera', salida: 'analisis' }),
    ).rejects.toThrow(/dentro del repositorio/);
    await expect(
      sensibilidadDeCarpeta({ raiz, carpeta: 'x', destino: 'sin-extension' }),
    ).rejects.toThrow(/\.csv/);
  });
});

describe('lectura de la exportación', () => {
  it('un campo con coma, comillas o salto de línea vuelve igual', () => {
    const filas = [{ a: 'uno, "dos"', b: 'tres\ncuatro', c: null }];

    expect(leerCsv(escribirCsv(['a', 'b', 'c'], filas))).toEqual([
      { a: 'uno, "dos"', b: 'tres\ncuatro', c: '' },
    ]);
  });

  it('rechaza una hora sin zona y una tabla sin sus columnas', () => {
    const conHoraLocal = {
      ...textos(),
      envios: textos().envios.replace(iso(0).toISOString(), '2026-11-22 12:00'),
    };
    const sinColumna = { ...textos(), votos: 'id_evento,id_reporte\nx,y\n' };

    expect(() => leerExportacion(conHoraLocal)).toThrow(/ISO 8601/);
    expect(() => leerExportacion(sinColumna)).toThrow(/votos.csv: faltan columnas/);
  });
});
