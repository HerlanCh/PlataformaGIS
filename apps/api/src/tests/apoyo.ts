// Apoyo de las pruebas de la API: casos de uso falsos y tokens con una clave fija.
import type { Reloj } from '@gis/shared-kernel';
import type { DependenciasApi } from '../app.js';
import type { CasosDeUso } from '../composicion/casos-de-uso.js';
import type { ConfigJwt } from '../http/config-http.js';
import { ServicioDeTokens } from '../http/tokens.js';

export const SECRETO_DE_PRUEBA = 'secreto-de-prueba-de-al-menos-32-caracteres';
export const SECRETO_ANTERIOR_DE_PRUEBA = 'secreto-anterior-de-al-menos-32-caracteres';

export const configJwtDePrueba = (cambios: Partial<ConfigJwt> = {}): ConfigJwt => ({
  secreto: SECRETO_DE_PRUEBA,
  secretoAnterior: null,
  duracionS: 3600,
  ...cambios,
});

const noUsado = (nombre: string) => ({
  ejecutar: () => Promise.reject(new Error(`caso de uso ${nombre} no preparado en la prueba`)),
});

/** Casos de uso que fallan si se usan, salvo los que la prueba reemplaza. */
export const casosFalsos = (cambios: Partial<CasosDeUso> = {}): CasosDeUso =>
  ({
    registrarDispositivo: noUsado('registrarDispositivo'),
    crearReporte: noUsado('crearReporte'),
    agregarDescripcion: noUsado('agregarDescripcion'),
    listarReportes: noUsado('listarReportes'),
    confirmarReporte: noUsado('confirmarReporte'),
    negarReporte: noUsado('negarReporte'),
    obtenerMapaDeCalor: null,
    suscribirZona: null,
    eliminarZona: null,
    listarZonas: null,
    avisosPush: null,
    rechazarReporte: null,
    ...cambios,
  }) as CasosDeUso;

export const relojReal: Reloj = { ahora: () => new Date() };

export const apiDePrueba = (cambios: Partial<DependenciasApi> = {}): DependenciasApi => ({
  casos: casosFalsos(),
  tokens: new ServicioDeTokens(configJwtDePrueba(), relojReal),
  limitePorMinuto: 1000,
  ...cambios,
});
