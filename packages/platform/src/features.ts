import { z } from 'zod';
import { ConfigError, formatIssues } from './config.js';
import type { Env } from './config.js';

/** Módulos Imprescindibles: siempre activos, no tienen interruptor. */
export const CORE_MODULES: readonly string[] = ['reports', 'verification', 'identity'];

const PREFIJO = 'FEATURE_';

const flagSchema = z.enum(['true', 'false']).transform((valor) => valor === 'true');

export interface FeatureFlags {
  /** `true` si el módulo debe registrarse en la raíz de composición. */
  isEnabled(modulo: string): boolean;
}

/** Nombre de la variable de un módulo: `open-data` → `FEATURE_OPEN_DATA`. */
export const featureVariable = (modulo: string): string =>
  PREFIJO + modulo.toUpperCase().replaceAll('-', '_');

/**
 * Lee las variables `FEATURE_<MODULO>`. Solo admiten `true` o `false`;
 * un módulo opcional sin variable queda apagado.
 */
export function loadFeatureFlags(env: Env = process.env): FeatureFlags {
  const definidas = Object.fromEntries(
    Object.entries(env).filter(([clave]) => clave.startsWith(PREFIJO)),
  );
  const resultado = z.record(z.string(), flagSchema).safeParse(definidas);
  if (!resultado.success) throw new ConfigError(formatIssues(resultado.error));

  const flags = resultado.data;
  return {
    isEnabled: (modulo) => CORE_MODULES.includes(modulo) || flags[featureVariable(modulo)] === true,
  };
}
