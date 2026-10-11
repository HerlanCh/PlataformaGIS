import type { UserId } from '@gis/shared-kernel';
import {
  InvalidDeviceHashError,
  InvalidTelegramIdError,
  TelegramAlreadyLinkedError,
} from './errors.js';

export type Role = 'CIUDADANO' | 'MODERADOR';

export interface UserProps {
  readonly id: UserId;
  readonly deviceHash: string;
  readonly role: Role;
  readonly telegramId: string | null;
  readonly createdAt: Date;
}

export interface RegisterDeviceInput {
  readonly id: UserId;
  readonly deviceHash: string;
  readonly telegramId?: string;
  readonly now: Date;
}

// El hash lo genera el cliente; aquí solo se exige que sea opaco y de tamaño razonable.
const HASH_DE_DISPOSITIVO = /^[A-Za-z0-9_-]{16,128}$/;
const ID_DE_TELEGRAM = /^\d{1,20}$/;

function validarTelegram(telegramId: string): string {
  if (!ID_DE_TELEGRAM.test(telegramId)) throw new InvalidTelegramIdError();
  return telegramId;
}

/** Usuario anónimo: se identifica por su dispositivo y, opcionalmente, por Telegram. */
export class User {
  private constructor(private props: UserProps) {}

  /** Alta de un usuario nuevo. Todo usuario nace con rol `CIUDADANO`. */
  static registerDevice(input: RegisterDeviceInput): User {
    if (!HASH_DE_DISPOSITIVO.test(input.deviceHash)) throw new InvalidDeviceHashError();
    return new User({
      id: input.id,
      deviceHash: input.deviceHash,
      role: 'CIUDADANO',
      telegramId: input.telegramId === undefined ? null : validarTelegram(input.telegramId),
      createdAt: input.now,
    });
  }

  /** Reconstruye un usuario ya persistido. No valida ni aplica reglas de alta. */
  static restore(props: UserProps): User {
    return new User(props);
  }

  get id(): UserId {
    return this.props.id;
  }

  get deviceHash(): string {
    return this.props.deviceHash;
  }

  get role(): Role {
    return this.props.role;
  }

  get telegramId(): string | null {
    return this.props.telegramId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get isModerator(): boolean {
    return this.props.role === 'MODERADOR';
  }

  /** Vincula la cuenta de Telegram. Repetir el mismo ID no tiene efecto. */
  linkTelegram(telegramId: string): void {
    const valido = validarTelegram(telegramId);
    if (this.props.telegramId !== null && this.props.telegramId !== valido) {
      throw new TelegramAlreadyLinkedError();
    }
    this.props = { ...this.props, telegramId: valido };
  }

  promoteToModerator(): void {
    this.props = { ...this.props, role: 'MODERADOR' };
  }
}
