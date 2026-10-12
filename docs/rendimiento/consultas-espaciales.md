# Rendimiento de las consultas espaciales

Evidencia de eficiencia de la Fase 4 (ISO/IEC 25010). Archivo generado por `pnpm perf:espacial`; no editarlo a mano.

Criterio: cada consulta usa un índice (sin recorrer completa ninguna tabla) y su p95 es menor a 100 ms.

## Entorno

- **Fecha:** 2026-10-12T21:42:42.965Z
- **Reportes:** 100000 (20143 vigentes) · **Zonas suscritas:** 5000
- **PostgreSQL:** 18.6 (Debian 18.6-1.pgdg13+2) · **PostGIS:** 3.6.4 (contenedor Docker local)
- **Máquina:** AMD Ryzen 5 5600G with Radeon Graphics, 12 hilos, 16 GB de RAM, Windows_NT 10.0.22631 · **Node:** v24.20.0
- **Método:** 20 ejecuciones de calentamiento y 300 medidas por consulta, cada una con parámetros aleatorios distintos (semilla fija). El tiempo incluye el viaje al contenedor y el mapeo de filas a objetos del dominio.

## Resumen

| Consulta | Qué mide | p50 (ms) | p95 (ms) | Máximo (ms) | Resultado |
| :--- | :--- | ---: | ---: | ---: | :--- |
| `buscarEnVentana` | Reportes vigentes en una ventana de unos 2,2 km de lado | 9.8 | 13.8 | 323.1 | Cumple |
| `buscarEnVentana (peor caso)` | Toda el área de servicio; devuelve el tope de 2000 reportes | 8.3 | 9.9 | 11.9 | Cumple |
| `buscarCercanos` | Reportes vigentes a 500 m o menos de un punto | 8.8 | 12.1 | 317.9 | Cumple |
| `buscarCercanos (peor caso)` | A 2 km del centro, la zona más densa; devuelve el tope de 500 | 32.6 | 35.8 | 343.9 | Cumple |
| `buscarDuplicado` | Reporte vigente de la misma categoría dentro de su radio de deduplicación | 2.6 | 3.3 | 4.0 | Cumple |
| `buscarCaducados` | Lote de 500 reportes vigentes con la caducidad vencida | 5.9 | 6.5 | 8.6 | Cumple |
| `mapa de calor` | Celdas de 500 m en una ventana de unos 6,6 km de lado, últimos 30 días | 17.4 | 22.6 | 26.0 | Cumple |
| `mapa de calor (peor caso)` | Celdas de 500 m en toda el área de servicio, últimos 30 días | 37.6 | 40.5 | 350.5 | Cumple |
| `buscarSuscriptores` | Zonas suscritas cuyo círculo contiene un punto, por categoría | 1.6 | 2.5 | 2.7 | Cumple |

## `buscarEnVentana`

Reportes vigentes en una ventana de unos 2,2 km de lado.

```sql
select "id", "codigo_categoria", "estado", st_y("ubicacion_publica"), st_x("ubicacion_publica"), "creado_en", "caduca_en" from "reportes" where ("reportes"."ubicacion_publica" && st_makeenvelope($1, $2, $3, $4, 4326) and "reportes"."estado" in ($5, $6)) order by "reportes"."creado_en" desc, "reportes"."id" asc limit $7
```

