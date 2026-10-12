// Mide las consultas espaciales con la carga sintética y archiva sus planes: `pnpm perf:espacial`.
// Falla si alguna consulta recorre la tabla completa o su p95 llega a 100 ms (RNF de la Fase 4).
import { writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConsultaMapaCalorPg } from '@gis/module-heatmap';
import { CATEGORIAS_MVP, RepositorioReportesPostgis } from '@gis/module-reports';
import { RepositorioSuscripcionesPg } from '@gis/module-subscriptions';
import { crearDb, crearPool } from '@gis/platform';
import type { Pool } from '@gis/platform';
import { AREA_DE_SERVICIO, codigoCategoria, PuntoGeo } from '@gis/shared-kernel';
import { generadorAleatorio, puntoSintetico } from './datos-sinteticos.js';
import { leerPlan, percentil } from './estadisticas.js';

const P95_MAXIMO_MS = 100;
const REPETICIONES = 300;
const CALENTAMIENTO = 20;
const SEMILLA = 4;
const DIAS_DE_CALOR = 30;
const LIMITE_VENTANA = 2000;
const LIMITE_CERCANOS = 500;
const DESTINO = fileURLToPath(
  new URL('../../../../docs/rendimiento/consultas-espaciales.md', import.meta.url),
);

interface Sentencia {
  readonly texto: string;
  readonly valores: readonly unknown[];
}

interface Caso {
  readonly nombre: string;
  readonly descripcion: string;
  ejecutar(): Promise<unknown>;
}

interface Resultado {
  readonly caso: Caso;
  readonly p50: number;
  readonly p95: number;
  readonly maximo: number;
  readonly sentencia: Sentencia;
  readonly plan: string;
  readonly problemas: readonly string[];
}

/** Envuelve el pool para anotar cada sentencia que Drizzle envía, con sus parámetros. */
function espiar(pool: Pool, anotadas: Sentencia[]): Pool {
  return new Proxy(pool, {
    get(objetivo, propiedad) {
      if (propiedad === 'query') {
        return (config: { text: string }, valores: unknown[] = []) => {
          anotadas.push({ texto: config.text, valores });
          return objetivo.query(config as never, valores);
        };
      }
      const valor: unknown = Reflect.get(objetivo, propiedad, objetivo);
      return typeof valor === 'function' ? (valor.bind(objetivo) as unknown) : valor;
    },
  });
}

async function medir(caso: Caso, pool: Pool, anotadas: Sentencia[]): Promise<Resultado> {
  for (let i = 0; i < CALENTAMIENTO; i += 1) await caso.ejecutar();

  const tiempos: number[] = [];
  for (let i = 0; i < REPETICIONES; i += 1) {
    const inicio = performance.now();
    await caso.ejecutar();
    tiempos.push(performance.now() - inicio);
  }

  // El plan se toma de la última sentencia real, con sus mismos parámetros.
  const sentencia = anotadas.at(-1)!;
  const { rows } = await pool.query<{ 'QUERY PLAN': string }>(
    `explain (analyze, buffers) ${sentencia.texto}`,
    [...sentencia.valores],
  );
  const plan = rows.map((fila) => fila['QUERY PLAN']).join('\n');

  const p95 = percentil(tiempos, 95);
  const lectura = leerPlan(plan);
  const problemas = [
    ...(p95 >= P95_MAXIMO_MS ? [`p95 de ${p95.toFixed(1)} ms`] : []),
    ...(lectura.usaIndice ? [] : ['no usa ningún índice']),
    ...lectura.recorridosCompletos.map((tabla) => `recorre completa la tabla ${tabla}`),
  ];
  return {
    caso,
    p50: percentil(tiempos, 50),
    p95,
    maximo: Math.max(...tiempos),
    sentencia,
    plan,
    problemas,
  };
}

