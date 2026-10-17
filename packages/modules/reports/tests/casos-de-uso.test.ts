import { crearEvento, rechazoDeModeracionV1, votoEmitidoV1 } from '@gis/contracts';
import { idReporte, idUsuario, PuntoGeo } from '@gis/shared-kernel';
import { desplazar, GeneradorDeIdSecuencial, RelojFijo } from '@gis/testing';
import { describe, expect, it } from 'vitest';
import { AplicarDecisionDeVerificacion } from '../application/aplicar-decision-de-verificacion.js';
import { AplicarRechazoDeModeracion } from '../application/aplicar-rechazo-de-moderacion.js';
import { CaducarReportes, LOTE_DE_CADUCIDAD } from '../application/caducar-reportes.js';
import { ListarReportesEnVentana } from '../application/listar-reportes-en-ventana.js';
import { CATEGORIAS_MVP } from '../domain/category.js';
import { Reporte } from '../domain/report.js';
import type { EstadoReporte } from '../domain/report.js';
import { RepositorioReportesEnMemoria, UnidadDeTrabajoEnMemoria } from './dobles.js';

const AUTOR = idUsuario('11111111-1111-4111-8111-111111111111');
const VOTANTE = '22222222-2222-4222-8222-222222222222';
const laPaz = PuntoGeo.crear(-16.5, -68.15);
const ventana = {
  latitudMin: -16.51,
  latitudMax: -16.49,
  longitudMin: -68.16,
  longitudMax: -68.14,
};

function escenario() {
  const reportes = new RepositorioReportesEnMemoria();
  const unidadDeTrabajo = new UnidadDeTrabajoEnMemoria(reportes);
  const reloj = new RelojFijo();
  const ids = new GeneradorDeIdSecuencial('eeeeeeee');
  const deps = { reportes, unidadDeTrabajo, reloj, ids };

  let n = 0;
  /** Guarda un reporte creado `haceMinutos` antes de la hora del reloj, en el estado pedido. */
  const sembrar = async (
    codigo: string,
    haceMinutos = 0,
    estado: EstadoReporte = 'ACTIVO',
    punto = laPaz,
  ): Promise<Reporte> => {
    n += 1;
    const creado = new Date(reloj.ahora().getTime() - haceMinutos * 60_000);
    const reporte = Reporte.crear({
      id: idReporte(`aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`),
      categoria: CATEGORIAS_MVP.find((c) => c.codigo === codigo)!,
      authorId: AUTOR,
      location: punto,
      idempotencyKey: `semilla-${String(n).padStart(4, '0')}`,
      ahora: creado,
    });
    if (estado === 'CONFIRMADO') reporte.marcarConfirmado(creado);
    if (estado === 'RESUELTO') reporte.marcarResuelto(creado);
    if (estado === 'RECHAZADO') reporte.rechazar('MODERACION', creado);
    reporte.extraerEventos();
    await reportes.guardar(reporte);
    return reporte;
  };
  return { reportes, unidadDeTrabajo, reloj, ids, deps, sembrar };
}

describe('ListarReportesEnVentana', () => {
  it('HU-02: solo devuelve los reportes ACTIVO o CONFIRMADO dentro de la ventana', async () => {
    const { deps, reloj, sembrar } = escenario();
    const activo = await sembrar('bloqueo');
    const confirmado = await sembrar('infraestructura', 10, 'CONFIRMADO');
    await sembrar('accidente', 10, 'RESUELTO');
    await sembrar('jauria', 10, 'RECHAZADO');
    await sembrar('bloqueo', 0, 'ACTIVO', desplazar(laPaz, 5000, 0));

    const visibles = await new ListarReportesEnVentana(deps.reportes, reloj).ejecutar(ventana);

    expect(visibles.map((r) => r.id)).toEqual([activo.id, confirmado.id]);
  });

  it('HU-02: no muestra un reporte vencido que la tarea de caducidad aún no procesó', async () => {
    const { deps, reloj, sembrar } = escenario();
    await sembrar('accidente', 181);
    const vigente = await sembrar('accidente', 179, 'ACTIVO', desplazar(laPaz, 200, 0));

    const visibles = await new ListarReportesEnVentana(deps.reportes, reloj).ejecutar(ventana);

    expect(visibles.map((r) => r.id)).toEqual([vigente.id]);
  });

  it('HU-02: un robo se muestra en el centro de su celda, sin ubicación real ni autor', async () => {
    const { deps, reloj, sembrar } = escenario();
    await sembrar('robo');

    const [robo] = await new ListarReportesEnVentana(deps.reportes, reloj).ejecutar(ventana);

    expect(robo!.publicLocation.esIgualA(laPaz)).toBe(false);
    expect(robo).not.toHaveProperty('location');
    expect(robo).not.toHaveProperty('authorId');
  });

  it('filtra por categorías', async () => {
    const { deps, reloj, sembrar } = escenario();
    await sembrar('bloqueo');
    const accidente = await sembrar('accidente', 0, 'ACTIVO', desplazar(laPaz, 300, 0));

    const visibles = await new ListarReportesEnVentana(deps.reportes, reloj).ejecutar({
      ...ventana,
      categorias: ['accidente'],
    });

    expect(visibles.map((r) => r.id)).toEqual([accidente.id]);
  });

  it('rechaza una ventana invertida', async () => {
    const { deps, reloj } = escenario();
    const invertida = {
      ...ventana,
      latitudMin: ventana.latitudMax,
      latitudMax: ventana.latitudMin,
    };

    await expect(
      new ListarReportesEnVentana(deps.reportes, reloj).ejecutar(invertida),
    ).rejects.toMatchObject({ tipo: 'VALIDACION_FALLIDA' });
  });
});