```text
Limit  (cost=1489.66..1489.92 rows=103 width=64) (actual time=2.210..2.219 rows=98.00 loops=1)
  Buffers: shared hit=444
  ->  Sort  (cost=1489.66..1489.92 rows=103 width=64) (actual time=2.209..2.213 rows=98.00 loops=1)
        Sort Key: creado_en DESC, id
        Sort Method: quicksort  Memory: 38kB
        Buffers: shared hit=444
        ->  Bitmap Heap Scan on reportes  (cost=1120.73..1486.22 rows=103 width=64) (actual time=2.038..2.191 rows=98.00 loops=1)
              Recheck Cond: ((ubicacion_publica && '0103000020E610000001000000050000005CEFB85E560C51C0AF87E1754F8230C05CEFB85E560C51C0299C8FBD307D30C07A74A4B00E0B51C0299C8FBD307D30C07A74A4B00E0B51C0AF87E1754F8230C05CEFB85E560C51C0AF87E1754F8230C0'::geometry) AND (estado = ANY ('{ACTIVO,CONFIRMADO}'::text[])))
              Heap Blocks: exact=196
              Buffers: shared hit=444
              ->  BitmapAnd  (cost=1120.73..1120.73 rows=103 width=0) (actual time=2.018..2.019 rows=0.00 loops=1)
                    Buffers: shared hit=248
                    ->  Bitmap Index Scan on reportes_ubicacion_publica_idx  (cost=0.00..28.13 rows=513 width=0) (actual time=0.127..0.127 rows=906.00 loops=1)
                          Index Cond: (ubicacion_publica && '0103000020E610000001000000050000005CEFB85E560C51C0AF87E1754F8230C05CEFB85E560C51C0299C8FBD307D30C07A74A4B00E0B51C0299C8FBD307D30C07A74A4B00E0B51C0AF87E1754F8230C05CEFB85E560C51C0AF87E1754F8230C0'::geometry)
                          Index Searches: 1
                          Buffers: shared hit=15
                    ->  Bitmap Index Scan on reportes_vigentes_idx  (cost=0.00..1092.30 rows=20003 width=0) (actual time=1.821..1.821 rows=40286.00 loops=1)
                          Index Searches: 1
                          Buffers: shared hit=233
Planning Time: 0.106 ms
Execution Time: 2.233 ms
```

## `buscarEnVentana (peor caso)`

Toda el área de servicio; devuelve el tope de 2000 reportes.

```sql
select "id", "codigo_categoria", "estado", st_y("ubicacion_publica"), st_x("ubicacion_publica"), "creado_en", "caduca_en" from "reportes" where ("reportes"."ubicacion_publica" && st_makeenvelope($1, $2, $3, $4, 4326) and "reportes"."estado" in ($5, $6)) order by "reportes"."creado_en" desc, "reportes"."id" asc limit $7
```

```text
Limit  (cost=1.60..2445.13 rows=2000 width=64) (actual time=0.087..2.447 rows=2000.00 loops=1)
  Buffers: shared hit=2010
  ->  Incremental Sort  (cost=1.60..24440.52 rows=20003 width=64) (actual time=0.085..2.334 rows=2000.00 loops=1)
        Sort Key: creado_en DESC, id
        Presorted Key: creado_en
        Full-sort Groups: 63  Sort Method: quicksort  Average Memory: 29kB  Peak Memory: 29kB
        Buffers: shared hit=2010
        ->  Index Scan Backward using reportes_creado_en_idx on reportes  (cost=0.42..23540.39 rows=20003 width=64) (actual time=0.024..1.919 rows=2001.00 loops=1)
              Filter: ((ubicacion_publica && '0103000020E6100000010000000500000085EB51B81E1551C0EC51B81E85AB30C085EB51B81E1551C0E17A14AE476130C000000000000051C0E17A14AE476130C000000000000051C0EC51B81E85AB30C085EB51B81E1551C0EC51B81E85AB30C0'::geometry) AND (estado = ANY ('{ACTIVO,CONFIRMADO}'::text[])))
              Index Searches: 1
              Buffers: shared hit=2010
Planning Time: 0.178 ms
Execution Time: 2.518 ms
```

## `buscarCercanos`

Reportes vigentes a 500 m o menos de un punto.

