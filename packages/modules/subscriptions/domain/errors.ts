import { ErrorDeDominio } from '@gis/shared-kernel';

export class ErrorRadioInvalido extends ErrorDeDominio {
  constructor(minimoM: number, maximoM: number) {
    super(
      'RADIO_INVALIDO',
      `El radio de una zona debe estar entre ${minimoM} m y ${maximoM} m, en metros enteros`,
    );
  }
}

export class ErrorSinCategorias extends ErrorDeDominio {
  constructor() {
    super('SIN_CATEGORIAS', 'Una zona suscrita necesita al menos una categoría');
  }
}
