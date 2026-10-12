import { BusDeEventosEnMemoria } from '@gis/event-bus';
import { crearRegistro, crearPool, cargarConfig, cargarInterruptores } from '@gis/platform';
import { construirApp } from './app.js';
import { modulos } from './modules.generated.js';
import { adjuntarTiempoReal } from './realtime.js';

const config = cargarConfig();
const flags = cargarInterruptores();
const logger = crearRegistro(config.nivelDeLog);
const db = crearPool(config.urlBaseDeDatos, (error) => {
  logger.error({ err: error }, 'error en una conexión inactiva de la base de datos');
});
const bus = new BusDeEventosEnMemoria((error, event) => {
  logger.error({ err: error, evento: event.tipo }, 'falló un manejador de eventos');
});

const app = await construirApp({
  config,
  interruptores: flags,
  registro: logger,
  db,
  bus,
  modulos: modulos,
});
const realtime = adjuntarTiempoReal(app.server, { origenCors: config.origenCors });

const apagar = async (senal: string): Promise<void> => {
  logger.info({ senal }, 'apagando');
  await realtime.close();
  await app.close();
  await db.end();
};

process.once('SIGTERM', () => void apagar('SIGTERM'));
process.once('SIGINT', () => void apagar('SIGINT'));

await app.listen({ port: config.puerto, host: '0.0.0.0' });
