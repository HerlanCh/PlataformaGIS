import type { UserId } from '@gis/shared-kernel';
import type { User } from './user.js';

export interface UserRepository {
  findById(id: UserId): Promise<User | null>;
  findByDeviceHash(deviceHash: string): Promise<User | null>;
  findByTelegramId(telegramId: string): Promise<User | null>;
  save(user: User): Promise<void>;
}
