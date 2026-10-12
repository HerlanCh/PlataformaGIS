import { codigoCategoria, ErrorDeDominio } from '@gis/shared-kernel';
import type { CodigoCategoria } from '@gis/shared-kernel';

export interface PropsCategoria {
  readonly codigo: CodigoCategoria;
  readonly nombre: string;
  /** Tiempo de vida inicial de un reporte, en minutos. */
  readonly ttlMinutos: number;
  /** Radio dentro del cual otro reporte de la misma categoría es un duplicado, en metros. */
  readonly radioDuplicadoM: number;
  /** Si es sensible, la ubicación pública se ofusca (`PoliticaDePrivacidad`). */
  readonly esSensible: boolean;
}

export class ErrorCategoriaInvalida extends ErrorDeDominio {
  constructor(detalle: string) {
    super('CATEGORIA_INVALIDA', `Categoría inválida: ${detalle}`);
  }
}

const enteroPositivo = (valor: number): boolean => Number.isInteger(valor) && valor > 0;

export class Categoria {
  readonly codigo: CodigoCategoria;
  readonly nombre: string;
  readonly ttlMinutos: number;
  readonly radioDuplicadoM: number;
  readonly esSensible: boolean;

  private constructor(props: PropsCategoria) {
    this.codigo = props.codigo;
    this.nombre = props.nombre;
    this.ttlMinutos = props.ttlMinutos;
    this.radioDuplicadoM = props.radioDuplicadoM;
    this.esSensible = props.esSensible;
    Object.freeze(this);
  }

  /** @throws {ErrorCategoriaInvalida} si el nombre está vacío o el TTL o el radio no son enteros positivos. */
  static crear(props: PropsCategoria): Categoria {
    if (props.nombre.trim() === '') throw new ErrorCategoriaInvalida('el nombre está vacío');
    if (!enteroPositivo(props.ttlMinutos)) {
      throw new ErrorCategoriaInvalida('el TTL debe ser un entero positivo de minutos');
    }
    if (!enteroPositivo(props.radioDuplicadoM)) {
      throw new ErrorCategoriaInvalida(
        'el radio de deduplicación debe ser un entero positivo de metros',
      );
    }
    return new Categoria({ ...props, nombre: props.nombre.trim() });
  }
}

const mvp = (
  codigo: string,
  nombre: string,
  ttlMinutos: number,
  radioDuplicadoM: number,
  esSensible = false,
): Categoria =>
  Categoria.crear({
    codigo: codigoCategoria(codigo),
    nombre: nombre,
    ttlMinutos: ttlMinutos,
    radioDuplicadoM: radioDuplicadoM,
    esSensible: esSensible,
  });

/** Las cinco categorías del MVP con sus parámetros (SRS 3.1). */
export const CATEGORIAS_MVP: readonly Categoria[] = [
  mvp('bloqueo', 'Bloqueo o protesta vial', 360, 100),
  mvp('accidente', 'Accidente de tránsito', 180, 50),
  mvp('robo', 'Hecho delictivo / robo', 120, 200, true),
  mvp('infraestructura', 'Derrumbe / vía dañada / fuga', 1440, 50),
  mvp('jauria', 'Jauría de perros agresivos', 120, 150),
];