```sql
select "id", "codigo_categoria", "id_autor", "estado", "ttl_minutos", "extensiones", "motivo_rechazo", "creado_en", "caduca_en", "ubicacion", "ubicacion_publica", "clave_idempotencia" from "reportes" where ("reportes"."estado" in ($1, $2) and st_dwithin("reportes"."ubicacion"::geography, st_setsrid(st_makepoint($3, $4), 4326)::geography, $5)) order by st_distance("reportes"."ubicacion"::geography, st_setsrid(st_makepoint($6, $7), 4326)::geography) limit $8
```

```text
Limit  (cost=7022.53..7022.54 rows=2 width=172) (actual time=3.346..3.367 rows=236.00 loops=1)
  Buffers: shared hit=913
  ->  Sort  (cost=7022.53..7022.54 rows=2 width=172) (actual time=3.345..3.354 rows=236.00 loops=1)
        Sort Key: (st_distance((ubicacion)::geography, '0101000020E6100000E5D0D07D9C0551C0AAF1F62FBD8930C0'::geography, true))
        Sort Method: quicksort  Memory: 85kB
        Buffers: shared hit=913
        ->  Bitmap Heap Scan on reportes  (cost=1230.83..7022.52 rows=2 width=172) (actual time=2.350..3.277 rows=236.00 loops=1)
              Recheck Cond: (estado = ANY ('{ACTIVO,CONFIRMADO}'::text[]))
              Filter: st_dwithin((ubicacion)::geography, '0101000020E6100000E5D0D07D9C0551C0AAF1F62FBD8930C0'::geography, '500'::double precision, true)
              Rows Removed by Filter: 97
              Heap Blocks: exact=620
              Buffers: shared hit=913
              ->  BitmapAnd  (cost=1230.83..1230.83 rows=370 width=0) (actual time=2.283..2.283 rows=0.00 loops=1)
                    Buffers: shared hit=293
                    ->  Bitmap Index Scan on reportes_ubicacion_geography_idx  (cost=0.00..138.28 rows=1850 width=0) (actual time=0.474..0.474 rows=3430.00 loops=1)
                          Index Cond: ((ubicacion)::geography && _st_expand('0101000020E6100000E5D0D07D9C0551C0AAF1F62FBD8930C0'::geography, '500'::double precision))
                          Index Searches: 1
                          Buffers: shared hit=60
                    ->  Bitmap Index Scan on reportes_vigentes_idx  (cost=0.00..1092.30 rows=20003 width=0) (actual time=1.741..1.741 rows=40286.00 loops=1)
                          Index Searches: 1
                          Buffers: shared hit=233
Planning Time: 1.034 ms
Execution Time: 3.404 ms
```

## `buscarCercanos (peor caso)`

A 2 km del centro, la zona más densa; devuelve el tope de 500.

```sql
select "id", "codigo_categoria", "id_autor", "estado", "ttl_minutos", "extensiones", "motivo_rechazo", "creado_en", "caduca_en", "ubicacion", "ubicacion_publica", "clave_idempotencia" from "reportes" where ("reportes"."estado" in ($1, $2) and st_dwithin("reportes"."ubicacion"::geography, st_setsrid(st_makepoint($3, $4), 4326)::geography, $5)) order by st_distance("reportes"."ubicacion"::geography, st_setsrid(st_makepoint($6, $7), 4326)::geography) limit $8
```

