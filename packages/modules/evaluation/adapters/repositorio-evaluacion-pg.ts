import type { Ejecutor } from '@gis/platform';
import { count, max } from 'drizzle-orm';
import type { RepositorioDeEvaluacion } from '../domain/ports.js';
import type { EstadoDelRegistro, Envio, Transicion, VotoRegistrado } from '../domain/registro.js';
import { evaluacionEnvios, evaluacionTransiciones, evaluacionVotos } from './schema.js';

/** Registro de la evaluación en PostgreSQL. Cada escritura ignora lo que ya estaba. */
export class RepositorioEvaluacionPg implements RepositorioDeEvaluacion {
  constructor(private readonly db: Ejecutor) {}

  async registrarEnvio(envio: Envio): Promise<void> {
    const { publicLocation, ...resto } = envio;
    await this.db
      .insert(evaluacionEnvios)
      .values({
        ...resto,
        publicLocation: { x: publicLocation.longitud, y: publicLocation.latitud },
      })
      .onConflictDoNothing({ target: evaluacionEnvios.idEnvio });
  }

  async registrarTransicion(transicion: Transicion): Promise<void> {
    await this.db
      .insert(evaluacionTransiciones)
      .values({ ...transicion })
      .onConflictDoNothing({ target: evaluacionTransiciones.idEvento });
  }

  async registrarVoto(voto: VotoRegistrado): Promise<void> {
    await this.db
      .insert(evaluacionVotos)
      .values({ ...voto })
      .onConflictDoNothing({ target: evaluacionVotos.idEvento });
  }

  async estado(): Promise<EstadoDelRegistro> {
    const [fila] = await this.db
      .select({ enviosRegistrados: count(), ultimoEnvioEn: max(evaluacionEnvios.recibidoEn) })
      .from(evaluacionEnvios);
    return {
      enviosRegistrados: fila?.enviosRegistrados ?? 0,
      ultimoEnvioEn: fila?.ultimoEnvioEn ?? null,
    };
  }
}
