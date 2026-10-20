import type { DatoAbierto, ReporteFinalizado } from './dato-abierto.js';

/**
 * Puerto propio hacia `reports`: los reportes terminados. La raíz de composición lo conecta con
 * la interfaz pública de ese módulo (ADR-001 y ADR-005): `open-data` nunca lee sus tablas.
 */
export interface ConsultaDeReportesFinalizados {
  /** `null` si el reporte no existe. */
  buscar(idReporte: string): Promise<ReporteFinalizado | null>;
  /** IDs de reportes en estado final, en orden, después de `despuesDe` (`null`: desde el inicio). */
  idsFinalizados(despuesDe: string | null, limite: number): Promise<readonly string[]>;
}

/** Fila tal como se publica: sin la huella. */
export type FilaPublica = Omit<DatoAbierto, 'huella'>;

export interface Resumen {
  readonly total: number;
  readonly confirmados: number;
  readonly porCategoria: readonly { readonly codigoCategoria: string; readonly cantidad: number }[];
  /** 24 cuentas, de las 0 a las 23 h en la hora de La Paz. */
  readonly porHoraDelDia: readonly number[];
  readonly desde: Date | null;
  readonly hasta: Date | null;
}

/** Los datos abiertos, que son de este módulo. */
export interface RepositorioDeDatosAbiertos {
  /** Devuelve `false` si ya estaba (misma huella): registrar es idempotente. */
  guardar(dato: DatoAbierto): Promise<boolean>;
  /** Todas las filas, de la más antigua a la más reciente. */
  listar(): Promise<readonly FilaPublica[]>;
  resumir(): Promise<Resumen>;
}
