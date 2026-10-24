import {
  crearEvento,
  esquemaCodigoCategoria,
  reporteDuplicadoDetectadoV1,
  validarEntrada,
} from '@gis/contracts';
import { ErrorLimiteExcedido, idReporte, idUsuario } from '@gis/shared-kernel';
import type {
  GeneradorDeId,
  IdUsuario,
  LimitadorDeFrecuencia,
  PuntoGeo,
  Reloj,
} from '@gis/shared-kernel';
import { z } from 'zod';
import type { Categoria } from '../domain/category.js';
import type {
  RepositorioDeCategorias,
  RepositorioDeReportes,
  ReputacionDelAutor,
} from '../domain/ports.js';
import { esClaveDeIdempotenciaValida, Reporte } from '../domain/report.js';
import { proyeccionPublica } from '../domain/reporte-publico.js';
import type { ReportePublico } from '../domain/reporte-publico.js';
import {
  buscarCategoria,
  buscarReenvio,
  creacionIdempotente,
  puntoDe,
  vistaDelAutor,
} from './creacion.js';
import { eventosDeIntegracionDe } from './eventos.js';
import type { UnidadDeTrabajoDeReporte } from './ports.js';

/** Límite de creación de reportes por usuario (SRS 3.3). */
export const LIMITE_DE_REPORTES = { cantidad: 5, ventanaSegundos: 10 * 60 } as const;

const esquemaEntrada = z.object({
  idAutor: z.uuid(),
  codigoCategoria: esquemaCodigoCategoria,
  latitud: z.number(),
  longitud: z.number(),
  idempotencyKey: z.string().refine(esClaveDeIdempotenciaValida, {
    message: 'La clave de idempotencia debe tener entre 8 y 128 letras, dígitos, "-" o "_"',
  }),
});

export type EntradaCrearReporte = z.input<typeof esquemaEntrada>;

/**
 * - `CREADO`: se creó el reporte (o es el reenvío de uno ya creado).
 * - `DUPLICADO`: ya había uno vigente de otro usuario; el envío cuenta como su confirmación.
 * - `PROPIO_EXISTENTE`: ya había uno vigente del mismo autor; no se registra nada.
 */
export type ResultadoCrearReporte = 'CREADO' | 'DUPLICADO' | 'PROPIO_EXISTENTE';

export interface SalidaCrearReporte {
  readonly resultado: ResultadoCrearReporte;
  readonly reporte: ReportePublico;
}

export interface DependenciasCrearReporte {
  readonly reportes: RepositorioDeReportes;
  readonly categorias: RepositorioDeCategorias;
  readonly unidadDeTrabajo: UnidadDeTrabajoDeReporte;
  readonly reputacion: ReputacionDelAutor;
  readonly limitador: LimitadorDeFrecuencia;
  readonly reloj: Reloj;
  readonly ids: GeneradorDeId;
}

/** HU-01 y HU-05: crea un reporte, o lo convierte en confirmación si ya hay uno igual cerca. */
export class CrearReporte {
  constructor(private readonly deps: DependenciasCrearReporte) {}

  async ejecutar(entrada: EntradaCrearReporte): Promise<SalidaCrearReporte> {
    const datos = validarEntrada(esquemaEntrada, entrada);
    const idAutor = idUsuario(datos.idAutor);

    // El reenvío de un reporte ya procesado no consume cupo ni repite efectos (HU-05).
    const reenviado = await this.reenvio(idAutor, datos.idempotencyKey);
    if (reenviado) return reenviado;

    await this.consumirCupo(idAutor);
    const categoria = await buscarCategoria(this.deps.categorias, datos.codigoCategoria);
    const punto = puntoDe(datos.latitud, datos.longitud);
    const ahora = this.deps.reloj.ahora();

    const existente = await this.deps.reportes.buscarDuplicado(categoria, punto, ahora);
    if (existente) return this.alEncontrarDuplicado(existente, idAutor, punto, ahora);

    return creacionIdempotente(
      () => this.crear(categoria, idAutor, punto, datos.idempotencyKey, ahora),
      () => this.reenvio(idAutor, datos.idempotencyKey),
    );
  }

  private async reenvio(idAutor: IdUsuario, clave: string): Promise<SalidaCrearReporte | null> {
    const previo = await buscarReenvio(this.deps.reportes, idAutor, clave);
    return previo && { resultado: 'CREADO', reporte: vistaDelAutor(previo) };
  }

  private async consumirCupo(idAutor: IdUsuario): Promise<void> {
    const { cantidad, ventanaSegundos } = LIMITE_DE_REPORTES;
    const consumo = await this.deps.limitador.consumir(
      `reportes:${idAutor}`,
      cantidad,
      ventanaSegundos,
    );
    if (!consumo.permitido) throw new ErrorLimiteExcedido(consumo.reintentarEnSegundos);
  }

  private async alEncontrarDuplicado(
    existente: Reporte,
    idAutor: IdUsuario,
    punto: PuntoGeo,
    ahora: Date,
  ): Promise<SalidaCrearReporte> {
    // HU-01, escenario 4: el propio reporte no se vota ni se duplica.
    if (existente.authorId === idAutor) {
      return { resultado: 'PROPIO_EXISTENTE', reporte: proyeccionPublica(existente) };
    }
    // HU-01, escenario 2: `verification` lo registra como confirmación de quien lo envió.
    const evento = crearEvento(
      reporteDuplicadoDetectadoV1,
      {
        idReporteExistente: existente.id,
        idReportante: idAutor,
        ubicacionReportante: { latitud: punto.latitud, longitud: punto.longitud },
      },
      { id: this.deps.ids.siguiente(), ocurridoEn: ahora },
    );
    await this.deps.unidadDeTrabajo.registrarEventos([evento]);
    return { resultado: 'DUPLICADO', reporte: proyeccionPublica(existente) };
  }

  private async crear(
    categoria: Categoria,
    idAutor: IdUsuario,
    punto: PuntoGeo,
    clave: string,
    ahora: Date,
  ): Promise<SalidaCrearReporte> {
    const reporte = Reporte.crear({
      id: idReporte(this.deps.ids.siguiente()),
      categoria,
      authorId: idAutor,
      location: punto,
      idempotencyKey: clave,
      ahora,
    });
    let eventos = eventosDeIntegracionDe(reporte, this.deps.ids);

    // SRS 3.2.7: el reporte de un silenciado se guarda rechazado y no se difunde.
    if (await this.deps.reputacion.estaSilenciado(idAutor)) {
      reporte.rechazar('AUTOR_SILENCIADO', ahora);
      reporte.extraerEventos();
      eventos = [];
    }
    await this.deps.unidadDeTrabajo.confirmar(reporte, eventos);
    return { resultado: 'CREADO', reporte: vistaDelAutor(reporte) };
  }
}
