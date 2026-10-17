import { BusDeEventosEnMemoria } from '@gis/event-bus';
import { cargarConfig, cargarInterruptores, crearRegistro } from '@gis/platform';
import type { OpenAPIV3_1 } from 'openapi-types';
import { construirApp } from '../app.js';
import type { CasosDeUso } from '../composicion/casos-de-uso.js';
import { ServicioDeTokens } from '../http/tokens.js';

const sinUso = {
  ejecutar: () => Promise.reject(new Error('solo se genera el documento')),
};

/** Todos los módulos activos, para que el documento describa la API completa. */
const TODOS_LOS_CASOS = Object.fromEntries(
  [
    'registrarDispositivo',
    'crearReporte',
    'listarReportes',
    'confirmarReporte',
    'negarReporte',
    'obtenerMapaDeCalor',
    'suscribirZona',
    'eliminarZona',
    'rechazarReporte',
  ].map((nombre) => [nombre, sinUso]),
) as unknown as CasosDeUso;

/**
 * Documento OpenAPI de la API `/v1`, generado desde los esquemas de `packages/contracts`.
 * No toca la base de datos: las rutas se registran con casos de uso que nunca se ejecutan.
 */
export async function documentoOpenApi(): Promise<OpenAPIV3_1.Document> {
  const app = await construirApp({
    config: cargarConfig({
      DATABASE_URL: 'postgres://documento@localhost:5432/documento',
      CORS_ORIGIN: 'http://localhost:5173',
    }),
    interruptores: cargarInterruptores({}),
    registro: crearRegistro('silent'),
    db: { query: () => Promise.resolve([]) },
    bus: new BusDeEventosEnMemoria(),
    modulos: [],
    api: {
      casos: TODOS_LOS_CASOS,
      tokens: new ServicioDeTokens(
        { secreto: 'x'.repeat(32), secretoAnterior: null, duracionS: 60 },
        { ahora: () => new Date(0) },
      ),
      limitePorMinuto: 1,
    },
  });
  try {
    await app.ready();
    return app.swagger() as OpenAPIV3_1.Document;
  } finally {
    await app.close();
  }
}