```text
Limit  (cost=34488.73..34488.73 rows=2 width=172) (actual time=22.196..25.979 rows=500.00 loops=1)
  Buffers: shared hit=4290
  ->  Sort  (cost=34488.73..34488.73 rows=2 width=172) (actual time=22.194..25.950 rows=500.00 loops=1)
        Sort Key: (st_distance((ubicacion)::geography, '0101000020E6100000B8AF03E78C0851C0022B8716D97E30C0'::geography, true))
        Sort Method: top-N heapsort  Memory: 241kB
        Buffers: shared hit=4290
        ->  Gather  (cost=3889.06..34488.72 rows=2 width=172) (actual time=4.269..24.716 rows=3797.00 loops=1)
              Workers Planned: 2
              Workers Launched: 2
              Buffers: shared hit=4290
              ->  Parallel Bitmap Heap Scan on reportes  (cost=2889.06..33488.52 rows=1 width=172) (actual time=6.931..10.397 rows=1265.67 loops=3)
                    Recheck Cond: (estado = ANY ('{ACTIVO,CONFIRMADO}'::text[]))
                    Filter: st_dwithin((ubicacion)::geography, '0101000020E6100000B8AF03E78C0851C0022B8716D97E30C0'::geography, '2000'::double precision, true)
                    Rows Removed by Filter: 400
                    Heap Blocks: exact=2146
                    Buffers: shared hit=4290
                    Worker 0:  Heap Blocks: exact=2
                    Worker 1:  Heap Blocks: exact=2
                    ->  BitmapAnd  (cost=2889.06..2889.06 rows=4910 width=0) (actual time=3.842..3.843 rows=0.00 loops=1)
                          Buffers: shared hit=800
                          ->  Bitmap Index Scan on reportes_vigentes_idx  (cost=0.00..1088.30 rows=20003 width=0) (actual time=1.406..1.407 rows=20143.00 loops=1)
                                Index Searches: 1
                                Buffers: shared hit=232
                          ->  Bitmap Index Scan on reportes_ubicacion_geography_idx  (cost=0.00..1800.51 rows=24547 width=0) (actual time=2.388..2.388 rows=24538.00 loops=1)
                                Index Cond: ((ubicacion)::geography && _st_expand('0101000020E6100000B8AF03E78C0851C0022B8716D97E30C0'::geography, '2000'::double precision))
                                Index Searches: 1
                                Buffers: shared hit=568
Planning Time: 1.623 ms
Execution Time: 26.068 ms
```

## `buscarDuplicado`

Reporte vigente de la misma categoría dentro de su radio de deduplicación.

```sql
select "id", "codigo_categoria", "id_autor", "estado", "ttl_minutos", "extensiones", "motivo_rechazo", "creado_en", "caduca_en", "ubicacion", "ubicacion_publica", "clave_idempotencia" from "reportes" where ("reportes"."codigo_categoria" = $1 and "reportes"."estado" in ($2, $3) and "reportes"."caduca_en" > $4 and st_dwithin("reportes"."ubicacion"::geography, st_setsrid(st_makepoint($5, $6), 4326)::geography, $7)) order by st_distance("reportes"."ubicacion"::geography, st_setsrid(st_makepoint($8, $9), 4326)::geography) limit $10
```

```text
Limit  (cost=367.96..367.97 rows=1 width=172) (actual time=1.152..1.153 rows=1.00 loops=1)
  Buffers: shared hit=352
  ->  Sort  (cost=367.96..367.97 rows=1 width=172) (actual time=1.152..1.152 rows=1.00 loops=1)
        Sort Key: (st_distance((ubicacion)::geography, '0101000020E61000004200E5ADE30951C03D8A799AB37F30C0'::geography, true))
        Sort Method: top-N heapsort  Memory: 25kB
        Buffers: shared hit=352
        ->  Bitmap Heap Scan on reportes  (cost=224.27..367.95 rows=1 width=172) (actual time=1.082..1.147 rows=6.00 loops=1)
              Recheck Cond: ((caduca_en > '2026-10-12 21:41:59.689+00'::timestamp with time zone) AND (estado = ANY ('{ACTIVO,CONFIRMADO}'::text[])))
              Filter: ((codigo_categoria = 'jauria'::text) AND st_dwithin((ubicacion)::geography, '0101000020E61000004200E5ADE30951C03D8A799AB37F30C0'::geography, '150'::double precision, true))
              Rows Removed by Filter: 57
              Heap Blocks: exact=63
              Buffers: shared hit=352
              ->  BitmapAnd  (cost=224.27..224.27 rows=8 width=0) (actual time=1.063..1.063 rows=0.00 loops=1)
                    Buffers: shared hit=289
                    ->  Bitmap Index Scan on reportes_ubicacion_geography_idx  (cost=0.00..17.90 rows=199 width=0) (actual time=0.250..0.250 rows=375.00 loops=1)
                          Index Cond: ((ubicacion)::geography && _st_expand('0101000020E61000004200E5ADE30951C03D8A799AB37F30C0'::geography, '150'::double precision))
                          Index Searches: 1
                          Buffers: shared hit=69
                    ->  Bitmap Index Scan on reportes_vigentes_idx  (cost=0.00..206.12 rows=3784 width=0) (actual time=0.802..0.802 rows=19161.00 loops=1)
                          Index Cond: (caduca_en > '2026-10-12 21:41:59.689+00'::timestamp with time zone)
                          Index Searches: 2
                          Buffers: shared hit=220
Planning Time: 1.073 ms
Execution Time: 1.172 ms
```

