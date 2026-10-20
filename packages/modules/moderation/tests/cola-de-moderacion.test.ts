import {
  crearEvento,
  reporteCaducadoV1,
  reporteClasificadoV1,
  reporteRechazadoV1,
  votoEmitidoV1,
} from '@gis/contracts';
import { idReporte, idUsuario } from '@gis/shared-kernel';
import type { IdReporte } from '@gis/shared-kernel';
import { GeneradorDeIdSecuencial, RelojFijo } from '@gis/testing';
import { describe, expect, it } from 'vitest';
import { ActualizarColaDeModeracion } from '../application/actualizar-cola-de-moderacion.js';
import { ListarColaDeModeracion } from '../application/listar-cola-de-moderacion.js';
import { MantenerReporte } from '../application/mantener-reporte.js';
import { CasoDeModeracion } from '../domain/caso-de-moderacion.js';
import { ColaEnMemoria, ReportesFalsos, UnidadEnMemoria } from './dobles.js';

const reporte = (n: number) => idReporte(`6f1c2f0e-3b7a-4d2a-9c58-${String(n).padStart(12, '0')}`);
const MODERADOR = idUsuario('11111111-1111-4111-8111-111111111111');
const VOTANTE = '22222222-2222-4222-8222-222222222222';
const base = new Date('2026-10-19T12:00:00.000Z');
const minuto = (n: number) => new Date(base.getTime() + n * 60_000);

let n = 0;
const sobre = (minutos = 0) => ({
  id: `eeeeeeee-0000-4000-8000-${String((n += 1)).padStart(12, '0')}`,
  ocurridoEn: minuto(minutos),
});
const negacion = (id: IdReporte, minutos = 0) =>
  crearEvento(
    votoEmitidoV1,
    { idReporte: id, idVotante: VOTANTE, valor: 'NEGACION', peso: 1, decision: 'NINGUNA' },
    sobre(minutos),
  );
const confirmacion = (id: IdReporte) =>
  crearEvento(
    votoEmitidoV1,
    { idReporte: id, idVotante: VOTANTE, valor: 'CONFIRMACION', peso: 1, decision: 'NINGUNA' },
    sobre(),
  );
const clasificado = (id: IdReporte, sospechoso: boolean, motivos: string[], minutos = 0) =>
  crearEvento(
    reporteClasificadoV1,
    {
      idReporte: id,
      sospechoso,
      motivos: motivos as ('ENLACE' | 'SPAM')[],
      clasificador: 'reglas-v1',
    },
    sobre(minutos),
  );

function escenario() {
  const cola = new ColaEnMemoria();
  const reportes = new ReportesFalsos();
  const unidadDeTrabajo = new UnidadEnMemoria(cola);
  return {
    cola,
    reportes,
    unidadDeTrabajo,
    actualizar: new ActualizarColaDeModeracion(cola),
    listar: new ListarColaDeModeracion(cola, reportes),
    mantener: new MantenerReporte({
      consultaDeReporte: reportes,
      unidadDeTrabajo,
      reloj: new RelojFijo(minuto(30)),
      ids: new GeneradorDeIdSecuencial('aaaaaaaa'),
    }),
  };
}

describe('CasoDeModeracion', () => {
  it('HU-12: entra a la cola con una negación o una marca, y no sin ellas', () => {
    const caso = CasoDeModeracion.abrir(reporte(1), base);
    expect(caso.estaPendiente).toBe(false);

    caso.registrarNegacion(minuto(1));
    expect(caso).toMatchObject({ negaciones: 1, estaPendiente: true, actualizadoEn: minuto(1) });
  });

  it('suma los motivos sin repetirlos y resolver conserva la primera fecha', () => {
    const caso = CasoDeModeracion.abrir(reporte(1), base);
    caso.marcar(['ENLACE'], base);
    caso.marcar(['ENLACE', 'SPAM'], minuto(1));
    caso.resolver(minuto(2));
    caso.resolver(minuto(3));

    expect(caso).toMatchObject({
      marcado: true,
      motivos: ['ENLACE', 'SPAM'],
      resueltoEn: minuto(2),
      estaPendiente: false,
    });
  });
});

describe('ActualizarColaDeModeracion', () => {
  it('HU-12: las negaciones abren el caso y lo suman; las confirmaciones no', async () => {
    const { actualizar, cola } = escenario();

    await actualizar.manejar(negacion(reporte(1)));
    await actualizar.manejar(negacion(reporte(1), 5));
    await actualizar.manejar(confirmacion(reporte(2)));

    expect(await cola.buscar(reporte(1))).toMatchObject({
      negaciones: 2,
      actualizadoEn: minuto(5),
    });
    expect(await cola.buscar(reporte(2))).toBeNull();
  });

  it('HU-10: un reporte marcado por el clasificador entra a la cola con sus motivos', async () => {
    const { actualizar, cola } = escenario();

    await actualizar.manejar(clasificado(reporte(1), true, ['ENLACE', 'SPAM']));
    await actualizar.manejar(clasificado(reporte(2), false, []));

    expect(await cola.buscar(reporte(1))).toMatchObject({
      marcado: true,
      motivos: ['ENLACE', 'SPAM'],
      estaPendiente: true,
    });
    expect(await cola.buscar(reporte(2))).toBeNull();
  });

  it('el rechazo o la caducidad del reporte lo sacan de la cola', async () => {
    const { actualizar, cola } = escenario();
    await actualizar.manejar(negacion(reporte(1)));
    await actualizar.manejar(negacion(reporte(2)));

    await actualizar.manejar(
      crearEvento(reporteRechazadoV1, { idReporte: reporte(1), motivo: 'MODERACION' }, sobre(9)),
    );
    await actualizar.manejar(crearEvento(reporteCaducadoV1, { idReporte: reporte(2) }, sobre(9)));
    await actualizar.manejar(crearEvento(reporteCaducadoV1, { idReporte: reporte(3) }, sobre(9)));

    expect(await cola.buscar(reporte(1))).toMatchObject({ resueltoEn: minuto(9) });
    expect(await cola.buscar(reporte(2))).toMatchObject({ resueltoEn: minuto(9) });
    expect(await cola.buscar(reporte(3))).toBeNull();
  });

  it('escucha los votos, la clasificación y los desenlaces del reporte', () => {
    expect(ActualizarColaDeModeracion.eventos).toEqual([
      'VotoEmitido.v1',
      'ReporteClasificado.v1',
      'ReporteRechazado.v1',
      'ReporteResuelto.v1',
      'ReporteCaducado.v1',
    ]);
  });
});

