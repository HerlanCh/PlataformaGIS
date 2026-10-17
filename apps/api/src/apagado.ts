import type { Registro } from '@gis/platform';

/** Algo que se cierra al apagar: el WebSocket, el servidor HTTP o el pool de la base de datos. */
export interface Cerrable {
  readonly nombre: string;
  cerrar(): Promise<void>;
}

export interface OpcionesDeApagado {
  /** En orden: primero lo que recibe solicitudes, al final la base de datos. */
  readonly recursos: readonly Cerrable[];
  readonly registro: Registro;
  /** Si el cierre tarda más, se termina el proceso de todos modos. */
  readonly limiteMs?: number;
  readonly salir?: (codigo: number) => void;
}

/**
 * Apagado ordenado (roadmap 6.7): deja de aceptar conexiones, termina las solicitudes en curso y
 * cierra la base de datos. Llamarla dos veces no repite el cierre.
 */
export function crearApagado(opciones: OpcionesDeApagado): (senal: string) => Promise<void> {
  const {
    recursos,
    registro,
    limiteMs = 10_000,
    salir = (codigo) => process.exit(codigo),
  } = opciones;
  let enCurso: Promise<void> | null = null;

  const apagar = async (senal: string): Promise<void> => {
    registro.info({ senal }, 'apagando');
    const vencido = setTimeout(() => {
      registro.error({ limiteMs }, 'el apagado tardó demasiado: se fuerza la salida');
      salir(1);
    }, limiteMs);
    vencido.unref();
    try {
      for (const recurso of recursos) {
        await recurso.cerrar();
        registro.info({ recurso: recurso.nombre }, 'cerrado');
      }
      salir(0);
    } catch (error) {
      registro.error({ err: error }, 'falló el apagado');
      salir(1);
    } finally {
      clearTimeout(vencido);
    }
  };

  return (senal) => (enCurso ??= apagar(senal));
}
