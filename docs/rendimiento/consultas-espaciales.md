# Rendimiento de las consultas espaciales

Evidencia de eficiencia de la Fase 4 (ISO/IEC 25010). Archivo generado por `pnpm perf:espacial`; no editarlo a mano.

Criterio: cada consulta usa un índice (sin recorrer completa ninguna tabla) y su p95 es menor a 100 ms.

## Entorno

- **Fecha:** 2026-10-21T23:51:43.498Z
- **Reportes:** 100909 (20877 vigentes) · **Zonas suscritas:** 5696
- **PostgreSQL:** 18.6 (Debian 18.6-1.pgdg13+2) · **PostGIS:** 3.6.4 (contenedor Docker local)
- **Máquina:** AMD Ryzen 5 5600G with Radeon Graphics, 12 hilos, 16 GB de RAM, Windows_NT 10.0.22631 · **Node:** v24.20.0
- **Método:** 20 ejecuciones de calentamiento y 300 medidas por consulta, cada una con parámetros aleatorios distintos (semilla fija). El tiempo incluye el viaje al contenedor y el mapeo de filas a objetos del dominio.

## Resumen

| Consulta | Qué mide | p50 (ms) | p95 (ms) | Máximo (ms) | Resultado |
| :--- | :--- | ---: | ---: | ---: | :--- |
| `buscarEnVentana` | Reportes vigentes en una ventana de unos 2,2 km de lado | 9.7 | 14.0 | 322.9 | Cumple |
| `buscarEnVentana (peor caso)` | Toda el área de servicio; devuelve el tope de 2000 reportes | 8.5 | 9.5 | 11.2 | Cumple |
| `buscarCercanos` | Reportes vigentes a 500 m o menos de un punto | 8.9 | 12.5 | 15.0 | Cumple |
| `buscarCercanos (peor caso)` | A 2 km del centro, la zona más densa; devuelve el tope de 500 | 31.2 | 34.6 | 347.2 | Cumple |
| `buscarDuplicado` | Reporte vigente de la misma categoría dentro de su radio de deduplicación | 2.7 | 3.5 | 3.9 | Cumple |
| `buscarCaducados` | Lote de 500 reportes vigentes con la caducidad vencida | 6.1 | 7.3 | 318.3 | Cumple |
| `mapa de calor` | Celdas de 500 m en una ventana de unos 6,6 km de lado, últimos 30 días | 16.7 | 22.6 | 25.5 | Cumple |
| `mapa de calor (peor caso)` | Celdas de 500 m en toda el área de servicio, últimos 30 días | 37.4 | 42.4 | 354.4 | Cumple |
| `buscarSuscriptores` | Zonas suscritas cuyo círculo contiene un punto, por categoría | 1.7 | 2.7 | 3.4 | Cumple |

## `buscarEnVentana`

Reportes vigentes en una ventana de unos 2,2 km de lado.

```sql
select "id", "codigo_categoria", "estado", st_y("ubicacion_publica"), st_x("ubicacion_publica"), "creado_en", "caduca_en" from "reportes" where ("reportes"."ubicacion_publica" && st_makeenvelope($1, $2, $3, $4, 4326) and "reportes"."estado" in ($5, $6)) order by "reportes"."creado_en" desc, "reportes"."id" asc limit $7
```