## `buscarCaducados`

Lote de 500 reportes vigentes con la caducidad vencida.

```sql
select "id", "codigo_categoria", "id_autor", "estado", "ttl_minutos", "extensiones", "motivo_rechazo", "creado_en", "caduca_en", "ubicacion", "ubicacion_publica", "clave_idempotencia" from "reportes" where ("reportes"."estado" in ($1, $2) and "reportes"."caduca_en" < $3) order by "reportes"."caduca_en" asc, "reportes"."id" asc limit $4
```

```text
Limit  (cost=6565.88..6567.13 rows=500 width=164) (actual time=0.877..0.924 rows=500.00 loops=1)
  Buffers: shared hit=834
  ->  Sort  (cost=6565.88..6606.42 rows=16219 width=164) (actual time=0.876..0.898 rows=500.00 loops=1)
        Sort Key: caduca_en, id
        Sort Method: quicksort  Memory: 278kB
        Buffers: shared hit=834
        ->  Bitmap Heap Scan on reportes  (cost=707.41..5757.70 rows=16219 width=164) (actual time=0.167..0.749 rows=982.00 loops=1)
              Recheck Cond: ((caduca_en < '2026-10-12 21:41:59.689+00'::timestamp with time zone) AND (estado = ANY ('{ACTIVO,CONFIRMADO}'::text[])))
              Heap Blocks: exact=811
              Buffers: shared hit=834
              ->  Bitmap Index Scan on reportes_vigentes_idx  (cost=0.00..703.36 rows=16219 width=0) (actual time=0.092..0.092 rows=982.00 loops=1)
                    Index Cond: (caduca_en < '2026-10-12 21:41:59.689+00'::timestamp with time zone)
                    Index Searches: 3
                    Buffers: shared hit=23
Planning Time: 0.082 ms
Execution Time: 0.950 ms
```

## `mapa de calor`

Celdas de 500 m en una ventana de unos 6,6 km de lado, últimos 30 días.

```sql
select st_y(celda) as latitud, st_x(celda) as longitud, count(*)::int as cantidad
from (
select st_snaptogrid(ubicacion_publica, 0, 0, $1, $2) as celda
from reportes
where ubicacion_publica && st_makeenvelope($3, $4, $5, $6, 4326)
and creado_en between $7 and $8
and estado <> 'RECHAZADO'
) agrupados
where st_y(celda) between $9 and $10
and st_x(celda) between $11 and $12
group by celda
having count(*) >= $13
order by cantidad desc, latitud, longitud
```

