// Cliente tipado de la API para las consultas públicas (sin token), generado desde el contrato.
import { crearClienteApi } from '@gis/api-client';
import { URL_API } from '../configuracion.js';

// `fetch` se resuelve en cada llamada (no al cargar el módulo): así lo pueden sustituir las pruebas.
export const api = crearClienteApi({ urlBase: URL_API, fetch: (...args) => fetch(...args) });
