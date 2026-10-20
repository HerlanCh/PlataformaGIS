import type { DatoAbierto, ReporteFinalizado } from '../domain/dato-abierto.js';
import type {
  ConsultaDeReportesFinalizados,
  FilaPublica,
  RepositorioDeDatosAbiertos,
  Resumen,
} from '../domain/ports.js';

export const reporteFinalizado = (cambios: Partial<ReporteFinalizado> = {}): ReporteFinalizado => ({
  idReporte: '6f1c2f0e-3b7a-4d2a-9c58-000000000001',
  codigoCategoria: 'bloqueo',
  estado: 'RESUELTO',
  motivoRechazo: null,
  publicLocation: { latitud: -16.4955, longitud: -68.1336 },
  creadoEn: new Date('2026-10-19T14:37:12.345Z'),
  extensiones: 1,
  ...cambios,
});

const ESTADOS_FINALES = ['RESUELTO', 'CADUCADO', 'RECHAZADO'];

export class ReportesFalsos implements ConsultaDeReportesFinalizados {
  readonly reportes = new Map<string, ReporteFinalizado>();

  poner(...reportes: ReporteFinalizado[]): void {
    for (const r of reportes) this.reportes.set(r.idReporte, r);
  }

  buscar(id: string): Promise<ReporteFinalizado | null> {
    return Promise.resolve(this.reportes.get(id) ?? null);
  }

  idsFinalizados(despuesDe: string | null, limite: number): Promise<readonly string[]> {
    return Promise.resolve(
      [...this.reportes.values()]
        .filter((r) => ESTADOS_FINALES.includes(r.estado))
        .map((r) => r.idReporte)
        .sort()
        .filter((id) => despuesDe === null || id > despuesDe)
        .slice(0, limite),
    );
  }
}

export class DatosEnMemoria implements RepositorioDeDatosAbiertos {
  readonly filas = new Map<string, DatoAbierto>();

  guardar(dato: DatoAbierto): Promise<boolean> {
    if (this.filas.has(dato.huella)) return Promise.resolve(false);
    this.filas.set(dato.huella, dato);
    return Promise.resolve(true);
  }

  listar(): Promise<readonly FilaPublica[]> {
    return Promise.resolve(
      [...this.filas.values()].map((dato) => ({
        codigoCategoria: dato.codigoCategoria,
        celda: dato.celda,
        hora: dato.hora,
        estadoFinal: dato.estadoFinal,
        fueConfirmado: dato.fueConfirmado,
      })),
    );
  }

  resumir(): Promise<Resumen> {
    return Promise.reject(new Error('no se usa en estas pruebas'));
  }
}
