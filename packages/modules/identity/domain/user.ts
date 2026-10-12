import type { IdUsuario } from '@gis/shared-kernel';
import {
  ErrorHashDeDispositivoInvalido,
  ErrorIdTelegramInvalido,
  ErrorTelegramYaVinculado,
} from './errors.js';

export type Rol = 'CIUDADANO' | 'MODERADOR';

export interface PropsUsuario {
  readonly id: IdUsuario;
  readonly hashDispositivo: string;
  readonly rol: Rol;
  readonly idTelegram: string | null;
  readonly creadoEn: Date;
}

export interface EntradaRegistrarDispositivo {
  readonly id: IdUsuario;
  readonly hashDispositivo: string;
  readonly idTelegram?: string;
  readonly ahora: Date;
}

// El hash lo genera el cliente; aquí solo se exige que sea opaco y de tamaño razonable.
const HASH_DE_DISPOSITIVO = /^[A-Za-z0-9_-]{16,128}$/;
const ID_DE_TELEGRAM = /^\d{1,20}$/;

function validarTelegram(idTelegram: string): string {
  if (!ID_DE_TELEGRAM.test(idTelegram)) throw new ErrorIdTelegramInvalido();
  return idTelegram;
}

/** Usuario anónimo: se identifica por su dispositivo y, opcionalmente, por Telegram. */
export class Usuario {
  private constructor(private props: PropsUsuario) {}

  /** Alta de un usuario nuevo. Todo usuario nace con rol `CIUDADANO`. */
  static registrarDispositivo(input: EntradaRegistrarDispositivo): Usuario {
    if (!HASH_DE_DISPOSITIVO.test(input.hashDispositivo))
      throw new ErrorHashDeDispositivoInvalido();
    return new Usuario({
      id: input.id,
      hashDispositivo: input.hashDispositivo,
      rol: 'CIUDADANO',
      idTelegram: input.idTelegram === undefined ? null : validarTelegram(input.idTelegram),
      creadoEn: input.ahora,
    });
  }

  /** Reconstruye un usuario ya persistido. No valida ni aplica reglas de alta. */
  static restaurar(props: PropsUsuario): Usuario {
    return new Usuario(props);
  }

  get id(): IdUsuario {
    return this.props.id;
  }

  get hashDispositivo(): string {
    return this.props.hashDispositivo;
  }

  get rol(): Rol {
    return this.props.rol;
  }

  get idTelegram(): string | null {
    return this.props.idTelegram;
  }

  get creadoEn(): Date {
    return this.props.creadoEn;
  }

  get esModerador(): boolean {
    return this.props.rol === 'MODERADOR';
  }

  /** Vincula la cuenta de Telegram. Repetir el mismo ID no tiene efecto. */
  vincularTelegram(idTelegram: string): void {
    const valido = validarTelegram(idTelegram);
    if (this.props.idTelegram !== null && this.props.idTelegram !== valido) {
      throw new ErrorTelegramYaVinculado();
    }
    this.props = { ...this.props, idTelegram: valido };
  }

  ascenderAModerador(): void {
    this.props = { ...this.props, rol: 'MODERADOR' };
  }
}