function casos(pool: Pool): Caso[] {
  const db = crearDb(pool);
  const reportes = new RepositorioReportesPostgis(db);
  const zonas = new RepositorioSuscripcionesPg(db);
  const calor = new ConsultaMapaCalorPg(db);
  const azar = generadorAleatorio(SEMILLA);
  const punto = () => {
    const { latitud, longitud } = puntoSintetico(azar);
    return PuntoGeo.crear(latitud, longitud);
  };
  const caja = (centro: PuntoGeo, mitad: number) => ({
    latitudMin: centro.latitud - mitad,
    latitudMax: centro.latitud + mitad,
    longitudMin: centro.longitud - mitad,
    longitudMax: centro.longitud + mitad,
  });
  const categoria = () => CATEGORIAS_MVP[Math.floor(azar() * CATEGORIAS_MVP.length)]!;
  const ahora = new Date();
  const haceUnMes = new Date(ahora.getTime() - DIAS_DE_CALOR * 24 * 60 * 60 * 1000);

  const vigentes = ['ACTIVO', 'CONFIRMADO'] as const;
  const centro = PuntoGeo.crear(-16.4955, -68.1336);

  return [
    {
      nombre: 'buscarEnVentana',
      descripcion: 'Reportes vigentes en una ventana de unos 2,2 km de lado',
      ejecutar: () => reportes.buscarEnVentana(caja(punto(), 0.01), [], vigentes, LIMITE_VENTANA),
    },
    {
      nombre: 'buscarEnVentana (peor caso)',
      descripcion: `Toda el área de servicio; devuelve el tope de ${LIMITE_VENTANA} reportes`,
      ejecutar: () => reportes.buscarEnVentana(AREA_DE_SERVICIO, [], vigentes, LIMITE_VENTANA),
    },
    {
      nombre: 'buscarCercanos',
      descripcion: 'Reportes vigentes a 500 m o menos de un punto',
      ejecutar: () => reportes.buscarCercanos(punto(), 500, LIMITE_CERCANOS),
    },
    {
      nombre: 'buscarCercanos (peor caso)',
      descripcion: `A 2 km del centro, la zona más densa; devuelve el tope de ${LIMITE_CERCANOS}`,
      ejecutar: () => reportes.buscarCercanos(centro, 2000, LIMITE_CERCANOS),
    },
    {
      nombre: 'buscarDuplicado',
      descripcion: 'Reporte vigente de la misma categoría dentro de su radio de deduplicación',
      ejecutar: () => reportes.buscarDuplicado(categoria(), punto(), ahora),
    },
    {
      nombre: 'buscarCaducados',
      descripcion: 'Lote de 500 reportes vigentes con la caducidad vencida',
      ejecutar: () => reportes.buscarCaducados(ahora, 500),
    },
    {
      nombre: 'mapa de calor',
      descripcion: `Celdas de 500 m en una ventana de unos 6,6 km de lado, últimos ${DIAS_DE_CALOR} días`,
      ejecutar: () =>
        calor.agregar({
          caja: caja(punto(), 0.03),
          tamanoCeldaM: 500,
          desde: haceUnMes,
          hasta: ahora,
          categorias: [],
        }),
    },
    {
      nombre: 'mapa de calor (peor caso)',
      descripcion: `Celdas de 500 m en toda el área de servicio, últimos ${DIAS_DE_CALOR} días`,
      ejecutar: () =>
        calor.agregar({
          caja: AREA_DE_SERVICIO,
          tamanoCeldaM: 500,
          desde: haceUnMes,
          hasta: ahora,
          categorias: [],
        }),
    },
    {
      nombre: 'buscarSuscriptores',
      descripcion: 'Zonas suscritas cuyo círculo contiene un punto, por categoría',
      ejecutar: () => zonas.buscarSuscriptores(punto(), codigoCategoria(categoria().codigo)),
    },
  ];
}

