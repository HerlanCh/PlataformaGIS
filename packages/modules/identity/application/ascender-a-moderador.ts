import { validarEntrada } from '@gis/contracts';
import { ErrorNoEncontrado, idUsuario } from '@gis/shared-kernel';
import { z } from 'zod';
import type { RepositorioDeUsuarios } from '../domain/ports.js';

const esquemaEntrada = z.object({ idUsuario: z.uuid() });

export type EntradaAscenderAModerador = z.input<typeof esquemaEntrada>;

export type ResultadoAscenso = 'ASCENDIDO' | 'YA_ERA_MODERADOR';

/**
 * HU-12: da el rol `MODERADOR` a un usuario. No tiene ruta HTTP: lo ejecuta un administrador con
 * `pnpm moderador:ascender <idUsuario>`. El rol nuevo llega al dispositivo con su próximo token.
 */
export class AscenderAModerador {
  constructor(private readonly usuarios: RepositorioDeUsuarios) {}

  async ejecutar(entrada: EntradaAscenderAModerador): Promise<ResultadoAscenso> {
    const datos = validarEntrada(esquemaEntrada, entrada);
    const usuario = await this.usuarios.buscarPorId(idUsuario(datos.idUsuario));
    if (!usuario) throw new ErrorNoEncontrado('USUARIO_NO_ENCONTRADO', 'El usuario no existe');
    if (usuario.esModerador) return 'YA_ERA_MODERADOR';
    usuario.ascenderAModerador();
    await this.usuarios.guardar(usuario);
    return 'ASCENDIDO';
  }
}
