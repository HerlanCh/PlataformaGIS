import { InMemoryEventBus } from '@gis/event-bus';
import { createLogger, createPool, loadConfig, loadFeatureFlags } from '@gis/platform';
import { buildApp } from './app.js';
import { modules } from './modules.generated.js';
import { attachRealtime } from './realtime.js';

const config = loadConfig();
const flags = loadFeatureFlags();
const logger = createLogger(config.logLevel);
const db = createPool(config.databaseUrl, (error) => {
  logger.error({ err: error }, 'error en una conexión inactiva de la base de datos');
});
const bus = new InMemoryEventBus((error, event) => {
  logger.error({ err: error, evento: event.type }, 'falló un manejador de eventos');
});

const app = await buildApp({ config, flags, logger, db, bus, modules });
const realtime = attachRealtime(app.server, { corsOrigin: config.corsOrigin });

const apagar = async (senal: string): Promise<void> => {
  logger.info({ senal }, 'apagando');
  await realtime.close();
  await app.close();
  await db.end();
};

process.once('SIGTERM', () => void apagar('SIGTERM'));
process.once('SIGINT', () => void apagar('SIGINT'));

await app.listen({ port: config.port, host: '0.0.0.0' });