async function entorno(pool: Pool): Promise<string[]> {
  const unValor = async (consulta: string) =>
    String(Object.values((await pool.query(consulta)).rows[0] as object)[0]);
  const procesador = os.cpus()[0]?.model.trim() ?? 'desconocido';
  return [
    `- **Fecha:** ${new Date().toISOString()}`,
    `- **Reportes:** ${await unValor('select count(*) from reportes')} (${await unValor(
      `select count(*) from reportes where estado in ('ACTIVO', 'CONFIRMADO')`,
    )} vigentes) · **Zonas suscritas:** ${await unValor('select count(*) from zonas_suscritas')}`,
    `- **PostgreSQL:** ${await unValor('show server_version')} · **PostGIS:** ${await unValor(
      'select postgis_lib_version()',
    )} (contenedor Docker local)`,
    `- **Máquina:** ${procesador}, ${os.cpus().length} hilos, ${Math.round(
      os.totalmem() / 2 ** 30,
    )} GB de RAM, ${os.type()} ${os.release()} · **Node:** ${process.version}`,
    `- **Método:** ${CALENTAMIENTO} ejecuciones de calentamiento y ${REPETICIONES} medidas por consulta, cada una con parámetros aleatorios distintos (semilla fija). El tiempo incluye el viaje al contenedor y el mapeo de filas a objetos del dominio.`,
  ];
}

function informe(resultados: readonly Resultado[], datosDelEntorno: readonly string[]): string {
  const ms = (valor: number) => valor.toFixed(1);
  const filas = resultados.map(
    (r) =>
      `| \`${r.caso.nombre}\` | ${r.caso.descripcion} | ${ms(r.p50)} | ${ms(r.p95)} | ${ms(r.maximo)} | ${
        r.problemas.length === 0 ? 'Cumple' : `**No cumple:** ${r.problemas.join('; ')}`
      } |`,
  );
  const detalles = resultados.flatMap((r) => [
    `## \`${r.caso.nombre}\``,
    '',
    `${r.caso.descripcion}.`,
    '',
    '```sql',
    r.sentencia.texto.trim().replaceAll(/\n\s+/g, '\n'),
    '```',
    '',
    '```text',
    r.plan,
    '```',
    '',
  ]);
  return [
    '# Rendimiento de las consultas espaciales',
    '',
    'Evidencia de eficiencia de la Fase 4 (ISO/IEC 25010). Archivo generado por `pnpm perf:espacial`; no editarlo a mano.',
    '',
    `Criterio: cada consulta usa un índice (sin recorrer completa ninguna tabla) y su p95 es menor a ${P95_MAXIMO_MS} ms.`,
    '',
    '## Entorno',
    '',
    ...datosDelEntorno,
    '',
    '## Resumen',
    '',
    '| Consulta | Qué mide | p50 (ms) | p95 (ms) | Máximo (ms) | Resultado |',
    '| :--- | :--- | ---: | ---: | ---: | :--- |',
    ...filas,
    '',
    ...detalles,
  ].join('\n');
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error('Falta DATABASE_URL');

const pool = crearPool(url);
try {
  const anotadas: Sentencia[] = [];
  const resultados: Resultado[] = [];
  for (const caso of casos(espiar(pool, anotadas))) {
    const resultado = await medir(caso, pool, anotadas);
    resultados.push(resultado);
    console.log(
      `${caso.nombre}: p50 ${resultado.p50.toFixed(1)} ms, p95 ${resultado.p95.toFixed(1)} ms` +
        (resultado.problemas.length > 0 ? ` — ${resultado.problemas.join('; ')}` : ''),
    );
  }

  await mkdir(path.dirname(DESTINO), { recursive: true });
  await writeFile(DESTINO, informe(resultados, await entorno(pool)));
  console.log(`informe: ${DESTINO}`);

  if (resultados.some((r) => r.problemas.length > 0)) process.exitCode = 1;
} finally {
  await pool.end();
}
