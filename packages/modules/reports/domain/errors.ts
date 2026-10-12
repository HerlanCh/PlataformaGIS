import { ErrorDeDominio } from '@gis/shared-kernel';

export class ErrorTransicionInvalida extends ErrorDeDominio {
  constructor(desde: string, hacia: string) {
    super('TRANSICION_INVALIDA', `Un reporte ${desde} no puede pasar a ${hacia}`);
  }
}

export class ErrorLimiteDeExtensiones extends ErrorDeDominio {
  constructor() {
    super('LIMITE_DE_EXTENSIONES', 'El reporte ya usó todas sus extensiones de vigencia');
  }
}

export class ErrorClaveDeIdempotenciaInvalida extends ErrorDeDominio {
  constructor() {
    super('CLAVE_DE_IDEMPOTENCIA_INVALIDA', 'La clave de idempotencia del reporte no es válida');
  }
}

export class ErrorAunNoCaduca extends ErrorDeDominio {
  constructor() {
    super('AUN_NO_CADUCA', 'El reporte todavía no alcanzó su fecha de caducidad');
  }
}
