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

// Igual que `secreto`: vacía cuenta como ausente.
const opcional = z.preprocess((valor) => (valor === '' ? undefined : valor), z.string().optional());

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
    /** Claves VAPID de Web Push (HU-08). Sin ellas los avisos solo quedan en el log. */
    VAPID_PUBLIC_KEY: opcional,
    VAPID_PRIVATE_KEY: opcional,
    VAPID_SUBJECT: opcional,
    /** DSN de GlitchTip (roadmap 12). Sin él, los errores solo quedan en el log. */
    SENTRY_DSN: z.preprocess((valor) => (valor === '' ? undefined : valor), z.url().optional()),
    /** Entorno con el que se etiquetan los errores en GlitchTip. */
    SENTRY_ENVIRONMENT: z.string().min(1).default('produccion'),
    /** Usuario de la prueba de humo (roadmap 12): sus reportes no tienen efectos fuera del mapa. */
    HUMO_ID_USUARIO: z.preprocess(
      (valor) => (valor === '' ? undefined : valor),
      z.uuid().optional(),
    ),
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

/** Claves VAPID con las que la API firma los avisos Web Push. */
export interface ConfigVapid {
  readonly publica: string;
  readonly privada: string;
  /** `mailto:` de contacto que exige VAPID. */
  readonly contacto: string;
}

export interface ConfigHttp {
  readonly jwt: ConfigJwt;
  /** Solicitudes por minuto y por IP en toda la API. */
  readonly limitePorMinuto: number;
  /** Pausa del despachador del outbox cuando no hay pendientes. */
  readonly despachoIntervaloMs: number;
  /** Cada cuánto se caducan los reportes vencidos. */
  readonly caducidadIntervaloS: number;
  /** `null` si faltan las claves: no se envían avisos push. */
  readonly vapid: ConfigVapid | null;
  /** `null` si no hay prueba de humo en este entorno. */
  readonly idUsuarioDeHumo: string | null;
  /** `null` sin DSN: no se envían errores a GlitchTip. */
  readonly errores: { readonly dsn: string; readonly entorno: string } | null;
}

/** Contacto por defecto de VAPID si no se configura otro. */
const CONTACTO_VAPID = 'mailto:alerta-lp@example.org';

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
    vapid:
      datos.VAPID_PUBLIC_KEY && datos.VAPID_PRIVATE_KEY
        ? {
            publica: datos.VAPID_PUBLIC_KEY,
            privada: datos.VAPID_PRIVATE_KEY,
            contacto: datos.VAPID_SUBJECT ?? CONTACTO_VAPID,
          }
        : null,
    idUsuarioDeHumo: datos.HUMO_ID_USUARIO ?? null,
    errores: datos.SENTRY_DSN ? { dsn: datos.SENTRY_DSN, entorno: datos.SENTRY_ENVIRONMENT } : null,
  };
}