```text
Sort  (cost=2174.65..2174.65 rows=1 width=52) (actual time=1.752..1.754 rows=44.00 loops=1)
  Sort Key: ((count(*))::integer) DESC, (st_y((st_snaptogrid(reportes.ubicacion_publica, '0'::double precision, '0'::double precision, '0.0046903360224517295'::double precision, '0.004496605063177301'::double precision)))), (st_x((st_snaptogrid(reportes.ubicacion_publica, '0'::double precision, '0'::double precision, '0.0046903360224517295'::double precision, '0.004496605063177301'::double precision))))
  Sort Method: quicksort  Memory: 28kB
  Buffers: shared hit=460
  ->  GroupAggregate  (cost=2174.23..2174.64 rows=1 width=52) (actual time=1.682..1.742 rows=44.00 loops=1)
        Group Key: (st_snaptogrid(reportes.ubicacion_publica, '0'::double precision, '0'::double precision, '0.0046903360224517295'::double precision, '0.004496605063177301'::double precision))
        Filter: (count(*) >= '3'::bigint)
        Rows Removed by Filter: 62
        Buffers: shared hit=460
        ->  Sort  (cost=2174.23..2174.24 rows=1 width=64) (actual time=1.676..1.685 rows=270.00 loops=1)
              Sort Key: (st_snaptogrid(reportes.ubicacion_publica, '0'::double precision, '0'::double precision, '0.0046903360224517295'::double precision, '0.004496605063177301'::double precision))
              Sort Method: quicksort  Memory: 46kB
              Buffers: shared hit=460
              ->  Bitmap Heap Scan on reportes  (cost=1122.61..2174.22 rows=1 width=64) (actual time=1.240..1.613 rows=270.00 loops=1)
                    Recheck Cond: ((ubicacion_publica && '0103000020E610000001000000050000009CC7D8937E1551C0A00BB20BF8AC30C09CC7D8937E1551C0E9647E64DA9C30C097651DBA4A1151C0E9647E64DA9C30C097651DBA4A1151C0A00BB20BF8AC30C09CC7D8937E1551C0A00BB20BF8AC30C0'::geometry) AND (creado_en >= '2026-09-12 21:41:59.689+00'::timestamp with time zone) AND (creado_en <= '2026-10-12 21:41:59.689+00'::timestamp with time zone))
                    Filter: ((estado <> 'RECHAZADO'::text) AND (st_y(st_snaptogrid(ubicacion_publica, '0'::double precision, '0'::double precision, '0.0046903360224517295'::double precision, '0.004496605063177301'::double precision)) >= '-16.674535725527228'::double precision) AND (st_y(st_snaptogrid(ubicacion_publica, '0'::double precision, '0'::double precision, '0.0046903360224517295'::double precision, '0.004496605063177301'::double precision)) <= '-16.613831557174333'::double precision) AND (st_x(st_snaptogrid(ubicacion_publica, '0'::double precision, '0'::double precision, '0.0046903360224517295'::double precision, '0.004496605063177301'::double precision)) >= '-68.33467809510486'::double precision) AND (st_x(st_snaptogrid(ubicacion_publica, '0'::double precision, '0'::double precision, '0.0046903360224517295'::double precision, '0.004496605063177301'::double precision)) <= '-68.27135855880177'::double precision))
                    Rows Removed by Filter: 5
                    Heap Blocks: exact=262
                    Buffers: shared hit=460
                    ->  BitmapAnd  (cost=1122.61..1122.61 rows=281 width=0) (actual time=1.213..1.213 rows=0.00 loops=1)
                          Buffers: shared hit=198
                          ->  Bitmap Index Scan on reportes_ubicacion_publica_idx  (cost=0.00..42.56 rows=837 width=0) (actual time=0.086..0.086 rows=824.00 loops=1)
                                Index Cond: (ubicacion_publica && '0103000020E610000001000000050000009CC7D8937E1551C0A00BB20BF8AC30C09CC7D8937E1551C0E9647E64DA9C30C097651DBA4A1151C0E9647E64DA9C30C097651DBA4A1151C0A00BB20BF8AC30C09CC7D8937E1551C0A00BB20BF8AC30C0'::geometry)
                                Index Searches: 1
                                Buffers: shared hit=11
                          ->  Bitmap Index Scan on reportes_creado_en_idx  (cost=0.00..1079.80 rows=33538 width=0) (actual time=1.105..1.105 rows=33294.00 loops=1)
                                Index Cond: ((creado_en >= '2026-09-12 21:41:59.689+00'::timestamp with time zone) AND (creado_en <= '2026-10-12 21:41:59.689+00'::timestamp with time zone))
                                Index Searches: 1
                                Buffers: shared hit=187
Planning:
  Buffers: shared hit=4
Planning Time: 0.192 ms
Execution Time: 1.778 ms
```

