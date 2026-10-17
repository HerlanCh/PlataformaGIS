import type { Reloj } from '@gis/shared-kernel';
import { errors, jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';
import type { ConfigJwt } from './config-http.js';
import { ErrorNoAutenticado } from './errores.js';

const EMISOR = 'plataforma-gis';
const ALGORITMO = 'HS256';

export type Rol = 'CIUDADANO' | 'MODERADOR';

/** Quién hace la solicitud, según su token. */
export interface Identidad {
  readonly idUsuario: string;
  readonly rol: Rol;
}

export interface TokenFirmado {
  readonly token: string;
  readonly expiraEn: Date;
}

const esquemaClaims = z.object({ sub: z.uuid(), rol: z.enum(['CIUDADANO', 'MODERADOR']) });

const codificar = (secreto: string): Uint8Array => new TextEncoder().encode(secreto);

/**
 * Emite y verifica los JWT de la API. Firma con la clave actual y acepta también la anterior,
 * para rotar la clave sin invalidar de golpe los tokens emitidos.
 */
export class ServicioDeTokens {
  private readonly claves: readonly Uint8Array[];

  constructor(
    private readonly config: ConfigJwt,
    private readonly reloj: Reloj,
  ) {
    this.claves = [config.secreto, config.secretoAnterior]
      .filter((clave): clave is string => clave !== null)
      .map(codificar);
  }

  async firmar(identidad: Identidad): Promise<TokenFirmado> {
    const emitido = Math.floor(this.reloj.ahora().getTime() / 1000);
    const expira = emitido + this.config.duracionS;
    const token = await new SignJWT({ rol: identidad.rol })
      .setProtectedHeader({ alg: ALGORITMO })
      .setSubject(identidad.idUsuario)
      .setIssuer(EMISOR)
      .setIssuedAt(emitido)
      .setExpirationTime(expira)
      .sign(this.claves[0]!);
    return { token, expiraEn: new Date(expira * 1000) };
  }

  /**
   * @throws {ErrorNoAutenticado} `TOKEN_VENCIDO` si expiró; `TOKEN_INVALIDO` si ninguna clave
   * lo verifica o sus datos no son válidos.
   */
  async verificar(token: string): Promise<Identidad> {
    for (const clave of this.claves) {
      try {
        const { payload } = await jwtVerify(token, clave, {
          algorithms: [ALGORITMO],
          issuer: EMISOR,
          currentDate: this.reloj.ahora(),
        });
        const claims = esquemaClaims.safeParse(payload);
        if (!claims.success) break;
        return { idUsuario: claims.data.sub, rol: claims.data.rol };
      } catch (error) {
        if (error instanceof errors.JWTExpired) {
          throw new ErrorNoAutenticado(
            'TOKEN_VENCIDO',
            'El token venció: vuelve a registrar el dispositivo',
          );
        }
        // Firma de otra clave: se prueba la siguiente. Cualquier otro defecto invalida el token.
        if (!(error instanceof errors.JWSSignatureVerificationFailed)) break;
      }
    }
    throw new ErrorNoAutenticado('TOKEN_INVALIDO', 'El token no es válido');
  }
}
