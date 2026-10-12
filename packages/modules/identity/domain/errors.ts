import { ErrorDeDominio } from '@gis/shared-kernel';

export class ErrorHashDeDispositivoInvalido extends ErrorDeDominio {
  constructor() {
    super('HASH_DE_DISPOSITIVO_INVALIDO', 'El identificador anónimo del dispositivo no es válido');
  }
}

export class ErrorIdTelegramInvalido extends ErrorDeDominio {
  constructor() {
    super('ID_DE_TELEGRAM_INVALIDO', 'El identificador de Telegram no es válido');
  }
}

export class ErrorTelegramYaVinculado extends ErrorDeDominio {
  constructor() {
    super('TELEGRAM_YA_VINCULADO', 'El usuario ya está vinculado a otra cuenta de Telegram');
  }
}
