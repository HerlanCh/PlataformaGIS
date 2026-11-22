import type { RepositorioDeEvaluacion } from '../domain/ports.js';
import type { EstadoDelRegistro, Envio, Transicion, VotoRegistrado } from '../domain/registro.js';

/** Registro en memoria con las mismas reglas que el de PostgreSQL: el primero gana. */
export class RegistroEnMemoria implements RepositorioDeEvaluacion {
  readonly envios = new Map<string, Envio>();
  readonly transiciones = new Map<string, Transicion>();
  readonly votos = new Map<string, VotoRegistrado>();

  registrarEnvio(envio: Envio): Promise<void> {
    if (!this.envios.has(envio.idEnvio)) this.envios.set(envio.idEnvio, envio);
    return Promise.resolve();
  }

  registrarTransicion(transicion: Transicion): Promise<void> {
    if (!this.transiciones.has(transicion.idEvento)) {
      this.transiciones.set(transicion.idEvento, transicion);
    }
    return Promise.resolve();
  }

  registrarVoto(voto: VotoRegistrado): Promise<void> {
    if (!this.votos.has(voto.idEvento)) this.votos.set(voto.idEvento, voto);
    return Promise.resolve();
  }

  estado(): Promise<EstadoDelRegistro> {
    const horas = [...this.envios.values()].map((e) => e.recibidoEn.getTime());
    return Promise.resolve({
      enviosRegistrados: horas.length,
      ultimoEnvioEn: horas.length > 0 ? new Date(Math.max(...horas)) : null,
    });
  }
}