```text
Limit  (cost=1559.54..1559.84 rows=121 width=64) (actual time=2.241..2.253 rows=128.00 loops=1)
  Buffers: shared hit=456
  ->  Sort  (cost=1559.54..1559.84 rows=121 width=64) (actual time=2.241..2.245 rows=128.00 loops=1)
        Sort Key: creado_en DESC, id
        Sort Method: quicksort  Memory: 42kB
        Buffers: shared hit=456
        ->  Bitmap Heap Scan on reportes  (cost=1129.49..1555.35 rows=121 width=64) (actual time=2.042..2.217 rows=128.00 loops=1)
              Recheck Cond: ((ubicacion_publica && '0103000020E610000001000000050000005CEFB85E560C51C0AF87E1754F8230C05CEFB85E560C51C0299C8FBD307D30C07A74A4B00E0B51C0299C8FBD307D30C07A74A4B00E0B51C0AF87E1754F8230C05CEFB85E560C51C0AF87E1754F8230C0'::geometry) AND (estado = ANY ('{ACTIVO,CONFIRMADO}'::text[])))
              Heap Blocks: exact=222
              Buffers: shared hit=456
              ->  BitmapAnd  (cost=1129.49..1129.49 rows=121 width=0) (actual time=2.020..2.021 rows=0.00 loops=1)
                    Buffers: shared hit=234
                    ->  Bitmap Index Scan on reportes_ubicacion_publica_idx  (cost=0.00..32.68 rows=587 width=0) (actual time=0.143..0.143 rows=960.00 loops=1)
                          Index Cond: (ubicacion_publica && '0103000020E610000001000000050000005CEFB85E560C51C0AF87E1754F8230C05CEFB85E560C51C0299C8FBD307D30C07A74A4B00E0B51C0299C8FBD307D30C07A74A4B00E0B51C0AF87E1754F8230C05CEFB85E560C51C0AF87E1754F8230C0'::geometry)
                          Index Searches: 1
                          Buffers: shared hit=15
                    ->  Bitmap Index Scan on reportes_vigentes_idx  (cost=0.00..1096.49 rows=20841 width=0) (actual time=1.806..1.806 rows=41752.00 loops=1)
                          Index Searches: 1
                          Buffers: shared hit=219
Planning Time: 0.104 ms
Execution Time: 2.268 ms
```

## `buscarEnVentana (peor caso)`

Toda el área de servicio; devuelve el tope de 2000 reportes.

```sql
select "id", "codigo_categoria", "estado", st_y("ubicacion_publica"), st_x("ubicacion_publica"), "creado_en", "caduca_en" from "reportes" where ("reportes"."ubicacion_publica" && st_makeenvelope($1, $2, $3, $4, 4326) and "reportes"."estado" in ($5, $6)) order by "reportes"."creado_en" desc, "reportes"."id" asc limit $7
```

```text
Limit  (cost=1.59..2415.84 rows=2000 width=64) (actual time=0.052..1.897 rows=2000.00 loops=1)
  Buffers: shared hit=1997
  ->  Incremental Sort  (cost=1.59..25159.29 rows=20841 width=64) (actual time=0.051..1.793 rows=2000.00 loops=1)
        Sort Key: creado_en DESC, id
        Presorted Key: creado_en
        Full-sort Groups: 63  Sort Method: quicksort  Average Memory: 29kB  Peak Memory: 29kB
        Buffers: shared hit=1997
        ->  Index Scan Backward using reportes_creado_en_idx on reportes  (cost=0.42..24221.48 rows=20841 width=64) (actual time=0.012..1.438 rows=2001.00 loops=1)
              Filter: ((ubicacion_publica && '0103000020E6100000010000000500000085EB51B81E1551C0EC51B81E85AB30C085EB51B81E1551C0E17A14AE476130C000000000000051C0E17A14AE476130C000000000000051C0EC51B81E85AB30C085EB51B81E1551C0EC51B81E85AB30C0'::geometry) AND (estado = ANY ('{ACTIVO,CONFIRMADO}'::text[])))
              Index Searches: 1
              Buffers: shared hit=1997
Planning Time: 0.115 ms
Execution Time: 1.961 ms
```

## `buscarCercanos`

Reportes vigentes a 500 m o menos de un punto.

```sql
select "id", "codigo_categoria", "id_autor", "estado", "ttl_minutos", "extensiones", "motivo_rechazo", "creado_en", "caduca_en", "ubicacion", "ubicacion_publica", "clave_idempotencia", "descripcion" from "reportes" where ("reportes"."estado" in ($1, $2) and st_dwithin("reportes"."ubicacion"::geography, st_setsrid(st_makepoint($3, $4), 4326)::geography, $5)) order by st_distance("reportes"."ubicacion"::geography, st_setsrid(st_makepoint($6, $7), 4326)::geography) limit $8
```