describe('CaducarReportes', () => {
  it('HU-04: un accidente de hace 181 minutos pasa a CADUCADO y emite ReporteCaducado.v1', async () => {
    const { deps, reportes, unidadDeTrabajo, sembrar } = escenario();
    const viejo = await sembrar('accidente', 181);

    const resultado = await new CaducarReportes(deps).ejecutar();

    expect(resultado).toEqual({ caducados: 1 });
    expect((await reportes.buscarPorId(viejo.id))?.estado).toBe('CADUCADO');
    expect(unidadDeTrabajo.eventos).toMatchObject([
      { tipo: 'ReporteCaducado', version: 1, contenido: { idReporte: viejo.id } },
    ]);
  });

  it('HU-04: un accidente de hace 179 minutos conserva su estado', async () => {
    const { deps, reportes, sembrar } = escenario();
    const reciente = await sembrar('accidente', 179);

    expect(await new CaducarReportes(deps).ejecutar()).toEqual({ caducados: 0 });
    expect((await reportes.buscarPorId(reciente.id))?.estado).toBe('ACTIVO');
  });

  it('HU-04: un reporte CONFIRMADO también caduca cuando su caducidad extendida pasa', async () => {
    const { deps, reportes, sembrar } = escenario();
    // Accidente: 180 min + 90 min de la primera extensión.
    const confirmado = await sembrar('accidente', 271, 'CONFIRMADO');
    const aunVigente = await sembrar('accidente', 269, 'CONFIRMADO', desplazar(laPaz, 500, 0));

    await new CaducarReportes(deps).ejecutar();

    expect((await reportes.buscarPorId(confirmado.id))?.estado).toBe('CADUCADO');
    expect((await reportes.buscarPorId(aunVigente.id))?.estado).toBe('CONFIRMADO');
  });

  it('procesa en lotes hasta agotar los vencidos', async () => {
    const { deps, sembrar } = escenario();
    const cantidad = LOTE_DE_CADUCIDAD.tamano + 5;
    for (let i = 0; i < cantidad; i += 1) await sembrar('jauria', 200);

    expect(await new CaducarReportes(deps).ejecutar()).toEqual({ caducados: cantidad });
  });
});

