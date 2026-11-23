import { ErrorConflicto } from '@gis/shared-kernel';
import type { Instantanea, ResumenDeInstantanea } from '../domain/instantanea.js';
import type { RepositorioDeEvaluacion, RepositorioDeInstantaneas } from '../domain/ports.js';
import type { EstadoDelRegistro, Envio, Transicion, VotoRegistrado } from '../domain/registro.js';
import type { RegistroParaVistas } from '../domain/vistas.js';

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

  /** Entrega todo el registro: el dominio filtra la caja y el instante. */
  buscarParaVistas(): Promise<RegistroParaVistas> {
    return Promise.resolve({
      envios: [...this.envios.values()],
      transiciones: [...this.transiciones.values()],
    });
  }
}

export class InstantaneasEnMemoria implements RepositorioDeInstantaneas {
  readonly guardadas = new Map<string, Instantanea>();

  guardar(instantanea: Instantanea): Promise<void> {
    if ([...this.guardadas.values()].some((i) => i.nombre === instantanea.nombre)) {
      return Promise.reject(new ErrorConflicto('NOMBRE_REPETIDO', 'nombre repetido'));
    }
    this.guardadas.set(instantanea.id, instantanea);
    return Promise.resolve();
  }

  listar(): Promise<readonly ResumenDeInstantanea[]> {
    return Promise.resolve(
      [...this.guardadas.values()].map(({ procesada, base, ...resto }) => ({
        ...resto,
        puntosProcesada: procesada.length,
        puntosBase: base.length,
      })),
    );
  }

  buscarPorId(id: string): Promise<Instantanea | null> {
    return Promise.resolve(this.guardadas.get(id) ?? null);
  }
}