```text
Limit  (cost=6908.04..6908.05 rows=2 width=204) (actual time=3.715..3.736 rows=236.00 loops=1)
  Buffers: shared hit=899
  ->  Sort  (cost=6908.04..6908.05 rows=2 width=204) (actual time=3.714..3.723 rows=236.00 loops=1)
        Sort Key: (st_distance((ubicacion)::geography, '0101000020E6100000E5D0D07D9C0551C0AAF1F62FBD8930C0'::geography, true))
        Sort Method: quicksort  Memory: 85kB
        Buffers: shared hit=899
        ->  Bitmap Heap Scan on reportes  (cost=1234.29..6908.03 rows=2 width=204) (actual time=2.696..3.644 rows=236.00 loops=1)
              Recheck Cond: (estado = ANY ('{ACTIVO,CONFIRMADO}'::text[]))
              Filter: st_dwithin((ubicacion)::geography, '0101000020E6100000E5D0D07D9C0551C0AAF1F62FBD8930C0'::geography, '500'::double precision, true)
              Rows Removed by Filter: 97
              Heap Blocks: exact=624
              Buffers: shared hit=899
              ->  BitmapAnd  (cost=1234.29..1234.29 rows=362 width=0) (actual time=2.626..2.627 rows=0.00 loops=1)
                    Buffers: shared hit=275
                    ->  Bitmap Index Scan on reportes_ubicacion_geography_idx  (cost=0.00..137.54 rows=1752 width=0) (actual time=0.450..0.450 rows=3462.00 loops=1)
                          Index Cond: ((ubicacion)::geography && _st_expand('0101000020E6100000E5D0D07D9C0551C0AAF1F62FBD8930C0'::geography, '500'::double precision))
                          Index Searches: 1
                          Buffers: shared hit=56
                    ->  Bitmap Index Scan on reportes_vigentes_idx  (cost=0.00..1096.49 rows=20841 width=0) (actual time=2.082..2.082 rows=41752.00 loops=1)
                          Index Searches: 1
                          Buffers: shared hit=219
Planning Time: 1.088 ms
Execution Time: 3.778 ms
```

## `buscarCercanos (peor caso)`

A 2 km del centro, la zona más densa; devuelve el tope de 500.

```sql
select "id", "codigo_categoria", "id_autor", "estado", "ttl_minutos", "extensiones", "motivo_rechazo", "creado_en", "caduca_en", "ubicacion", "ubicacion_publica", "clave_idempotencia", "descripcion" from "reportes" where ("reportes"."estado" in ($1, $2) and st_dwithin("reportes"."ubicacion"::geography, st_setsrid(st_makepoint($3, $4), 4326)::geography, $5)) order by st_distance("reportes"."ubicacion"::geography, st_setsrid(st_makepoint($6, $7), 4326)::geography) limit $8
```

```text
Limit  (cost=35541.06..35541.07 rows=2 width=233) (actual time=21.169..24.683 rows=500.00 loops=1)
  Buffers: shared hit=4404
  ->  Sort  (cost=35541.06..35541.07 rows=2 width=233) (actual time=21.167..24.655 rows=500.00 loops=1)
        Sort Key: (st_distance((ubicacion)::geography, '0101000020E6100000B8AF03E78C0851C0022B8716D97E30C0'::geography, true))
        Sort Method: top-N heapsort  Memory: 242kB
        Buffers: shared hit=4404
        ->  Gather  (cost=3972.41..35541.05 rows=2 width=233) (actual time=4.187..23.521 rows=3827.00 loops=1)
              Workers Planned: 2
              Workers Launched: 2
              Buffers: shared hit=4404
              ->  Parallel Bitmap Heap Scan on reportes  (cost=2972.41..34540.85 rows=1 width=233) (actual time=6.589..9.947 rows=1275.67 loops=3)
                    Recheck Cond: (estado = ANY ('{ACTIVO,CONFIRMADO}'::text[]))
                    Filter: st_dwithin((ubicacion)::geography, '0101000020E6100000B8AF03E78C0851C0022B8716D97E30C0'::geography, '2000'::double precision, true)
                    Rows Removed by Filter: 407
                    Heap Blocks: exact=2228
                    Buffers: shared hit=4404
                    Worker 0:  Heap Blocks: exact=2
                    Worker 1:  Heap Blocks: exact=2
                    ->  BitmapAnd  (cost=2972.41..2972.41 rows=5082 width=0) (actual time=3.684..3.685 rows=0.00 loops=1)
                          Buffers: shared hit=832
                          ->  Bitmap Index Scan on reportes_vigentes_idx  (cost=0.00..1098.21 rows=21184 width=0) (actual time=1.303..1.303 rows=20877.00 loops=1)
                                Index Searches: 1
                                Buffers: shared hit=214
                          ->  Bitmap Index Scan on reportes_ubicacion_geography_idx  (cost=0.00..1873.95 rows=24206 width=0) (actual time=2.308..2.308 rows=24604.00 loops=1)
                                Index Cond: ((ubicacion)::geography && _st_expand('0101000020E6100000B8AF03E78C0851C0022B8716D97E30C0'::geography, '2000'::double precision))
                                Index Searches: 1
                                Buffers: shared hit=618
Planning Time: 1.618 ms
Execution Time: 24.786 ms
```

