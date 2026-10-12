import { z } from 'zod';
import { ErrorDeConfig, formatearProblemas } from './config.js';
import type { Entorno } from './config.js';

/** Módulos Imprescindibles: siempre activos, no tienen interruptor. */
export const MODULOS_BASE: readonly string[] = ['reports', 'verification', 'identity'];

const PREFIJO = 'FEATURE_';

const esquemaInterruptor = z.enum(['true', 'false']).transform((valor) => valor === 'true');

export interface InterruptoresDeFunciones {
  /** `true` si el módulo debe registrarse en la raíz de composición. */
  estaActivo(modulo: string): boolean;
}

/** Nombre de la variable de un módulo: `open-data` → `FEATURE_OPEN_DATA`. */
export const variableDeInterruptor = (modulo: string): string =>
  PREFIJO + modulo.toUpperCase().replaceAll('-', '_');

/**
 * Lee las variables `FEATURE_<MODULO>`. Solo admiten `true` o `false`;
 * un módulo opcional sin variable queda apagado.
 */
export function cargarInterruptores(env: Entorno = process.env): InterruptoresDeFunciones {
  const definidas = Object.fromEntries(
    Object.entries(env).filter(([clave]) => clave.startsWith(PREFIJO)),
  );
  const resultado = z.record(z.string(), esquemaInterruptor).safeParse(definidas);
  if (!resultado.success) throw new ErrorDeConfig(formatearProblemas(resultado.error));

  const flags = resultado.data;
  return {
    estaActivo: (modulo) =>
      MODULOS_BASE.includes(modulo) || flags[variableDeInterruptor(modulo)] === true,
  };
}