## `mapa de calor (peor caso)`

Celdas de 500 m en toda el área de servicio, últimos 30 días.

```sql
select st_y(celda) as latitud, st_x(celda) as longitud, count(*)::int as cantidad
from (
select st_snaptogrid(ubicacion_publica, 0, 0, $1, $2) as celda
from reportes
where ubicacion_publica && st_makeenvelope($3, $4, $5, $6, 4326)
and creado_en between $7 and $8
and estado <> 'RECHAZADO'
) agrupados
where st_y(celda) between $9 and $10
and st_x(celda) between $11 and $12
group by celda
having count(*) >= $13
order by cantidad desc, latitud, longitud
```

```text
Sort  (cost=14433.50..14433.50 rows=1 width=52) (actual time=38.068..38.366 rows=1850.00 loops=1)
  Sort Key: ((count(*))::integer) DESC, (st_y((st_snaptogrid(reportes.ubicacion_publica, '0'::double precision, '0'::double precision, '0.0046903360224517295'::double precision, '0.004496605063177301'::double precision)))), (st_x((st_snaptogrid(reportes.ubicacion_publica, '0'::double precision, '0'::double precision, '0.0046903360224517295'::double precision, '0.004496605063177301'::double precision))))
  Sort Method: quicksort  Memory: 179kB
  Buffers: shared hit=2632
  ->  GroupAggregate  (cost=14433.08..14433.49 rows=1 width=52) (actual time=30.593..37.854 rows=1850.00 loops=1)
        Group Key: (st_snaptogrid(reportes.ubicacion_publica, '0'::double precision, '0'::double precision, '0.0046903360224517295'::double precision, '0.004496605063177301'::double precision))
        Filter: (count(*) >= '3'::bigint)
        Rows Removed by Filter: 1860
        Buffers: shared hit=2632
        ->  Sort  (cost=14433.08..14433.09 rows=1 width=64) (actual time=30.581..33.380 rows=32474.00 loops=1)
              Sort Key: (st_snaptogrid(reportes.ubicacion_publica, '0'::double precision, '0'::double precision, '0.0046903360224517295'::double precision, '0.004496605063177301'::double precision))
              Sort Method: quicksort  Memory: 3306kB
              Buffers: shared hit=2632
              ->  Gather  (cost=2079.80..14433.07 rows=1 width=64) (actual time=2.064..18.918 rows=32474.00 loops=1)
                    Workers Planned: 2
                    Workers Launched: 2
                    Buffers: shared hit=2632
                    ->  Parallel Bitmap Heap Scan on reportes  (cost=1079.80..13432.97 rows=1 width=64) (actual time=0.716..12.307 rows=10824.67 loops=3)
                          Recheck Cond: ((creado_en >= '2026-09-12 21:41:59.689+00'::timestamp with time zone) AND (creado_en <= '2026-10-12 21:41:59.689+00'::timestamp with time zone))
                          Filter: ((ubicacion_publica && '0103000020E61000000100000005000000E5D226BB311551C0255B2E5BD1AB30C0E5D226BB311551C0F58BBE89FE6030C016F4CBA1E1FF50C0F58BBE89FE6030C016F4CBA1E1FF50C0255B2E5BD1AB30C0E5D226BB311551C0255B2E5BD1AB30C0'::geometry) AND (estado <> 'RECHAZADO'::text) AND (st_y(st_snaptogrid(ubicacion_publica, '0'::double precision, '0'::double precision, '0.0046903360224517295'::double precision, '0.004496605063177301'::double precision)) >= '-16.67003912046405'::double precision) AND (st_y(st_snaptogrid(ubicacion_publica, '0'::double precision, '0'::double precision, '0.0046903360224517295'::double precision, '0.004496605063177301'::double precision)) <= '-16.380008093889113'::double precision) AND (st_x(st_snaptogrid(ubicacion_publica, '0'::double precision, '0'::double precision, '0.0046903360224517295'::double precision, '0.004496605063177301'::double precision)) >= '-68.32998775908241'::double precision) AND (st_x(st_snaptogrid(ubicacion_publica, '0'::double precision, '0'::double precision, '0.0046903360224517295'::double precision, '0.004496605063177301'::double precision)) <= '-67.99931906949956'::double precision))
                          Rows Removed by Filter: 273
                          Heap Blocks: exact=1085
                          Buffers: shared hit=2632
                          Worker 0:  Heap Blocks: exact=713
                          Worker 1:  Heap Blocks: exact=607
                          ->  Bitmap Index Scan on reportes_creado_en_idx  (cost=0.00..1079.80 rows=33538 width=0) (actual time=1.635..1.636 rows=33294.00 loops=1)
                                Index Cond: ((creado_en >= '2026-09-12 21:41:59.689+00'::timestamp with time zone) AND (creado_en <= '2026-10-12 21:41:59.689+00'::timestamp with time zone))
                                Index Searches: 1
                                Buffers: shared hit=187
Planning:
  Buffers: shared hit=4
Planning Time: 0.254 ms
Execution Time: 38.750 ms
```

