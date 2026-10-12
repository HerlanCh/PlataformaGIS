// Aplica las migraciones pendientes: `pnpm db:migrate`.
import {
  crearDb,
  crearRegistro,
  crearPool,
  cargarConfig,
  cargarInterruptores,
  migrarTodo,
} from '@gis/platform';
import { conjuntosDeMigraciones } from './migrations.js';
import { modulos } from './modules.generated.js';

const config = cargarConfig();
const logger = crearRegistro(config.nivelDeLog);
const pool = crearPool(config.urlBaseDeDatos);

try {
  const conjuntos = conjuntosDeMigraciones(cargarInterruptores(), modulos);
  await migrarTodo(crearDb(pool), conjuntos);
  logger.info({ conjuntos: conjuntos.map((c) => c.nombre) }, 'migraciones aplicadas');
} finally {
  await pool.end();
}
