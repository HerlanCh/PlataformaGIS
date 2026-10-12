import { ErrorIdentificadorInvalido } from '@gis/shared-kernel';
import type { Marca, CodigoCategoria, PuntoGeo, IdUsuario } from '@gis/shared-kernel';
import { ErrorRadioInvalido, ErrorSinCategorias } from './errors.js';

export type IdSuscripcion = Marca<string, 'SubscriptionId'>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** @throws {ErrorIdentificadorInvalido} si no es un UUID. */
export const idSuscripcion = (valor: string): IdSuscripcion => {
  if (!UUID.test(valor)) throw new ErrorIdentificadorInvalido('SubscriptionId', valor);
  return valor as IdSuscripcion;
};

/** Radio permitido de una zona suscrita, en metros (SRS 3.3). */
export const RADIO_DE_ZONA = { minM: 100, maxM: 2000 } as const;

export interface PropsZonaSuscrita {
  readonly id: IdSuscripcion;
  readonly idUsuario: IdUsuario;
  readonly centro: PuntoGeo;
  readonly radioM: number;
  readonly categorias: readonly CodigoCategoria[];
  readonly creadoEn: Date;
}

export interface EntradaCrearZonaSuscrita {
  readonly id: IdSuscripcion;
  readonly idUsuario: IdUsuario;
  readonly centro: PuntoGeo;
  readonly radioM: number;
  readonly categorias: readonly CodigoCategoria[];
  readonly ahora: Date;
}

const radioValido = (radioM: number): boolean =>
  Number.isInteger(radioM) && radioM >= RADIO_DE_ZONA.minM && radioM <= RADIO_DE_ZONA.maxM;

/** Zona de interés de un usuario: un círculo y las categorías que quiere recibir. Inmutable. */
export class ZonaSuscrita {
  readonly id: IdSuscripcion;
  readonly idUsuario: IdUsuario;
  readonly centro: PuntoGeo;
  readonly radioM: number;
  readonly categorias: readonly CodigoCategoria[];
  readonly creadoEn: Date;

  private constructor(props: PropsZonaSuscrita) {
    this.id = props.id;
    this.idUsuario = props.idUsuario;
    this.centro = props.centro;
    this.radioM = props.radioM;
    this.categorias = Object.freeze([...props.categorias]);
    this.creadoEn = props.creadoEn;
    Object.freeze(this);
  }

  /**
   * Crea una zona suscrita. Las categorías repetidas se guardan una sola vez.
   * @throws {ErrorRadioInvalido} si el radio no es un entero entre 100 m y 2000 m.
   * @throws {ErrorSinCategorias} si no se eligió ninguna categoría.
   */
  static crear(input: EntradaCrearZonaSuscrita): ZonaSuscrita {
    if (!radioValido(input.radioM)) {
      throw new ErrorRadioInvalido(RADIO_DE_ZONA.minM, RADIO_DE_ZONA.maxM);
    }
    const categories = [...new Set(input.categorias)];
    if (categories.length === 0) throw new ErrorSinCategorias();

    return new ZonaSuscrita({
      id: input.id,
      idUsuario: input.idUsuario,
      centro: input.centro,
      radioM: input.radioM,
      categorias: categories,
      creadoEn: input.ahora,
    });
  }

  /** Reconstruye una zona ya persistida. */
  static restaurar(props: PropsZonaSuscrita): ZonaSuscrita {
    return new ZonaSuscrita(props);
  }
}
