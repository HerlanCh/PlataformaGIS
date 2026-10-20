// Da el rol MODERADOR a un usuario (HU-12): `pnpm moderador:ascender <idUsuario>`.
// Corre contra DATABASE_URL. El usuario ve su id en la pantalla /moderacion de la PWA, y el rol le
// llega al volver a abrirla, que renueva su token.
import { AscenderAModerador, RepositorioUsuariosPg } from '@gis/module-identity';
import { crearDb, crearPool } from '@gis/platform';
import { ErrorDeAplicacion } from '@gis/shared-kernel';

const MENSAJES = {
  ASCENDIDO: 'El usuario ya es moderador. Verá la cola al volver a abrir /moderacion.',
  YA_ERA_MODERADOR: 'El usuario ya era moderador: no se cambió nada.',
} as const;

const [idUsuario] = process.argv.slice(2);
const url = process.env.DATABASE_URL;
if (!idUsuario || !url) {
  console.error('Uso: DATABASE_URL=… pnpm moderador:ascender <idUsuario>');
  process.exit(2);
}

const pool = crearPool(url);
try {
  const resultado = await new AscenderAModerador(new RepositorioUsuariosPg(crearDb(pool))).ejecutar(
    { idUsuario },
  );
  console.log(MENSAJES[resultado]);
} catch (error) {
  console.error(error instanceof ErrorDeAplicacion ? `${error.codigo}: ${error.message}` : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
