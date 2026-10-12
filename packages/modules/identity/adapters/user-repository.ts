import type { Executor } from '@gis/platform';
import { userId } from '@gis/shared-kernel';
import type { UserId } from '@gis/shared-kernel';
import { eq } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { UserRepository } from '../domain/ports.js';
import { User } from '../domain/user.js';
import type { Role } from '../domain/user.js';
import { users } from './schema.js';

type Fila = typeof users.$inferSelect;

/** Mapeo explícito fila → entidad: el dominio nunca ve tipos de Drizzle. */
const aEntidad = (fila: Fila): User =>
  User.restore({
    id: userId(fila.id),
    deviceHash: fila.deviceHash,
    role: fila.role as Role,
    telegramId: fila.telegramId,
    createdAt: fila.createdAt,
  });

export class PgUserRepository implements UserRepository {
  constructor(private readonly db: Executor) {}

  findById(id: UserId): Promise<User | null> {
    return this.buscar(eq(users.id, id));
  }

  findByDeviceHash(deviceHash: string): Promise<User | null> {
    return this.buscar(eq(users.deviceHash, deviceHash));
  }

  findByTelegramId(telegramId: string): Promise<User | null> {
    return this.buscar(eq(users.telegramId, telegramId));
  }

  async save(user: User): Promise<void> {
    const fila = {
      id: user.id,
      deviceHash: user.deviceHash,
      role: user.role,
      telegramId: user.telegramId,
      createdAt: user.createdAt,
    };
    await this.db
      .insert(users)
      .values(fila)
      .onConflictDoUpdate({
        target: users.id,
        // El hash del dispositivo y la fecha de alta no cambian.
        set: { role: fila.role, telegramId: fila.telegramId },
      });
  }

  private async buscar(condicion: SQL): Promise<User | null> {
    const [fila] = await this.db.select().from(users).where(condicion).limit(1);
    return fila ? aEntidad(fila) : null;
  }
}
