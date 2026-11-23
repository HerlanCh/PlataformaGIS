import { ErrorConflicto } from '@gis/shared-kernel';
import type { EnvioEtiquetable, Etiqueta, Evaluador } from '../domain/etiquetado.js';
import type { Instantanea, ResumenDeInstantanea } from '../domain/instantanea.js';
import type {
  Asignacion,
  RepositorioDeEtiquetas,
  RepositorioDeEvaluacion,
  RepositorioDeInstantaneas,
  RepositorioDeSesiones,
  RepositorioDeVerificaciones,
} from '../domain/ports.js';
import type { CierreDeTarea, Sesion } from '../domain/tarea.js';
import type { ReporteVerificable, Verificacion } from '../domain/verificacion.js';
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

  private tuvo(idReporte: string, estado: string): boolean {
    return [...this.transiciones.values()].some(
      (t) => t.idReporte === idReporte && t.estado === estado,
    );
  }

  private deLaComunidadEn(desde: Date, hasta: Date): Envio[] {
    return [...this.envios.values()]
      .filter(
        (e) =>
          e.fuenteOficial === null &&
          e.recibidoEn >= desde &&
          e.recibidoEn < hasta &&
          !this.tuvo(e.idReporte, 'RECHAZADO'),
      )
      .toSorted((a, b) => a.recibidoEn.getTime() - b.recibidoEn.getTime());
  }

  buscarEnviosEtiquetables(desde: Date, hasta: Date): Promise<readonly EnvioEtiquetable[]> {
    return Promise.resolve(
      this.deLaComunidadEn(desde, hasta).map(
        ({ idEnvio, codigoCategoria, publicLocation, recibidoEn }) => ({
          idEnvio,
          codigoCategoria,
          publicLocation,
          recibidoEn,
        }),
      ),
    );
  }

  buscarReportesVerificables(desde: Date, hasta: Date): Promise<readonly ReporteVerificable[]> {
    return Promise.resolve(
      this.deLaComunidadEn(desde, hasta)
        .filter((e) => e.tipo === 'CREADO')
        .map((e) => ({
          idReporte: e.idReporte,
          codigoCategoria: e.codigoCategoria,
          publicLocation: e.publicLocation,
          creadoEn: e.recibidoEn,
          confirmado: this.tuvo(e.idReporte, 'CONFIRMADO'),
        })),
    );
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

  buscarIdPorNombre(nombre: string): Promise<string | null> {
    return Promise.resolve(
      [...this.guardadas.values()].find((i) => i.nombre === nombre)?.id ?? null,
    );
  }
}

export class SesionesEnMemoria implements RepositorioDeSesiones {
  readonly sesiones = new Map<string, Sesion>();

  crear(sesion: Sesion): Promise<void> {
    if (
      [...this.sesiones.values()].some((s) => s.codigoParticipante === sesion.codigoParticipante)
    ) {
      return Promise.reject(new ErrorConflicto('PARTICIPANTE_REPETIDO', 'repetido'));
    }
    this.sesiones.set(sesion.id, sesion);
    return Promise.resolve();
  }

  listar(): Promise<readonly Sesion[]> {
    return Promise.resolve([...this.sesiones.values()]);
  }

  buscarPorTarea(idTarea: string): Promise<Sesion | null> {
    return Promise.resolve(
      [...this.sesiones.values()].find((s) => s.tareas.some((t) => t.id === idTarea)) ?? null,
    );
  }

  iniciar(idTarea: string, en: Date): Promise<boolean> {
    return this.cambiar(idTarea, (t) => (t.iniciadaEn ? null : { ...t, iniciadaEn: en }));
  }

  cerrar(idTarea: string, cierre: CierreDeTarea): Promise<boolean> {
    return this.cambiar(idTarea, (t) =>
      t.iniciadaEn && !t.terminadaEn ? { ...t, ...cierre } : null,
    );
  }

  private cambiar(
    idTarea: string,
    cambio: (t: Sesion['tareas'][number]) => Sesion['tareas'][number] | null,
  ): Promise<boolean> {
    for (const sesion of this.sesiones.values()) {
      const indice = sesion.tareas.findIndex((t) => t.id === idTarea);
      if (indice < 0) continue;
      const nueva = cambio(sesion.tareas[indice]!);
      if (!nueva) return Promise.resolve(false);
      const tareas = [...sesion.tareas] as [Sesion['tareas'][0], Sesion['tareas'][1]];
      tareas[indice] = nueva;
      this.sesiones.set(sesion.id, { ...sesion, tareas });
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  }
}

export class EtiquetasEnMemoria implements RepositorioDeEtiquetas {
  readonly etiquetas = new Map<string, Etiqueta>();

  guardar(evaluador: Evaluador, asignaciones: readonly Asignacion[]): Promise<void> {
    for (const { idEnvio, grupo } of asignaciones) {
      const clave = `${evaluador}:${idEnvio}`;
      if (grupo === null) this.etiquetas.delete(clave);
      else this.etiquetas.set(clave, { evaluador, idEnvio, grupo });
    }
    return Promise.resolve();
  }

  buscar(idsEnvio: readonly string[]): Promise<readonly Etiqueta[]> {
    return Promise.resolve(
      [...this.etiquetas.values()].filter((e) => idsEnvio.includes(e.idEnvio)),
    );
  }
}

export class VerificacionesEnMemoria implements RepositorioDeVerificaciones {
  readonly verificaciones = new Map<string, Verificacion>();

  guardar(verificacion: Verificacion): Promise<void> {
    this.verificaciones.set(verificacion.idReporte, verificacion);
    return Promise.resolve();
  }

  listar(): Promise<readonly Verificacion[]> {
    return Promise.resolve([...this.verificaciones.values()]);
  }
}
