import { BusDeEventosEnMemoria } from '@gis/event-bus';
import {
  cargarConfig,
  cargarInterruptores,
  crearDb,
  crearPool,
  crearRegistro,
} from '@gis/platform';
import { crearApagado } from './apagado.js';
import { construirApp } from './app.js';
import { componerCasosDeUso, relojDelSistema } from './composicion/casos-de-uso.js';
import { LimitadorDeFrecuenciaEnProceso } from './composicion/limitador.js';
import { cargarConfigHttp } from './http/config-http.js';
import { ServicioDeTokens } from './http/tokens.js';
import { modulos } from './modules.generated.js';
import { adjuntarTiempoReal } from './realtime.js';

const config = cargarConfig();
const configHttp = cargarConfigHttp();
const flags = cargarInterruptores();
const logger = crearRegistro(config.nivelDeLog);
const pool = crearPool(config.urlBaseDeDatos, (error) => {
  logger.error({ err: error }, 'error en una conexión inactiva de la base de datos');
});
const bus = new BusDeEventosEnMemoria((error, event) => {
  logger.error({ err: error, evento: event.tipo }, 'falló un manejador de eventos');
});

const casos = componerCasosDeUso({
  db: crearDb(pool),
  interruptores: flags,
  limitador: new LimitadorDeFrecuenciaEnProceso(relojDelSistema),
});

const app = await construirApp({
  config,
  interruptores: flags,
  registro: logger,
  db: pool,
  bus,
  modulos,
  api: {
    casos,
    tokens: new ServicioDeTokens(configHttp.jwt, relojDelSistema),
    limitePorMinuto: configHttp.limitePorMinuto,
  },
});
const realtime = adjuntarTiempoReal(app.server, { origenCors: config.origenCors });

const apagar = crearApagado({
  registro: logger,
  recursos: [
    { nombre: 'websocket', cerrar: () => realtime.close() },
    { nombre: 'http', cerrar: () => app.close() },
    { nombre: 'base de datos', cerrar: () => pool.end() },
  ],
});
process.once('SIGTERM', () => void apagar('SIGTERM'));
process.once('SIGINT', () => void apagar('SIGINT'));

await app.listen({ port: config.puerto, host: '0.0.0.0' });
