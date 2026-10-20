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

export class ErrorNoEsElAutor extends ErrorDeDominio {
  constructor() {
    super('NO_ES_EL_AUTOR', 'Solo el autor puede describir su reporte');
  }
}

export class ErrorReporteNoVigente extends ErrorDeDominio {
  constructor(estado: string) {
    super('REPORTE_NO_VIGENTE', `Un reporte ${estado} ya no se puede describir`);
  }
}

export class ErrorDescripcionYaAgregada extends ErrorDeDominio {
  constructor() {
    super('DESCRIPCION_YA_AGREGADA', 'El reporte ya tiene descripción');
  }
}

export class ErrorDescripcionInvalida extends ErrorDeDominio {
  constructor(maximo: number) {
    super('DESCRIPCION_INVALIDA', `La descripción debe tener entre 1 y ${maximo} caracteres`);
  }
}
