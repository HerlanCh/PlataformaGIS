import createClient from 'openapi-fetch';
import type { Client, Middleware } from 'openapi-fetch';
import type { components, paths } from './esquema.generated.js';

export type { components, paths } from './esquema.generated.js';

/** Cliente tipado de la API `/v1`, generado desde su contrato OpenAPI (`pnpm gen:api`). */
export type ClienteApi = Client<paths>;

export type ReportePublico = components['schemas']['ReportePublico'];
export type Credencial = components['schemas']['Credencial'];
export type Problema = components['schemas']['Problema'];
export type Zona = components['schemas']['Zona'];
export type CasoDeModeracion = components['schemas']['CasoDeModeracion'];
export type ResumenDatosAbiertos = components['schemas']['ResumenDatosAbiertos'];
export type CeldaDeCalor = components['schemas']['MapaDeCalor']['celdas'][number];

export interface OpcionesClienteApi {
  /** Origen de la API, sin `/v1`: `https://plataforma-gis-api.onrender.com`. */
  readonly urlBase: string;
  /** Token vigente del dispositivo, o `null` si aún no se registró. */
  readonly obtenerToken?: () => string | null | Promise<string | null>;
  readonly fetch?: typeof globalThis.fetch;
}

/** Crea el cliente y agrega `Authorization: Bearer` cuando hay token. */
export function crearClienteApi(opciones: OpcionesClienteApi): ClienteApi {
  const cliente = createClient<paths>({
    baseUrl: opciones.urlBase,
    ...(opciones.fetch ? { fetch: opciones.fetch } : {}),
  });
  const { obtenerToken } = opciones;
  if (obtenerToken) {
    const autenticar: Middleware = {
      async onRequest({ request }) {
        const token = await obtenerToken();
        if (token) request.headers.set('authorization', `Bearer ${token}`);
        return request;
      },
    };
    cliente.use(autenticar);
  }
  return cliente;
}
