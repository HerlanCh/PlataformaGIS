import type { Ejecutor } from '@gis/platform';
import { idUsuario } from '@gis/shared-kernel';
import type { IdUsuario } from '@gis/shared-kernel';
import { eq } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { RepositorioDeUsuarios } from '../domain/ports.js';
import { Usuario } from '../domain/user.js';
import type { Rol } from '../domain/user.js';
import { usuarios } from './schema.js';

type Fila = typeof usuarios.$inferSelect;

/** Mapeo explícito fila → entidad: el dominio nunca ve tipos de Drizzle. */
const aEntidad = (fila: Fila): Usuario =>
  Usuario.restaurar({
    id: idUsuario(fila.id),
    hashDispositivo: fila.hashDispositivo,
    rol: fila.rol as Rol,
    idTelegram: fila.idTelegram,
    creadoEn: fila.creadoEn,
  });

export class RepositorioUsuariosPg implements RepositorioDeUsuarios {
  constructor(private readonly db: Ejecutor) {}

  buscarPorId(id: IdUsuario): Promise<Usuario | null> {
    return this.buscar(eq(usuarios.id, id));
  }

  buscarPorHashDispositivo(hashDispositivo: string): Promise<Usuario | null> {
    return this.buscar(eq(usuarios.hashDispositivo, hashDispositivo));
  }

  buscarPorIdTelegram(idTelegram: string): Promise<Usuario | null> {
    return this.buscar(eq(usuarios.idTelegram, idTelegram));
  }

  async guardar(usuario: Usuario): Promise<void> {
    const fila = {
      id: usuario.id,
      hashDispositivo: usuario.hashDispositivo,
      rol: usuario.rol,
      idTelegram: usuario.idTelegram,
      creadoEn: usuario.creadoEn,
    };
    await this.db
      .insert(usuarios)
      .values(fila)
      .onConflictDoUpdate({
        target: usuarios.id,
        // El hash del dispositivo y la fecha de alta no cambian.
        set: { rol: fila.rol, idTelegram: fila.idTelegram },
      });
  }

  private async buscar(condicion: SQL): Promise<Usuario | null> {
    const [fila] = await this.db.select().from(usuarios).where(condicion).limit(1);
    return fila ? aEntidad(fila) : null;
  }
}
