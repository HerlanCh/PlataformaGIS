import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.url(),
  CORS_ORIGIN: z.url(),
  APP_VERSION: z.string().min(1).default('0.0.0-dev'),
});

export interface AppConfig {
  /** Versión desplegada; la informa `/health`. */
  readonly version: string;
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly port: number;
  readonly logLevel: string;
  readonly databaseUrl: string;
  readonly corsOrigin: string;
}

export type Env = Record<string, string | undefined>;

/** Se lanza al arrancar cuando falta una variable o tiene un valor inválido. */
export class ConfigError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`Configuración inválida:\n- ${issues.join('\n- ')}`);
    this.name = 'ConfigError';
  }
}

export const formatIssues = (error: z.ZodError): string[] =>
  error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);

/** Valida el entorno. La aplicación no arranca si falta una variable obligatoria. */
export function loadConfig(env: Env = process.env): AppConfig {
  const resultado = configSchema.safeParse(env);
  if (!resultado.success) throw new ConfigError(formatIssues(resultado.error));

  const datos = resultado.data;
  return {
    version: datos.APP_VERSION,
    nodeEnv: datos.NODE_ENV,
    port: datos.PORT,
    logLevel: datos.LOG_LEVEL,
    databaseUrl: datos.DATABASE_URL,
    corsOrigin: datos.CORS_ORIGIN,
  };
}
