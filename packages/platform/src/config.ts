import { z } from 'zod';

const esquemaConfig = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.url(),
  CORS_ORIGIN: z.url(),
  APP_VERSION: z.string().min(1).default('0.0.0-dev'),
});

export interface ConfigApp {
  /** Versión desplegada; la informa `/health`. */
  readonly version: string;
  readonly entorno: 'development' | 'test' | 'production';
  readonly puerto: number;
  readonly nivelDeLog: string;
  readonly urlBaseDeDatos: string;
  readonly origenCors: string;
}

export type Entorno = Record<string, string | undefined>;

/** Se lanza al arrancar cuando falta una variable o tiene un valor inválido. */
export class ErrorDeConfig extends Error {
  constructor(readonly problemas: readonly string[]) {
    super(`Configuración inválida:\n- ${problemas.join('\n- ')}`);
    this.name = 'ErrorDeConfig';
  }
}

export const formatearProblemas = (error: z.ZodError): string[] =>
  error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);

/** Valida el entorno. La aplicación no arranca si falta una variable obligatoria. */
export function cargarConfig(env: Entorno = process.env): ConfigApp {
  const resultado = esquemaConfig.safeParse(env);
  if (!resultado.success) throw new ErrorDeConfig(formatearProblemas(resultado.error));

  const datos = resultado.data;
  return {
    version: datos.APP_VERSION,
    entorno: datos.NODE_ENV,
    puerto: datos.PORT,
    nivelDeLog: datos.LOG_LEVEL,
    urlBaseDeDatos: datos.DATABASE_URL,
    origenCors: datos.CORS_ORIGIN,
  };
}
