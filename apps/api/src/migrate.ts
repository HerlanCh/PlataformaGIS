// Aplica las migraciones pendientes: `pnpm db:migrate`.
import {
  createDb,
  createLogger,
  createPool,
  loadConfig,
  loadFeatureFlags,
  migrateAll,
} from '@gis/platform';
import { migrationSets } from './migrations.js';
import { modules } from './modules.generated.js';

const config = loadConfig();
const logger = createLogger(config.logLevel);
const pool = createPool(config.databaseUrl);

try {
  const conjuntos = migrationSets(loadFeatureFlags(), modules);
  await migrateAll(createDb(pool), conjuntos);
  logger.info({ conjuntos: conjuntos.map((c) => c.name) }, 'migraciones aplicadas');
} finally {
  await pool.end();
}
