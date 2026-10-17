// Genera el contrato de la API para el cliente tipado: `pnpm gen:api`.
// Escribe `packages/api-client/openapi.json`; luego `openapi-typescript` produce los tipos.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { documentoOpenApi } from './documento.js';

export const RUTA_DEL_DOCUMENTO = fileURLToPath(
  new URL('../../../../packages/api-client/openapi.json', import.meta.url),
);

const documento = await documentoOpenApi();
await writeFile(RUTA_DEL_DOCUMENTO, `${JSON.stringify(documento, null, 2)}\n`);
console.log(`OpenAPI escrito en ${RUTA_DEL_DOCUMENTO}`);