describe('AplicarDecisionDeVerificacion', () => {
  const votoEmitido = (id: string, decision: 'NINGUNA' | 'CONFIRMAR' | 'EXTENDER' | 'RESOLVER') =>
    crearEvento(
      votoEmitidoV1,
      { idReporte: id, idVotante: VOTANTE, valor: 'CONFIRMACION', peso: 1, decision },
      { id: '00000000-0000-4000-8000-0000000000aa', ocurridoEn: new Date() },
    );

  it('HU-03: CONFIRMAR pasa el reporte a CONFIRMADO, extiende 90 minutos y emite el evento', async () => {
    const { deps, reportes, unidadDeTrabajo, sembrar } = escenario();
    const accidente = await sembrar('accidente');

    await new AplicarDecisionDeVerificacion(deps).manejar(votoEmitido(accidente.id, 'CONFIRMAR'));

    const despues = await reportes.buscarPorId(accidente.id);
    expect(despues?.estado).toBe('CONFIRMADO');
    expect(despues!.caducaEn.getTime() - accidente.caducaEn.getTime()).toBe(90 * 60_000);
    expect(unidadDeTrabajo.tipos()).toEqual(['ReporteConfirmado']);
  });

  it('HU-03: EXTENDER aplica la segunda extensión y emite ReporteExtendido', async () => {
    const { deps, reportes, unidadDeTrabajo, sembrar } = escenario();
    const confirmado = await sembrar('accidente', 0, 'CONFIRMADO');

    await new AplicarDecisionDeVerificacion(deps).manejar(votoEmitido(confirmado.id, 'EXTENDER'));

    expect((await reportes.buscarPorId(confirmado.id))?.extensiones).toBe(2);
    expect(unidadDeTrabajo.tipos()).toEqual(['ReporteExtendido']);
  });

  it('HU-03: RESOLVER pasa el reporte a RESUELTO', async () => {
    const { deps, reportes, unidadDeTrabajo, sembrar } = escenario();
    const activo = await sembrar('bloqueo');

    await new AplicarDecisionDeVerificacion(deps).manejar(votoEmitido(activo.id, 'RESOLVER'));

    expect((await reportes.buscarPorId(activo.id))?.estado).toBe('RESUELTO');
    expect(unidadDeTrabajo.tipos()).toEqual(['ReporteResuelto']);
  });

  it('es idempotente: NINGUNA, una transición ya aplicada o un reporte inexistente no hacen nada', async () => {
    const { deps, unidadDeTrabajo, sembrar } = escenario();
    const resuelto = await sembrar('bloqueo', 0, 'RESUELTO');
    const manejador = new AplicarDecisionDeVerificacion(deps);

    await manejador.manejar(votoEmitido(resuelto.id, 'NINGUNA'));
    await manejador.manejar(votoEmitido(resuelto.id, 'CONFIRMAR'));
    await manejador.manejar(votoEmitido('aaaaaaaa-aaaa-4aaa-8aaa-ffffffffffff', 'CONFIRMAR'));

    expect(unidadDeTrabajo.eventos).toEqual([]);
  });

  it('una tercera extensión no se aplica', async () => {
    const { deps, unidadDeTrabajo, sembrar } = escenario();
    const confirmado = await sembrar('accidente', 0, 'CONFIRMADO');
    const manejador = new AplicarDecisionDeVerificacion(deps);

    await manejador.manejar(votoEmitido(confirmado.id, 'EXTENDER'));
    await manejador.manejar(votoEmitido(confirmado.id, 'EXTENDER'));

    expect(unidadDeTrabajo.tipos()).toEqual(['ReporteExtendido']);
  });
});

describe('AplicarRechazoDeModeracion', () => {
  const rechazo = (id: string) =>
    crearEvento(
      rechazoDeModeracionV1,
      { idReporte: id, idModerador: VOTANTE },
      { id: '00000000-0000-4000-8000-0000000000bb', ocurridoEn: new Date() },
    );

  it('HU-12: rechaza el reporte por moderación y emite ReporteRechazado.v1', async () => {
    const { deps, reportes, unidadDeTrabajo, sembrar } = escenario();
    const activo = await sembrar('bloqueo');

    await new AplicarRechazoDeModeracion(deps).manejar(rechazo(activo.id));

    expect(await reportes.buscarPorId(activo.id)).toMatchObject({
      estado: 'RECHAZADO',
      motivoRechazo: 'MODERACION',
    });
    expect(unidadDeTrabajo.eventos).toMatchObject([
      { tipo: 'ReporteRechazado', contenido: { idReporte: activo.id, motivo: 'MODERACION' } },
    ]);
  });

  it('no hace nada si el reporte ya no está vigente', async () => {
    const { deps, unidadDeTrabajo, sembrar } = escenario();
    const caducado = await sembrar('bloqueo', 0, 'RESUELTO');

    await new AplicarRechazoDeModeracion(deps).manejar(rechazo(caducado.id));

    expect(unidadDeTrabajo.eventos).toEqual([]);
  });

  it('rechaza un evento de otro tipo', async () => {
    const { deps } = escenario();
    const otro = crearEvento(
      votoEmitidoV1,
      {
        idReporte: VOTANTE,
        idVotante: VOTANTE,
        valor: 'NEGACION',
        peso: 1,
        decision: 'NINGUNA',
      },
      { id: '00000000-0000-4000-8000-0000000000cc', ocurridoEn: new Date() },
    );

    await expect(new AplicarRechazoDeModeracion(deps).manejar(otro)).rejects.toThrow(
      /Se esperaba RechazoDeModeracion.v1/,
    );
  });
});
