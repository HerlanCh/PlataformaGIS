# Respaldo y restauración de la base de datos

Cumple RNF-07 (ISO/IEC 25010, fiabilidad, recuperabilidad): al menos una restauración probada por versión.

## Qué hace el flujo `Respaldo`

`.github/workflows/respaldo.yml` corre:
- todos los días a las 04:00 de Bolivia;
- después de cada versión publicada;
- a pedido, con `gh workflow run Respaldo`.

| Paso | Qué hace |
| :-- | :-- |
| 1. Volcado | `pg_dump` (PostgreSQL 18) de staging en formato personalizado, sin dueños ni permisos. Antes y después cuenta las filas de cada tabla con `tools/respaldo/conteos.sql`; si los conteos cambian durante el volcado, falla y se reintenta en la próxima ejecución. |
| 2. Cifrado | `gpg` simétrico con AES-256 y la frase `BACKUP_PASSPHRASE`. El volcado sin cifrar no sale del runner. |
| 3. Artefacto | `respaldo-staging-<id>` con `respaldo.dump.gpg`, su SHA-256 y `conteos.json`. Se guarda 30 días. |
| 4. Restauración de prueba | En otro runner: verifica el SHA-256, descifra y restaura con `pg_restore --exit-on-error` en una base vacía de `postgis/postgis:18-3.6`. |
| 5. Compuerta | Los conteos de la base restaurada deben ser idénticos a `conteos.json`. |

El repositorio es público y cualquier persona con cuenta de GitHub puede descargar los artefactos. Por eso el
respaldo solo se publica cifrado; `conteos.json` lleva únicamente cifras por tabla.

## Secretos

| Secreto | Contenido |
| :-- | :-- |
| `STAGING_DATABASE_URL` | Cadena de conexión **directa** de Neon: el host sin `-pooler`, porque `pg_dump` no funciona bien a través del pooler. |
| `BACKUP_PASSPHRASE` | Frase aleatoria de 32 bytes en Base64. **Hay una copia fuera de GitHub, en el gestor de contraseñas del responsable:** sin ella ningún respaldo se puede descifrar. |

Para rotar la frase: generar una nueva y actualizar el secreto con `gh secret set BACKUP_PASSPHRASE`. Los respaldos
anteriores siguen necesitando la frase vieja hasta que venzan (30 días).

## Restaurar a mano

Necesitas PostgreSQL 18 (`pg_restore`), `gpg` y la frase.

1. Descarga el artefacto desde la ejecución del flujo en GitHub Actions, o:

   ```
   gh run download <id-de-ejecucion> --name respaldo-staging-<id-de-ejecucion>
   ```

2. Verifica el archivo y descífralo. Te pedirá la frase:

   ```
   sha256sum --check respaldo.dump.gpg.sha256
   gpg --decrypt --output respaldo.dump respaldo.dump.gpg
   ```

3. Restaura en una base **vacía**. La base nueva se crea desde `template0` para que no traiga extensiones:

   ```
   psql "<url-del-servidor>" -c "create database restaurada template template0"
   pg_restore --dbname="<url>/restaurada" --no-owner --no-acl --exit-on-error respaldo.dump
   ```

4. Compara los conteos con los del respaldo:

   ```
   psql "<url>/restaurada" -At -f tools/respaldo/conteos.sql > restaurada.json
   diff <(jq -S . conteos.json) <(jq -S . restaurada.json)
   ```

5. Para volver a poner en servicio la base restaurada, apunta `DATABASE_URL` de Render a ella. La API aplica las
   migraciones pendientes al arrancar.

Borra `respaldo.dump` cuando termines: contiene los datos sin cifrar.