describe('ListarColaDeModeracion', () => {
  it('HU-10 y HU-12: primero lo marcado, después lo más negado, con la descripción privada', async () => {
    const { actualizar, listar, reportes } = escenario();
    for (const [i, estado] of (['ACTIVO', 'CONFIRMADO', 'ACTIVO', 'RESUELTO'] as const).entries()) {
      reportes.poner(reporte(i + 1), estado, i === 2 ? 'promo en https://x.com' : null);
    }
    await actualizar.manejar(negacion(reporte(1)));
    await actualizar.manejar(negacion(reporte(2)));
    await actualizar.manejar(negacion(reporte(2)));
    await actualizar.manejar(clasificado(reporte(3), true, ['ENLACE', 'SPAM']));
    // Resuelto, pero su desenlace aún no llegó a la cola: no se muestra.
    await actualizar.manejar(negacion(reporte(4)));

    const cola = await listar.ejecutar({ rolActor: 'MODERADOR' });

    expect(cola.map((c) => c.idReporte)).toEqual([reporte(3), reporte(2), reporte(1)]);
    expect(cola[0]).toMatchObject({
      marcado: true,
      motivos: ['ENLACE', 'SPAM'],
      descripcion: 'promo en https://x.com',
      publicLocation: { latitud: -16.5, longitud: -68.15 },
    });
    expect(cola[1]).toMatchObject({ negaciones: 2, marcado: false, estado: 'CONFIRMADO' });
  });

  it('HU-12: sin rol MODERADOR se deniega', async () => {
    const { listar } = escenario();

    await expect(listar.ejecutar({ rolActor: 'CIUDADANO' })).rejects.toMatchObject({
      tipo: 'PROHIBIDO',
      codigo: 'ROL_INSUFICIENTE',
    });
  });
});

describe('MantenerReporte', () => {
  const entrada = (cambios: Record<string, unknown> = {}) => ({
    idReporte: reporte(1),
    idModerador: MODERADOR,
    rolActor: 'MODERADOR' as const,
    ...cambios,
  });

  it('HU-12: deja el reporte publicado, lo audita sin evento y lo saca de la cola', async () => {
    const { actualizar, mantener, reportes, cola, unidadDeTrabajo } = escenario();
    reportes.poner(reporte(1), 'ACTIVO');
    await actualizar.manejar(negacion(reporte(1)));

    await mantener.ejecutar(entrada({ motivo: '  Verificado con la foto de un vecino  ' }));

    expect(unidadDeTrabajo.acciones).toMatchObject([
      {
        idReporte: reporte(1),
        idModerador: MODERADOR,
        accion: 'MANTENER',
        motivo: 'Verificado con la foto de un vecino',
      },
    ]);
    expect(unidadDeTrabajo.eventos).toEqual([]);
    expect(await cola.listarPendientes(10)).toEqual([]);
  });

  it('HU-12: una negación posterior lo devuelve a la cola', async () => {
    const { actualizar, mantener, reportes, cola } = escenario();
    reportes.poner(reporte(1), 'ACTIVO');
    await actualizar.manejar(negacion(reporte(1)));
    await mantener.ejecutar(entrada());

    await actualizar.manejar(negacion(reporte(1), 40));

    expect(await cola.listarPendientes(10)).toMatchObject([{ negaciones: 2 }]);
  });

  it('el motivo es opcional; vacío se guarda como nulo', async () => {
    const { mantener, reportes, unidadDeTrabajo } = escenario();
    reportes.poner(reporte(1), 'CONFIRMADO');

    await mantener.ejecutar(entrada({ motivo: '   ' }));

    expect(unidadDeTrabajo.acciones[0]?.motivo).toBeNull();
  });

  it.each([
    ['sin rol MODERADOR', 'ACTIVO', { rolActor: 'CIUDADANO' }, 'PROHIBIDO'],
    ['con el reporte resuelto', 'RESUELTO', {}, 'CONFLICTO'],
    ['con un reporte inexistente', null, {}, 'NO_ENCONTRADO'],
  ] as const)('HU-12: %s se deniega', async (_caso, estado, cambios, tipo) => {
    const { mantener, reportes, unidadDeTrabajo } = escenario();
    if (estado) reportes.poner(reporte(1), estado);

    await expect(mantener.ejecutar(entrada(cambios))).rejects.toMatchObject({ tipo });
    expect(unidadDeTrabajo.acciones).toEqual([]);
  });
});
