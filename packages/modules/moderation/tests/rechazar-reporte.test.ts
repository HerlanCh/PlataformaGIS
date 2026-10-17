import type { EventoDeIntegracion } from '@gis/contracts';
import { idReporte, idUsuario } from '@gis/shared-kernel';
import type { IdReporte } from '@gis/shared-kernel';
import { GeneradorDeIdSecuencial, RelojFijo } from '@gis/testing';
import { describe, expect, it } from 'vitest';
import type { UnidadDeTrabajoDeModeracion } from '../application/ports.js';
import { RechazarReporte } from '../application/rechazar-reporte.js';
import { AccionDeModeracion } from '../domain/accion-de-moderacion.js';
import type { IdAccionDeModeracion } from '../domain/accion-de-moderacion.js';
import type { EstadoDeReporte } from '../domain/ports.js';

const REPORTE = idReporte('6f1c2f0e-3b7a-4d2a-9c58-0a4f5b1d2e3f');
const MODERADOR = idUsuario('11111111-1111-4111-8111-111111111111');

class UnidadEnMemoria implements UnidadDeTrabajoDeModeracion {
  readonly acciones: AccionDeModeracion[] = [];
  readonly eventos: EventoDeIntegracion[] = [];

  registrar(accion: AccionDeModeracion, eventos: readonly EventoDeIntegracion[]): Promise<void> {
    this.acciones.push(accion);
    this.eventos.push(...eventos);
    return Promise.resolve();
  }
}

function escenario(estado: EstadoDeReporte | null = 'ACTIVO') {
  const estados = new Map<IdReporte, EstadoDeReporte>();
  if (estado) estados.set(REPORTE, estado);
  const unidadDeTrabajo = new UnidadEnMemoria();
  const deps = {
    consultaDeReporte: { estadoDe: (id: IdReporte) => Promise.resolve(estados.get(id) ?? null) },
    unidadDeTrabajo,
    reloj: new RelojFijo(),
    ids: new GeneradorDeIdSecuencial(),
  };
  return { unidadDeTrabajo, rechazar: new RechazarReporte(deps) };
}

const entrada = (cambios: Record<string, unknown> = {}) => ({
  idReporte: REPORTE,
  idModerador: MODERADOR,
  rolActor: 'MODERADOR' as const,
  motivo: '  Reporte falso  ',
  ...cambios,
});

describe('RechazarReporte', () => {
  it('HU-12: un moderador rechaza un reporte vigente: queda la auditoría y RechazoDeModeracion.v1', async () => {
    const { rechazar, unidadDeTrabajo } = escenario('CONFIRMADO');

    await rechazar.ejecutar(entrada());

    expect(unidadDeTrabajo.acciones).toMatchObject([
      { idReporte: REPORTE, idModerador: MODERADOR, accion: 'RECHAZAR', motivo: 'Reporte falso' },
    ]);
    expect(unidadDeTrabajo.eventos).toMatchObject([
      {
        tipo: 'RechazoDeModeracion',
        version: 1,
        contenido: { idReporte: REPORTE, idModerador: MODERADOR },
      },
    ]);
  });

  it('HU-12: un usuario sin rol MODERADOR no puede rechazar', async () => {
    const { rechazar, unidadDeTrabajo } = escenario();

    await expect(rechazar.ejecutar(entrada({ rolActor: 'CIUDADANO' }))).rejects.toMatchObject({
      tipo: 'PROHIBIDO',
      codigo: 'ROL_INSUFICIENTE',
    });
    expect(unidadDeTrabajo.acciones).toEqual([]);
  });

  it('el motivo es obligatorio', async () => {
    const { rechazar } = escenario();

    await expect(rechazar.ejecutar(entrada({ motivo: '   ' }))).rejects.toMatchObject({
      tipo: 'VALIDACION_FALLIDA',
      codigo: 'MOTIVO_OBLIGATORIO',
    });
  });

  it('un reporte inexistente da NO_ENCONTRADO', async () => {
    const { rechazar } = escenario(null);

    await expect(rechazar.ejecutar(entrada())).rejects.toMatchObject({ tipo: 'NO_ENCONTRADO' });
  });

  it.each(['RESUELTO', 'CADUCADO', 'RECHAZADO'] as const)(
    'un reporte %s ya no se puede rechazar',
    async (estado) => {
      const { rechazar } = escenario(estado);

      await expect(rechazar.ejecutar(entrada())).rejects.toMatchObject({
        tipo: 'CONFLICTO',
        codigo: 'REPORTE_NO_VIGENTE',
      });
    },
  );

  it('una acción restaurada conserva sus datos', () => {
    const props = {
      id: '00000000-0000-4000-8000-000000000009' as IdAccionDeModeracion,
      idReporte: REPORTE,
      idModerador: MODERADOR,
      accion: 'MANTENER' as const,
      motivo: null,
      creadoEn: new Date('2026-10-12T12:00:00Z'),
    };

    expect(AccionDeModeracion.restaurar(props)).toMatchObject(props);
  });
});
