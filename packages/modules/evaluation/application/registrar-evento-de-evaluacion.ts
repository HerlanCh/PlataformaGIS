import {
  CLAVES_REPORTE_CREADO,
  claveDeEvento,
  envioDuplicadoRegistradoV1,
  leerContenido,
  leerReporteCreado,
  reporteCaducadoV1,
  reporteConfirmadoV1,
  reporteExtendidoV1,
  reporteRechazadoV1,
  reporteResueltoV1,
  votoEmitidoV1,
} from '@gis/contracts';
import type { EventoDeIntegracion } from '@gis/contracts';
import type { RepositorioDeEvaluacion } from '../domain/ports.js';
import type { EstadoRegistrado } from '../domain/registro.js';

type Manejo = (evento: EventoDeIntegracion, en: Date) => Promise<void>;

/** Confirmación y extensión: el reporte queda `CONFIRMADO` con otra caducidad. */
const VIGENCIAS = [reporteConfirmadoV1, reporteExtendidoV1] as const;

const CIERRES = [
  [reporteResueltoV1, 'RESUELTO'],
  [reporteCaducadoV1, 'CADUCADO'],
  [reporteRechazadoV1, 'RECHAZADO'],
] as const satisfies readonly (readonly [unknown, EstadoRegistrado])[];

/**
 * ADR-007: registra cada envío, cada cambio de estado y cada voto para reconstruir después las dos
 * vistas. Usa la hora del evento, no la de su proceso. Nunca lee ni guarda el autor, el votante ni
 * la ubicación real: de `VotoEmitido.v1` solo toma el peso, el valor y la decisión.
 */
export class RegistrarEventoDeEvaluacion {
  static readonly eventos = [
    ...CLAVES_REPORTE_CREADO,
    envioDuplicadoRegistradoV1.clave,
    ...VIGENCIAS.map((definicion) => definicion.clave),
    ...CIERRES.map(([definicion]) => definicion.clave),
    votoEmitidoV1.clave,
  ];

  private readonly manejos: ReadonlyMap<string, Manejo>;

  constructor(private readonly registro: RepositorioDeEvaluacion) {
    const creacion: Manejo = (evento) => this.alCrear(evento);
    this.manejos = new Map<string, Manejo>([
      ...CLAVES_REPORTE_CREADO.map((clave): [string, Manejo] => [clave, creacion]),
      [envioDuplicadoRegistradoV1.clave, (evento) => this.alDuplicar(evento)],
      ...VIGENCIAS.map((definicion): [string, Manejo] => [
        definicion.clave,
        (evento, en) => {
          const { idReporte, caducaEn } = leerContenido(definicion, evento);
          return this.transicion(evento, idReporte, 'CONFIRMADO', new Date(caducaEn), en);
        },
      ]),
      ...CIERRES.map(([definicion, estado]): [string, Manejo] => [
        definicion.clave,
        (evento, en) => {
          const { idReporte } = leerContenido(definicion, evento);
          return this.transicion(evento, idReporte, estado, null, en);
        },
      ]),
      [votoEmitidoV1.clave, (evento, en) => this.alVotar(evento, en)],
    ]);
  }

  async manejar(evento: EventoDeIntegracion): Promise<void> {
    const manejo = this.manejos.get(claveDeEvento(evento));
    if (manejo) await manejo(evento, new Date(evento.ocurridoEn));
  }

  private async alCrear(evento: EventoDeIntegracion): Promise<void> {
    const creado = leerReporteCreado(evento);
    const creadoEn = new Date(creado.creadoEn);
    await this.registro.registrarEnvio({
      idEnvio: creado.idReporte,
      tipo: 'CREADO',
      idReporte: creado.idReporte,
      codigoCategoria: creado.codigoCategoria,
      publicLocation: creado.publicLocation,
      fuenteOficial: creado.fuenteOficial,
      recibidoEn: creadoEn,
    });
    await this.registro.registrarTransicion({
      idEvento: evento.id,
      idReporte: creado.idReporte,
      estado: creado.estado,
      caducaEn: new Date(creado.caducaEn),
      ocurridoEn: creadoEn,
    });
  }

  private alDuplicar(evento: EventoDeIntegracion): Promise<void> {
    const envio = leerContenido(envioDuplicadoRegistradoV1, evento);
    return this.registro.registrarEnvio({
      idEnvio: envio.idEnvio,
      tipo: 'DUPLICADO',
      idReporte: envio.idReporteExistente,
      codigoCategoria: envio.codigoCategoria,
      publicLocation: envio.publicLocation,
      fuenteOficial: null,
      recibidoEn: new Date(envio.recibidoEn),
    });
  }

  private transicion(
    evento: EventoDeIntegracion,
    idReporte: string,
    estado: EstadoRegistrado,
    caducaEn: Date | null,
    ocurridoEn: Date,
  ): Promise<void> {
    return this.registro.registrarTransicion({
      idEvento: evento.id,
      idReporte,
      estado,
      caducaEn,
      ocurridoEn,
    });
  }

  private alVotar(evento: EventoDeIntegracion, en: Date): Promise<void> {
    const { idReporte, valor, peso, decision } = leerContenido(votoEmitidoV1, evento);
    return this.registro.registrarVoto({
      idEvento: evento.id,
      idReporte,
      valor,
      peso,
      decision,
      ocurridoEn: en,
    });
  }
}