## `buscarDuplicado`

Reporte vigente de la misma categoría dentro de su radio de deduplicación.

```sql
select "id", "codigo_categoria", "id_autor", "estado", "ttl_minutos", "extensiones", "motivo_rechazo", "creado_en", "caduca_en", "ubicacion", "ubicacion_publica", "clave_idempotencia", "descripcion" from "reportes" where ("reportes"."codigo_categoria" = $1 and "reportes"."estado" in ($2, $3) and "reportes"."caduca_en" > $4 and st_dwithin("reportes"."ubicacion"::geography, st_setsrid(st_makepoint($5, $6), 4326)::geography, $7)) order by st_distance("reportes"."ubicacion"::geography, st_setsrid(st_makepoint($8, $9), 4326)::geography) limit $10
```

```text
Limit  (cost=408.05..408.05 rows=1 width=233) (actual time=1.174..1.175 rows=1.00 loops=1)
  Buffers: shared hit=355
  ->  Sort  (cost=408.05..408.05 rows=1 width=233) (actual time=1.174..1.175 rows=1.00 loops=1)
        Sort Key: (st_distance((ubicacion)::geography, '0101000020E61000004200E5ADE30951C03D8A799AB37F30C0'::geography, true))
        Sort Method: top-N heapsort  Memory: 25kB
        Buffers: shared hit=355
        ->  Bitmap Heap Scan on reportes  (cost=248.02..408.04 rows=1 width=233) (actual time=1.112..1.170 rows=6.00 loops=1)
              Recheck Cond: ((caduca_en > '2026-10-21 23:50:59.409+00'::timestamp with time zone) AND (estado = ANY ('{ACTIVO,CONFIRMADO}'::text[])))
              Filter: ((codigo_categoria = 'jauria'::text) AND st_dwithin((ubicacion)::geography, '0101000020E61000004200E5ADE30951C03D8A799AB37F30C0'::geography, '150'::double precision, true))
              Rows Removed by Filter: 57
              Heap Blocks: exact=63
              Buffers: shared hit=355
              ->  BitmapAnd  (cost=248.02..248.02 rows=9 width=0) (actual time=1.095..1.095 rows=0.00 loops=1)
                    Buffers: shared hit=292
                    ->  Bitmap Index Scan on reportes_ubicacion_geography_idx  (cost=0.00..18.05 rows=219 width=0) (actual time=0.233..0.233 rows=375.00 loops=1)
                          Index Cond: ((ubicacion)::geography && _st_expand('0101000020E61000004200E5ADE30951C03D8A799AB37F30C0'::geography, '150'::double precision))
                          Index Searches: 1
                          Buffers: shared hit=88
                    ->  Bitmap Index Scan on reportes_vigentes_idx  (cost=0.00..229.72 rows=4263 width=0) (actual time=0.851..0.851 rows=19895.00 loops=1)
                          Index Cond: (caduca_en > '2026-10-21 23:50:59.409+00'::timestamp with time zone)
                          Index Searches: 2
                          Buffers: shared hit=204
Planning Time: 1.131 ms
Execution Time: 1.192 ms
```

## `buscarCaducados`

Lote de 500 reportes vigentes con la caducidad vencida.

```sql
select "id", "codigo_categoria", "id_autor", "estado", "ttl_minutos", "extensiones", "motivo_rechazo", "creado_en", "caduca_en", "ubicacion", "ubicacion_publica", "clave_idempotencia", "descripcion" from "reportes" where ("reportes"."estado" in ($1, $2) and "reportes"."caduca_en" < $3) order by "reportes"."caduca_en" asc, "reportes"."id" asc limit $4
```

