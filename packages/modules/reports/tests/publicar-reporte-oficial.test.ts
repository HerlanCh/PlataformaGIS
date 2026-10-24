import { ErrorConflicto, idUsuario, PuntoGeo } from '@gis/shared-kernel';
import { GeneradorDeIdSecuencial, LimitadorEnMemoria, RelojFijo } from '@gis/testing';
import { describe, expect, it } from 'vitest';
import { CrearReporte } from '../application/crear-reporte.js';
import { CLAVE_DE_IDEMPOTENCIA_REPETIDA } from '../application/ports.js';
import { PublicarReporteOficial } from '../application/publicar-reporte-oficial.js';
import type { EntradaPublicarReporteOficial } from '../application/publicar-reporte-oficial.js';
import {
  CategoriasEnMemoria,
  RepositorioReportesEnMemoria,
  ReputacionFalsa,
  UnidadDeTrabajoEnMemoria,
} from './dobles.js';

const MODERADORA = idUsuario('33333333-3333-4333-8333-333333333333');
const VECINO = idUsuario('22222222-2222-4222-8222-222222222222');
const laPaz = PuntoGeo.crear(-16.5, -68.15);

function escenario() {
  const reportes = new RepositorioReportesEnMemoria();
  const unidad = new UnidadDeTrabajoEnMemoria(reportes);
  const reloj = new RelojFijo();
  const deps = {
    reportes,
    categorias: new CategoriasEnMemoria(),
    unidadDeTrabajo: unidad,
    reloj,
    ids: new GeneradorDeIdSecuencial(),
  };
  const crearComunitario = new CrearReporte({
    ...deps,
    reputacion: new ReputacionFalsa(),
    limitador: new LimitadorEnMemoria(reloj),
  });
  return { reportes, unidad, publicar: new PublicarReporteOficial(deps), crearComunitario };
}

let clave = 0;
const entrada = (
  cambios: Partial<EntradaPublicarReporteOficial> = {},
): EntradaPublicarReporteOficial => ({
  idModerador: MODERADORA,
  rolActor: 'MODERADOR',
  codigoCategoria: 'bloqueo',
  latitud: laPaz.latitud,
  longitud: laPaz.longitud,
  fuenteOficial: 'TRANSITO',
  idempotencyKey: `oficial-${String((clave += 1)).padStart(6, '0')}`,
  ...cambios,
});

describe('PublicarReporteOficial', () => {
  it('HU-13: crea un reporte ACTIVO con su fuente y emite ReporteCreado.v2', async () => {
    const { publicar, unidad } = escenario();

    const reporte = await publicar.ejecutar(entrada());

    expect(reporte).toMatchObject({ estado: 'ACTIVO', fuenteOficial: 'TRANSITO' });
    expect(unidad.eventos).toHaveLength(1);
    expect(unidad.eventos[0]).toMatchObject({
      tipo: 'ReporteCreado',
      version: 2,
      contenido: { idReporte: reporte.id, fuenteOficial: 'TRANSITO' },
    });
  });

  it('HU-13: un ciudadano no puede publicar incidentes oficiales', async () => {
    const { publicar, reportes } = escenario();

    await expect(publicar.ejecutar(entrada({ rolActor: 'CIUDADANO' }))).rejects.toMatchObject({
      tipo: 'PROHIBIDO',
      codigo: 'ROL_INSUFICIENTE',
    });
    expect(reportes.todos()).toHaveLength(0);
  });

  it('HU-13: se crea aunque haya un reporte comunitario igual cerca', async () => {
    const { publicar, crearComunitario, reportes } = escenario();
    await crearComunitario.ejecutar({
      idAutor: VECINO,
      codigoCategoria: 'bloqueo',
      latitud: laPaz.latitud,
      longitud: laPaz.longitud,
      idempotencyKey: 'vecino-000001',
    });

    await publicar.ejecutar(entrada());

    expect(reportes.todos()).toHaveLength(2);
  });

  it('HU-13: no aplica el límite de 5 reportes en 10 minutos', async () => {
    const { publicar, reportes } = escenario();

    for (let i = 0; i < 8; i += 1) await publicar.ejecutar(entrada());

    expect(reportes.todos()).toHaveLength(8);
  });

  it('HU-05: el reenvío con la misma clave devuelve el mismo reporte sin repetir eventos', async () => {
    const { publicar, unidad } = escenario();
    const primera = entrada();

    const original = await publicar.ejecutar(primera);
    const reenvio = await publicar.ejecutar(primera);

    expect(reenvio).toEqual(original);
    expect(unidad.eventos).toHaveLength(1);
  });

  it('HU-05: si otro envío simultáneo gana la carrera, devuelve el del ganador', async () => {
    const { publicar, unidad, reportes } = escenario();
    const primera = entrada();
    const ganador = await publicar.ejecutar(primera);
    // La primera búsqueda aún no lo ve y la unidad de trabajo choca con la clave repetida.
    const buscar = reportes.buscarPorClaveDeIdempotencia.bind(reportes);
    let consultas = 0;
    reportes.buscarPorClaveDeIdempotencia = (c) =>
      consultas++ === 0 ? Promise.resolve(null) : buscar(c);
    unidad.confirmar = () =>
      Promise.reject(new ErrorConflicto(CLAVE_DE_IDEMPOTENCIA_REPETIDA, 'repetida'));

    expect(await publicar.ejecutar(primera)).toEqual(ganador);
  });

  it('HU-13: rechaza una fuente fuera del catálogo y un punto fuera del área', async () => {
    const { publicar } = escenario();

    await expect(
      publicar.ejecutar(entrada({ fuenteOficial: 'ALCALDIA' as never })),
    ).rejects.toMatchObject({ tipo: 'VALIDACION_FALLIDA' });
    await expect(
      publicar.ejecutar(entrada({ latitud: -17.39, longitud: -66.16 })),
    ).rejects.toMatchObject({ codigo: 'FUERA_DEL_AREA_DE_SERVICIO' });
  });
});
