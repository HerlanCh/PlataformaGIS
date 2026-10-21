-- Conteo exacto de filas por tabla, como un objeto JSON {"esquema.tabla": filas}.
-- Lo usa el flujo de respaldo (.github/workflows/respaldo.yml) en la base de origen y en la
-- restaurada: si difieren, la restauración falla. Solo lee, así que sirve con un rol de lectura.
-- Se omiten las tablas del catálogo y las que pertenecen a una extensión (spatial_ref_sys).
select coalesce(
  jsonb_object_agg(
    n.nspname || '.' || c.relname,
    (xpath(
      '/row/c/text()',
      query_to_xml(format('select count(*) as c from %I.%I', n.nspname, c.relname), false, true, '')
    ))[1]::text::bigint
  ),
  '{}'::jsonb
)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p')
  and n.nspname not in ('pg_catalog', 'information_schema')
  and n.nspname not like 'pg\_toast%'
  and not exists (
    select 1 from pg_depend d
    where d.classid = 'pg_class'::regclass and d.objid = c.oid and d.deptype = 'e'
  );