## `buscarSuscriptores`

Zonas suscritas cuyo círculo contiene un punto, por categoría.

```sql
select "id", "id_usuario", st_y("centro"::geometry), st_x("centro"::geometry), "radio_m", "categorias", "creado_en" from "zonas_suscritas" where st_dwithin("zonas_suscritas"."centro", st_setsrid(st_makepoint($1, $2), 4326)::geography, $3)
and st_dwithin("zonas_suscritas"."centro", st_setsrid(st_makepoint($4, $5), 4326)::geography, "zonas_suscritas"."radio_m")
and $6 = any("zonas_suscritas"."categorias") order by "zonas_suscritas"."creado_en" asc, "zonas_suscritas"."id" asc
```

```text
Sort  (cost=727.95..727.96 rows=1 width=107) (actual time=0.043..0.044 rows=1.00 loops=1)
  Sort Key: creado_en, id
  Sort Method: quicksort  Memory: 25kB
  Buffers: shared hit=26
  ->  Bitmap Heap Scan on zonas_suscritas  (cost=4.47..727.94 rows=1 width=107) (actual time=0.037..0.041 rows=1.00 loops=1)
        Filter: (('jauria'::text = ANY (categorias)) AND st_dwithin(centro, '0101000020E6100000B83E2322D20E51C0A4F05E9F656E30C0'::geography, '2000'::double precision, true) AND st_dwithin(centro, '0101000020E6100000B83E2322D20E51C0A4F05E9F656E30C0'::geography, (radio_m)::double precision, true))
        Rows Removed by Filter: 25
        Heap Blocks: exact=23
        Buffers: shared hit=26
        ->  Bitmap Index Scan on zonas_suscritas_centro_idx  (cost=0.00..4.47 rows=26 width=0) (actual time=0.012..0.012 rows=26.00 loops=1)
              Index Cond: (centro && _st_expand('0101000020E6100000B83E2322D20E51C0A4F05E9F656E30C0'::geography, '2000'::double precision))
              Index Searches: 1
              Buffers: shared hit=3
Planning Time: 0.155 ms
Execution Time: 0.054 ms
```