```text
Limit  (cost=6672.76..6674.01 rows=500 width=225) (actual time=0.914..0.967 rows=500.00 loops=1)
  Buffers: shared hit=833
  ->  Sort  (cost=6672.76..6715.06 rows=16920 width=225) (actual time=0.913..0.938 rows=500.00 loops=1)
        Sort Key: caduca_en, id
        Sort Method: quicksort  Memory: 278kB
        Buffers: shared hit=833
        ->  Bitmap Heap Scan on reportes  (cost=712.86..5829.66 rows=16920 width=225) (actual time=0.154..0.780 rows=982.00 loops=1)
              Recheck Cond: ((caduca_en < '2026-10-21 23:50:59.409+00'::timestamp with time zone) AND (estado = ANY ('{ACTIVO,CONFIRMADO}'::text[])))
              Heap Blocks: exact=812
              Buffers: shared hit=833
              ->  Bitmap Index Scan on reportes_vigentes_idx  (cost=0.00..708.62 rows=16920 width=0) (actual time=0.086..0.086 rows=982.00 loops=1)
                    Index Cond: (caduca_en < '2026-10-21 23:50:59.409+00'::timestamp with time zone)
                    Index Searches: 3
                    Buffers: shared hit=21
Planning Time: 0.094 ms
Execution Time: 0.993 ms
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
Sort  (cost=2339.15..2339.15 rows=1 width=52) (actual time=1.610..1.612 rows=44.00 loops=1)
  Sort Key: ((count(*))::integer) DESC, (st_y((st_snaptogrid(reportes.ubicacion_publica, '0'::double precision, '0'::double precision, '0.0046903360224517295'::double precision, '0.004496605063177301'::double precision)))), (st_x((st_snaptogrid(reportes.ubicacion_publica, '0'::double precision, '0'::double precision, '0.0046903360224517295'::double precision, '0.004496605063177301'::double precision))))
  Sort Method: quicksort  Memory: 28kB
  Buffers: shared hit=511
  ->  GroupAggregate  (cost=2338.73..2339.14 rows=1 width=52) (actual time=1.543..1.601 rows=44.00 loops=1)
        Group Key: (st_snaptogrid(reportes.ubicacion_publica, '0'::double precision, '0'::double precision, '0.0046903360224517295'::double precision, '0.004496605063177301'::double precision))
        Filter: (count(*) >= '3'::bigint)
        Rows Removed by Filter: 62
        Buffers: shared hit=511
        ->  Sort  (cost=2338.73..2338.74 rows=1 width=64) (actual time=1.538..1.547 rows=270.00 loops=1)
              Sort Key: (st_snaptogrid(reportes.ubicacion_publica, '0'::double precision, '0'::double precision, '0.0046903360224517295'::double precision, '0.004496605063177301'::double precision))
              Sort Method: quicksort  Memory: 46kB
              Buffers: shared hit=511
              ->  Bitmap Heap Scan on reportes  (cost=1296.40..2338.72 rows=1 width=64) (actual time=1.209..1.476 rows=270.00 loops=1)
                    Recheck Cond: ((ubicacion_publica && '0103000020E610000001000000050000009CC7D8937E1551C0A00BB20BF8AC30C09CC7D8937E1551C0E9647E64DA9C30C097651DBA4A1151C0E9647E64DA9C30C097651DBA4A1151C0A00BB20BF8AC30C09CC7D8937E1551C0A00BB20BF8AC30C0'::geometry) AND (creado_en >= '2026-09-21 23:50:59.409+00'::timestamp with time zone) AND (creado_en <= '2026-10-21 23:50:59.409+00'::timestamp with time zone))
                    Filter: ((estado <> 'RECHAZADO'::text) AND (st_y(st_snaptogrid(ubicacion_publica, '0'::double precision, '0'::double precision, '0.0046903360224517295'::double precision, '0.004496605063177301'::double precision)) >= '-16.674535725527228'::double precision) AND (st_y(st_snaptogrid(ubicacion_publica, '0'::double precision, '0'::double precision, '0.0046903360224517295'::double precision, '0.004496605063177301'::double precision)) <= '-16.613831557174333'::double precision) AND (st_x(st_snaptogrid(ubicacion_publica, '0'::double precision, '0'::double precision, '0.0046903360224517295'::double precision, '0.004496605063177301'::double precision)) >= '-68.33467809510486'::double precision) AND (st_x(st_snaptogrid(ubicacion_publica, '0'::double precision, '0'::double precision, '0.0046903360224517295'::double precision, '0.004496605063177301'::double precision)) <= '-68.27135855880177'::double precision))
                    Rows Removed by Filter: 5
                    Heap Blocks: exact=262
                    Buffers: shared hit=511
                    ->  BitmapAnd  (cost=1296.40..1296.40 rows=278 width=0) (actual time=1.182..1.182 rows=0.00 loops=1)
                          Buffers: shared hit=249
                          ->  Bitmap Index Scan on reportes_ubicacion_publica_idx  (cost=0.00..42.37 rows=812 width=0) (actual time=0.068..0.068 rows=824.00 loops=1)
                                Index Cond: (ubicacion_publica && '0103000020E610000001000000050000009CC7D8937E1551C0A00BB20BF8AC30C09CC7D8937E1551C0E9647E64DA9C30C097651DBA4A1151C0E9647E64DA9C30C097651DBA4A1151C0A00BB20BF8AC30C09CC7D8937E1551C0A00BB20BF8AC30C0'::geometry)
                                Index Searches: 1
                                Buffers: shared hit=11
                          ->  Bitmap Index Scan on reportes_creado_en_idx  (cost=0.00..1253.78 rows=34536 width=0) (actual time=1.090..1.090 rows=34203.00 loops=1)
                                Index Cond: ((creado_en >= '2026-09-21 23:50:59.409+00'::timestamp with time zone) AND (creado_en <= '2026-10-21 23:50:59.409+00'::timestamp with time zone))
                                Index Searches: 1
                                Buffers: shared hit=238
Planning:
  Buffers: shared hit=4
Planning Time: 0.140 ms
Execution Time: 1.630 ms
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
Sort  (cost=14888.03..14888.03 rows=1 width=52) (actual time=38.737..39.037 rows=1988.00 loops=1)
  Sort Key: ((count(*))::integer) DESC, (st_y((st_snaptogrid(reportes.ubicacion_publica, '0'::double precision, '0'::double precision, '0.0046903360224517295'::double precision, '0.004496605063177301'::double precision)))), (st_x((st_snaptogrid(reportes.ubicacion_publica, '0'::double precision, '0'::double precision, '0.0046903360224517295'::double precision, '0.004496605063177301'::double precision))))
  Sort Method: quicksort  Memory: 188kB
  Buffers: shared hit=3595
  ->  GroupAggregate  (cost=14887.61..14888.02 rows=1 width=52) (actual time=31.812..38.469 rows=1988.00 loops=1)
        Group Key: (st_snaptogrid(reportes.ubicacion_publica, '0'::double precision, '0'::double precision, '0.0046903360224517295'::double precision, '0.004496605063177301'::double precision))
        Filter: (count(*) >= '3'::bigint)
        Rows Removed by Filter: 1744
        Buffers: shared hit=3595
        ->  Sort  (cost=14887.61..14887.62 rows=1 width=64) (actual time=31.801..34.088 rows=33382.00 loops=1)
              Sort Key: (st_snaptogrid(reportes.ubicacion_publica, '0'::double precision, '0'::double precision, '0.0046903360224517295'::double precision, '0.004496605063177301'::double precision))
              Sort Method: quicksort  Memory: 3554kB
              Buffers: shared hit=3595
              ->  Gather  (cost=2253.78..14887.60 rows=1 width=64) (actual time=2.231..19.259 rows=33382.00 loops=1)
                    Workers Planned: 2
                    Workers Launched: 2
                    Buffers: shared hit=3595
                    ->  Parallel Bitmap Heap Scan on reportes  (cost=1253.78..13887.50 rows=1 width=64) (actual time=0.754..12.962 rows=11127.33 loops=3)
                          Recheck Cond: ((creado_en >= '2026-09-21 23:50:59.409+00'::timestamp with time zone) AND (creado_en <= '2026-10-21 23:50:59.409+00'::timestamp with time zone))
                          Filter: ((ubicacion_publica && '0103000020E61000000100000005000000E5D226BB311551C0255B2E5BD1AB30C0E5D226BB311551C0F58BBE89FE6030C016F4CBA1E1FF50C0F58BBE89FE6030C016F4CBA1E1FF50C0255B2E5BD1AB30C0E5D226BB311551C0255B2E5BD1AB30C0'::geometry) AND (estado <> 'RECHAZADO'::text) AND (st_y(st_snaptogrid(ubicacion_publica, '0'::double precision, '0'::double precision, '0.0046903360224517295'::double precision, '0.004496605063177301'::double precision)) >= '-16.67003912046405'::double precision) AND (st_y(st_snaptogrid(ubicacion_publica, '0'::double precision, '0'::double precision, '0.0046903360224517295'::double precision, '0.004496605063177301'::double precision)) <= '-16.380008093889113'::double precision) AND (st_x(st_snaptogrid(ubicacion_publica, '0'::double precision, '0'::double precision, '0.0046903360224517295'::double precision, '0.004496605063177301'::double precision)) >= '-68.32998775908241'::double precision) AND (st_x(st_snaptogrid(ubicacion_publica, '0'::double precision, '0'::double precision, '0.0046903360224517295'::double precision, '0.004496605063177301'::double precision)) <= '-67.99931906949956'::double precision))
                          Rows Removed by Filter: 274
                          Heap Blocks: exact=1782
                          Buffers: shared hit=3595
                          Worker 0:  Heap Blocks: exact=756
                          Worker 1:  Heap Blocks: exact=779
                          ->  Bitmap Index Scan on reportes_creado_en_idx  (cost=0.00..1253.78 rows=34536 width=0) (actual time=1.736..1.737 rows=34203.00 loops=1)
                                Index Cond: ((creado_en >= '2026-09-21 23:50:59.409+00'::timestamp with time zone) AND (creado_en <= '2026-10-21 23:50:59.409+00'::timestamp with time zone))
                                Index Searches: 1
                                Buffers: shared hit=238
Planning:
  Buffers: shared hit=4
Planning Time: 0.224 ms
Execution Time: 39.456 ms
```

