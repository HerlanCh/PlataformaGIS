import type { IdUsuario } from '@gis/shared-kernel';
import type { RepositorioDeUsuarios } from '../domain/ports.js';
import type { Usuario } from '../domain/user.js';

/** Mismo contrato que `RepositorioUsuariosPg`, en memoria. */
export class UsuariosEnMemoria implements RepositorioDeUsuarios {
  readonly filas = new Map<IdUsuario, Usuario>();

  buscarPorId(id: IdUsuario): Promise<Usuario | null> {
    return Promise.resolve(this.filas.get(id) ?? null);
  }

  buscarPorHashDispositivo(hash: string): Promise<Usuario | null> {
    return Promise.resolve(
      [...this.filas.values()].find((u) => u.hashDispositivo === hash) ?? null,
    );
  }

  buscarPorIdTelegram(idTelegram: string): Promise<Usuario | null> {
    return Promise.resolve(
      [...this.filas.values()].find((u) => u.idTelegram === idTelegram) ?? null,
    );
  }

  guardar(usuario: Usuario): Promise<void> {
    this.filas.set(usuario.id, usuario);
    return Promise.resolve();
  }
}
