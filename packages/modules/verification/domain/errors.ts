import { ErrorDeDominio } from '@gis/shared-kernel';

export class ErrorAutorNoPuedeVotar extends ErrorDeDominio {
  constructor() {
    super('AUTOR_NO_PUEDE_VOTAR', 'El autor de un reporte no puede votar sobre su propio reporte');
  }
}

export class ErrorYaVoto extends ErrorDeDominio {
  constructor() {
    super('YA_VOTO', 'El usuario ya votó sobre este reporte');
  }
}

export class ErrorDemasiadoLejosParaVotar extends ErrorDeDominio {
  constructor(maximoM: number) {
    super(
      'DEMASIADO_LEJOS_PARA_VOTAR',
      `Para votar hay que estar a ${maximoM} m o menos del incidente`,
    );
  }
}

export class ErrorReporteNoActivo extends ErrorDeDominio {
  constructor() {
    super('REPORTE_NO_ACTIVO', 'Solo se puede votar sobre un reporte vigente');
  }
}
