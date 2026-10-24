import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  CLAVES_REPORTE_CREADO,
  eventosDeIntegracion,
  leerReporteCreado,
  reporteCreadoV1,
  reporteCreadoV2,
  reporteDuplicadoDetectadoV1,
  rechazoDeModeracionV1,
  reporteRechazadoV1,
  votoEmitidoV1,
} from './index.js';

const ID = '6f1c2f0e-3b7a-4d2a-9c58-0a4f5b1d2e3f';
const sobre = { id: ID, ocurridoEn: '2026-10-11T12:00:00Z' };

/** Nombres de todos los campos de un esquema, incluidos los anidados. */
function campos(esquema: z.ZodType): string[] {
  if (!(esquema instanceof z.ZodObject)) return [];
  return Object.entries(esquema.shape as Record<string, z.ZodType>).flatMap(([nombre, hijo]) => [
    nombre,
    ...campos(hijo),
  ]);
}

describe('catálogo de eventos de integración', () => {
  it('contiene los eventos de las Fases 2, 5, 10 y 13 con clave única', () => {
    const claves = eventosDeIntegracion.map((evento) => evento.clave);

    expect(claves).toEqual([
      'ReporteCreado.v1',
      'ReporteConfirmado.v1',
      'ReporteExtendido.v1',
      'ReporteResuelto.v1',
      'ReporteCaducado.v1',
      'ReporteRechazado.v1',
      'ReporteDuplicadoDetectado.v1',
      'VotoEmitido.v1',
      'RechazoDeModeracion.v1',
      'DescripcionAgregada.v1',
      'ReporteClasificado.v1',
      'ReporteCreado.v2',
    ]);
    expect(new Set(claves).size).toBe(claves.length);
  });

  it('RNF-14: ningún evento público lleva ubicación real, autor, otro usuario ni descripción', () => {
    const prohibidos = [
      'location',
      'authorId',
      'idReportante',
      'idVotante',
      'ubicacionReportante',
      'descripcion',
    ];
    const publicos = eventosDeIntegracion.filter((evento) => evento.audiencia === 'publico');

    expect(publicos.length).toBeGreaterThan(0);
    for (const evento of publicos) {
      const presentes = campos(evento.contenido);
      expect(presentes.filter((campo) => prohibidos.includes(campo))).toEqual([]);
    }
  });

  it('los eventos que identifican a un usuario son internos', () => {
    expect(reporteDuplicadoDetectadoV1.audiencia).toBe('interno');
    expect(votoEmitidoV1.audiencia).toBe('interno');
    expect(rechazoDeModeracionV1.audiencia).toBe('interno');
  });
});

describe('contratos', () => {
  const creado = {
    ...sobre,
    tipo: 'ReporteCreado',
    version: 1,
    contenido: {
      idReporte: ID,
      codigoCategoria: 'bloqueo',
      publicLocation: { latitud: -16.5, longitud: -68.15 },
      estado: 'ACTIVO',
      creadoEn: '2026-10-11T12:00:00Z',
      caducaEn: '2026-10-11T18:00:00Z',
    },
  };

  it('ReporteCreado.v1 acepta un evento válido', () => {
    expect(reporteCreadoV1.esquema.parse(creado)).toEqual(creado);
  });

  it('ReporteCreado.v1 descarta un campo que no está en el contrato', () => {
    const conAutor = { ...creado, contenido: { ...creado.contenido, authorId: ID } };

    expect(reporteCreadoV1.esquema.parse(conAutor).contenido).not.toHaveProperty('authorId');
  });

  it('ReporteCreado.v1 rechaza un estado desconocido', () => {
    const invalido = { ...creado, contenido: { ...creado.contenido, estado: 'BORRADO' } };

    expect(reporteCreadoV1.esquema.safeParse(invalido).success).toBe(false);
  });

  it('ReporteRechazado.v1 solo admite motivos del catálogo', () => {
    const rechazado = (motivo: string) => ({
      ...sobre,
      tipo: 'ReporteRechazado',
      version: 1,
      contenido: { idReporte: ID, motivo },
    });

    expect(reporteRechazadoV1.esquema.safeParse(rechazado('MODERACION')).success).toBe(true);
    expect(reporteRechazadoV1.esquema.safeParse(rechazado('AUTOR_SILENCIADO')).success).toBe(true);
    expect(reporteRechazadoV1.esquema.safeParse(rechazado('porque sí')).success).toBe(false);
  });

  it('VotoEmitido.v1 lleva la decisión de verificación y limita el peso al rango de reputación', () => {
    const voto = (peso: number, decision: string) => ({
      ...sobre,
      tipo: 'VotoEmitido',
      version: 1,
      contenido: { idReporte: ID, idVotante: ID, valor: 'CONFIRMACION', peso, decision },
    });

    expect(votoEmitidoV1.esquema.safeParse(voto(1, 'CONFIRMAR')).success).toBe(true);
    expect(votoEmitidoV1.esquema.safeParse(voto(5.1, 'NINGUNA')).success).toBe(false);
    expect(votoEmitidoV1.esquema.safeParse(voto(1, 'BORRAR')).success).toBe(false);
  });

  it('HU-13: ReporteCreado.v2 agrega la fuente oficial, nula en los reportes comunitarios', () => {
    const v2 = (fuenteOficial: unknown) => ({
      ...creado,
      version: 2,
      contenido: { ...creado.contenido, fuenteOficial },
    });

    expect(reporteCreadoV2.esquema.safeParse(v2('TRANSITO')).success).toBe(true);
    expect(reporteCreadoV2.esquema.safeParse(v2(null)).success).toBe(true);
    expect(reporteCreadoV2.esquema.safeParse(v2('ALCALDIA')).success).toBe(false);
    expect(reporteCreadoV2.esquema.safeParse(creado).success).toBe(false);
  });
});

describe('leerReporteCreado', () => {
  const contenido = {
    idReporte: ID,
    codigoCategoria: 'bloqueo',
    publicLocation: { latitud: -16.5, longitud: -68.15 },
    estado: 'ACTIVO',
    creadoEn: '2026-10-11T12:00:00Z',
    caducaEn: '2026-10-11T18:00:00Z',
  };

  it('HU-13: un v1 pendiente del outbox se lee como reporte comunitario', () => {
    const v1 = { ...sobre, tipo: 'ReporteCreado', version: 1, contenido };

    expect(leerReporteCreado(v1)).toEqual({ ...contenido, fuenteOficial: null });
  });

  it('HU-13: un v2 conserva su fuente', () => {
    const v2 = {
      ...sobre,
      tipo: 'ReporteCreado',
      version: 2,
      contenido: { ...contenido, fuenteOficial: 'ABC' },
    };

    expect(leerReporteCreado(v2).fuenteOficial).toBe('ABC');
  });

  it('rechaza otro evento', () => {
    const otro = { ...sobre, tipo: 'ReporteCaducado', version: 1, contenido: { idReporte: ID } };

    expect(() => leerReporteCreado(otro)).toThrow(/ReporteCreado/);
  });

  it('los manejadores se suscriben a las dos versiones', () => {
    expect(CLAVES_REPORTE_CREADO).toEqual(['ReporteCreado.v1', 'ReporteCreado.v2']);
  });
});
