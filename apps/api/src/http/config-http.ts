import { ErrorDeConfig, formatearProblemas } from '@gis/platform';
import type { Entorno } from '@gis/platform';
import { z } from 'zod';

/** Solo para desarrollo y pruebas: en producción `JWT_SECRET` es obligatorio. */
const SECRETO_DE_DESARROLLO = 'secreto-de-desarrollo-no-usar-en-produccion-0000';

// Una variable vacía en `.env` cuenta como ausente.
const secreto = z.preprocess(
  (valor) => (valor === '' ? undefined : valor),
  z.string().min(32, 'debe tener al menos 32 caracteres').optional(),
);

const esquema = z
  .object({
    NODE_ENV: z.string().default('development'),
    JWT_SECRET: secreto,
    /** Clave anterior durante una rotación: sus tokens se aceptan hasta que venzan. */
    JWT_SECRET_ANTERIOR: secreto,
    JWT_DURACION_S: z.coerce
      .number()
      .int()
      .min(60)
      .default(24 * 60 * 60),
    LIMITE_POR_MINUTO: z.coerce.number().int().min(1).default(300),
    DESPACHO_INTERVALO_MS: z.coerce.number().int().min(10).default(250),
    CADUCIDAD_INTERVALO_S: z.coerce.number().int().min(1).default(60),
  })
  .refine((env) => env.NODE_ENV !== 'production' || env.JWT_SECRET !== undefined, {
    message: 'es obligatorio en producción',
    path: ['JWT_SECRET'],
  });

export interface ConfigJwt {
  readonly secreto: string;
  readonly secretoAnterior: string | null;
  readonly duracionS: number;
}

export interface ConfigHttp {
  readonly jwt: ConfigJwt;
  /** Solicitudes por minuto y por IP en toda la API. */
  readonly limitePorMinuto: number;
  /** Pausa del despachador del outbox cuando no hay pendientes. */
  readonly despachoIntervaloMs: number;
  /** Cada cuánto se caducan los reportes vencidos. */
  readonly caducidadIntervaloS: number;
}

/** Configuración propia del proceso de la API (HTTP, tiempo real y tareas). Si es inválida, no arranca. */
export function cargarConfigHttp(env: Entorno = process.env): ConfigHttp {
  const resultado = esquema.safeParse(env);
  if (!resultado.success) throw new ErrorDeConfig(formatearProblemas(resultado.error));
  const datos = resultado.data;
  return {
    jwt: {
      secreto: datos.JWT_SECRET ?? SECRETO_DE_DESARROLLO,
      secretoAnterior: datos.JWT_SECRET_ANTERIOR ?? null,
      duracionS: datos.JWT_DURACION_S,
    },
    limitePorMinuto: datos.LIMITE_POR_MINUTO,
    despachoIntervaloMs: datos.DESPACHO_INTERVALO_MS,
    caducidadIntervaloS: datos.CADUCIDAD_INTERVALO_S,
  };
}