## `buscarSuscriptores`

Zonas suscritas cuyo círculo contiene un punto, por categoría.

```sql
select "id", "id_usuario", st_y("centro"::geometry), st_x("centro"::geometry), "radio_m", "categorias", "creado_en" from "zonas_suscritas" where st_dwithin("zonas_suscritas"."centro", st_setsrid(st_makepoint($1, $2), 4326)::geography, $3)
and st_dwithin("zonas_suscritas"."centro", st_setsrid(st_makepoint($4, $5), 4326)::geography, "zonas_suscritas"."radio_m")
and $6 = any("zonas_suscritas"."categorias") order by "zonas_suscritas"."creado_en" asc, "zonas_suscritas"."id" asc
```

```text
Sort  (cost=701.51..701.52 rows=1 width=108) (actual time=0.045..0.045 rows=1.00 loops=1)
  Sort Key: creado_en, id
  Sort Method: quicksort  Memory: 25kB
  Buffers: shared hit=25
  ->  Bitmap Heap Scan on zonas_suscritas  (cost=4.46..701.50 rows=1 width=108) (actual time=0.038..0.043 rows=1.00 loops=1)
        Filter: (('jauria'::text = ANY (categorias)) AND st_dwithin(centro, '0101000020E6100000B83E2322D20E51C0A4F05E9F656E30C0'::geography, '2000'::double precision, true) AND st_dwithin(centro, '0101000020E6100000B83E2322D20E51C0A4F05E9F656E30C0'::geography, (radio_m)::double precision, true))
        Rows Removed by Filter: 25
        Heap Blocks: exact=22
        Buffers: shared hit=25
        ->  Bitmap Index Scan on zonas_suscritas_centro_idx  (cost=0.00..4.46 rows=25 width=0) (actual time=0.012..0.013 rows=26.00 loops=1)
              Index Cond: (centro && _st_expand('0101000020E6100000B83E2322D20E51C0A4F05E9F656E30C0'::geography, '2000'::double precision))
              Index Searches: 1
              Buffers: shared hit=3
Planning Time: 0.171 ms
Execution Time: 0.057 ms
```
