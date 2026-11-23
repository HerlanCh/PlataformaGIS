import { validarEntrada } from '@gis/contracts';
import type { Reloj } from '@gis/shared-kernel';
import { z } from 'zod';
import type {
  Azar,
  RepositorioDeEvaluacion,
  RepositorioDeVerificaciones,
} from '../domain/ports.js';
import { MAX_DETALLE_DE_FUENTE, sortear } from '../domain/verificacion.js';
import type { Sorteo, Verificacion } from '../domain/verificacion.js';
import {
  esquemaInstante,
  esquemaPeriodo,
  esquemaRol,
  exigirModerador,
  exigirPasado,
} from './entradas.js';

const esquemaSorteo = z.object({ rolActor: esquemaRol, periodo: esquemaPeriodo });

/**
 * El sorteo semanal del protocolo: por categoría, hasta 5 alertas confirmadas y 5 reportes no
 * confirmados del periodo, al azar, para verificarlos en campo o con fuentes secundarias.
 */
export class SortearReportes {
  constructor(
    private readonly registro: RepositorioDeEvaluacion,
    private readonly azar: Azar,
  ) {}

  async ejecutar(entrada: z.input<typeof esquemaSorteo>): Promise<Sorteo> {
    const { rolActor, periodo } = validarEntrada(esquemaSorteo, entrada);
    exigirModerador(rolActor);
    const reportes = await this.registro.buscarReportesVerificables(periodo.desde, periodo.hasta);
    return sortear(reportes, this.azar);
  }
}

const esquemaRegistrar = z
  .object({
    rolActor: esquemaRol,
    idReporte: z.uuid(),
    resultado: z.enum(['REAL', 'FALSO', 'NO_VERIFICABLE']),
    finEn: esquemaInstante.nullable(),
    fuente: z.enum(['CAMPO', 'SECUNDARIA']),
    detalleFuente: z.string().trim().max(MAX_DETALLE_DE_FUENTE).nullable(),
  })
  .refine((v) => v.resultado === 'REAL' || v.finEn === null, {
    message: 'Solo un incidente real tiene hora de fin',
    path: ['finEn'],
  });

export type EntradaRegistrarVerificacion = z.input<typeof esquemaRegistrar>;

/** Registra (o corrige) si un reporte fue real, falso o no verificable, su hora de fin y la fuente. */
export class RegistrarVerificacion {
  constructor(
    private readonly verificaciones: RepositorioDeVerificaciones,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(entrada: EntradaRegistrarVerificacion): Promise<Verificacion> {
    const { rolActor, ...datos } = validarEntrada(esquemaRegistrar, entrada);
    exigirModerador(rolActor);
    const ahora = this.reloj.ahora();
    if (datos.finEn) exigirPasado(datos.finEn, ahora);
    const verificacion: Verificacion = {
      ...datos,
      detalleFuente: datos.detalleFuente || null,
      registradaEn: ahora,
    };
    await this.verificaciones.guardar(verificacion);
    return verificacion;
  }
}

const esquemaListar = z.object({ rolActor: esquemaRol });

export class ListarVerificaciones {
  constructor(private readonly verificaciones: RepositorioDeVerificaciones) {}

  async ejecutar(entrada: z.input<typeof esquemaListar>): Promise<readonly Verificacion[]> {
    exigirModerador(validarEntrada(esquemaListar, entrada).rolActor);
    return this.verificaciones.listar();
  }
}
