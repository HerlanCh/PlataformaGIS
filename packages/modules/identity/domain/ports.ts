import type { IdUsuario } from '@gis/shared-kernel';
import type { Usuario } from './user.js';

export interface RepositorioDeUsuarios {
  buscarPorId(id: IdUsuario): Promise<Usuario | null>;
  buscarPorHashDispositivo(hashDispositivo: string): Promise<Usuario | null>;
  buscarPorIdTelegram(idTelegram: string): Promise<Usuario | null>;
  guardar(usuario: Usuario): Promise<void>;
}
