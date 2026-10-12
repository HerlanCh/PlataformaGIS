// Carga reportes y zonas sintéticos para medir las consultas espaciales: `pnpm seed:load [cantidad]`.
// Solo corre contra una base local: borra y vuelve a crear su propia carga, nunca datos reales.
import { reportsModulo } from '@gis/module-reports';
import { subscriptionsModulo } from '@gis/module-subscriptions';
import { crearDb, crearPool, migracionesDePlataforma, migrarTodo } from '@gis/platform';
import type { Pool } from '@gis/platform';
import {
  generadorAleatorio,
  idSintetico,
  reporteSintetico,
  zonaSintetica,
} from './datos-sinteticos.js';

const REPORTES_POR_DEFECTO = 100_000;
const ZONAS = 5_000;
const AUTORES = 2_000;
const LOTE = 5_000;
const SEMILLA = 20261012;
const ANFITRIONES_LOCALES = ['localhost', '127.0.0.1', '::1'];

function urlLocal(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL');
  const { hostname } = new URL(url);
  if (!ANFITRIONES_LOCALES.includes(hostname)) {
    throw new Error(`La carga sintética solo corre en una base local, no en "${hostname}"`);
  }
  return url;
}

async function borrarCargaAnterior(pool: Pool): Promise<void> {
  await pool.query(`delete from reportes where id::text like 'ffffffff-%'`);
  await pool.query(`delete from zonas_suscritas where id::text like 'eeeeeeee-%'`);
}

async function cargarReportes(pool: Pool, cantidad: number, ahora: Date): Promise<void> {
  const azar = generadorAleatorio(SEMILLA);
  for (let inicio = 0; inicio < cantidad; inicio += LOTE) {
    const tamano = Math.min(LOTE, cantidad - inicio);
    const lote = Array.from({ length: tamano }, () => reporteSintetico(ahora, azar));
    const serie = lote.map((_, i) => inicio + i + 1);

    // La ubicación pública se calcula como en `PoliticaDePrivacidad`: en una categoría sensible,
    // el centro de la celda de 200 m de la cuadrícula UTM 19 Sur; en las demás, la exacta.
    await pool.query(
      `insert into reportes (id, codigo_categoria, id_autor, estado, ttl_minutos, extensiones,
         motivo_rechazo, creado_en, caduca_en, ubicacion, ubicacion_publica, clave_idempotencia)
       select d.id, d.categoria, d.autor, d.estado, d.ttl, d.extensiones, d.motivo, d.creado,
         d.caduca, p.punto,
         case when c.es_sensible then
           st_transform(st_setsrid(st_makepoint(
             floor(st_x(u.utm) / 200) * 200 + 100, floor(st_y(u.utm) / 200) * 200 + 100), 32719), 4326)
         else p.punto end,
         d.clave
       from unnest($1::uuid[], $2::text[], $3::uuid[], $4::text[], $5::int[], $6::int[], $7::text[],
         $8::timestamptz[], $9::timestamptz[], $10::float8[], $11::float8[], $12::text[])
         as d(id, categoria, autor, estado, ttl, extensiones, motivo, creado, caduca, latitud, longitud, clave)
       join categorias c on c.codigo = d.categoria
       cross join lateral (select st_setsrid(st_makepoint(d.longitud, d.latitud), 4326) as punto) p
       cross join lateral (select st_transform(p.punto, 32719) as utm) u`,
      [
        serie.map((n) => idSintetico('f', n)),
        lote.map((r) => r.codigoCategoria),
        serie.map((n) => idSintetico('e', (n % AUTORES) + 1)),
        lote.map((r) => r.estado),
        lote.map((r) => r.ttlMinutos),
        lote.map((r) => r.extensiones),
        lote.map((r) => r.motivoRechazo),
        lote.map((r) => r.creadoEn.toISOString()),
        lote.map((r) => r.caducaEn.toISOString()),
        lote.map((r) => r.latitud),
        lote.map((r) => r.longitud),
        serie.map((n) => `semilla-${String(n).padStart(8, '0')}`),
      ],
    );
    console.log(`reportes: ${inicio + tamano} de ${cantidad}`);
  }
}

async function cargarZonas(pool: Pool, ahora: Date): Promise<void> {
  const azar = generadorAleatorio(SEMILLA + 1);
  const zonas = Array.from({ length: ZONAS }, () => zonaSintetica(azar));
  const serie = zonas.map((_, i) => i + 1);

  await pool.query(
    `insert into zonas_suscritas (id, id_usuario, centro, radio_m, categorias, creado_en)
     select d.id, d.usuario, st_setsrid(st_makepoint(d.longitud, d.latitud), 4326)::geography,
       d.radio, string_to_array(d.categorias, ','), $7::timestamptz
     from unnest($1::uuid[], $2::uuid[], $3::float8[], $4::float8[], $5::int[], $6::text[])
       as d(id, usuario, latitud, longitud, radio, categorias)`,
    [
      serie.map((n) => idSintetico('e', n)),
      serie.map((n) => idSintetico('e', (n % AUTORES) + 1)),
      zonas.map((z) => z.latitud),
      zonas.map((z) => z.longitud),
      zonas.map((z) => z.radioM),
      zonas.map((z) => z.categorias.join(',')),
      ahora.toISOString(),
    ],
  );
  console.log(`zonas suscritas: ${ZONAS}`);
}

const cantidad = Number(process.argv[2] ?? REPORTES_POR_DEFECTO);
if (!Number.isInteger(cantidad) || cantidad < 1) {
  throw new Error('La cantidad de reportes debe ser un entero positivo');
}

const pool = crearPool(urlLocal());
try {
  // Se migran `reports` y `subscriptions` aunque su interruptor esté apagado: la medición los necesita.
  await migrarTodo(crearDb(pool), [
    migracionesDePlataforma,
    reportsModulo.migraciones!,
    subscriptionsModulo.migraciones!,
  ]);
  const ahora = new Date();
  await borrarCargaAnterior(pool);
  await cargarReportes(pool, cantidad, ahora);
  await cargarZonas(pool, ahora);
  // Sin estadísticas frescas el planificador no elige bien los índices.
  await pool.query('analyze reportes');
  await pool.query('analyze zonas_suscritas');
  console.log('carga sintética lista');
} finally {
  await pool.end();
}
