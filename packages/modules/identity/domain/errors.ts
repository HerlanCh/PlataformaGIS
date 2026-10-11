import { DomainError } from '@gis/shared-kernel';

export class InvalidDeviceHashError extends DomainError {
  constructor() {
    super('INVALID_DEVICE_HASH', 'El identificador anónimo del dispositivo no es válido');
  }
}

export class InvalidTelegramIdError extends DomainError {
  constructor() {
    super('INVALID_TELEGRAM_ID', 'El identificador de Telegram no es válido');
  }
}

export class TelegramAlreadyLinkedError extends DomainError {
  constructor() {
    super('TELEGRAM_ALREADY_LINKED', 'El usuario ya está vinculado a otra cuenta de Telegram');
  }
}
