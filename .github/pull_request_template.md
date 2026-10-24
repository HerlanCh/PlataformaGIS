## Qué cambia

<!-- Una o dos líneas. Enlaza la incidencia: «Cierra #123». -->

## Tipo de mantenimiento (ISO/IEC 14764)

- [ ] Correctivo
- [ ] Adaptativo
- [ ] Perfectivo
- [ ] Preventivo
- [ ] Ninguno (fase del roadmap)

## Comprobaciones

- [ ] Si corrige un fallo: la prueba que lo reproduce se escribió **antes** del arreglo y falló sin él.
- [ ] Las pruebas nuevas llevan el ID de la historia (`HU-xx: …`).
- [ ] Si cambia una ruta o un esquema de `packages/contracts/src/http.ts`: `pnpm gen:api`.
- [ ] Si agrega una migración: tiene su `.down.sql` y solo agrega (`verificar-compatibles`).
- [ ] Ninguna respuesta pública expone `location` ni `author_id`.
- [ ] Documentación al día (`docs/trazabilidad.md`, diccionario de datos, README del módulo).
