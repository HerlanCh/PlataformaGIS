import { idReporte, idUsuario, PuntoGeo } from '@gis/shared-kernel';
import { GeneradorDeIdSecuencial, RelojFijo } from '@gis/testing';
import { describe, expect, it } from 'vitest';
import { AgregarDescripcion } from '../application/agregar-descripcion.js';
import { CATEGORIAS_MVP } from '../domain/category.js';
import { Reporte } from '../domain/report.js';
import { RepositorioReportesEnMemoria, UnidadDeTrabajoEnMemoria } from './dobles.js';

const AUTOR = '11111111-1111-4111-8111-111111111111';
const OTRO = '22222222-2222-4222-8222-222222222222';
const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001';

async function escenario(preparar: (reporte: Reporte, ahora: Date) => void = () => {}) {
  const reportes = new RepositorioReportesEnMemoria();
  const unidadDeTrabajo = new UnidadDeTrabajoEnMemoria(reportes);
  const reloj = new RelojFijo();
  const reporte = Reporte.crear({
    id: idReporte(ID),
    categoria: CATEGORIAS_MVP[0]!,
    authorId: idUsuario(AUTOR),
    location: PuntoGeo.crear(-16.5, -68.15),
    idempotencyKey: 'semilla-0001',
    ahora: reloj.ahora(),
  });
  preparar(reporte, reloj.ahora());
  reporte.extraerEventos();
  await reportes.guardar(reporte);
  const caso = new AgregarDescripcion({
    reportes,
    unidadDeTrabajo,
    reloj,
    ids: new GeneradorDeIdSecuencial('eeeeeeee'),
  });
  return { reportes, unidadDeTrabajo, caso };
}

describe('AgregarDescripcion', () => {
  it('HU-10: guarda la descripción y emite DescripcionAgregada.v1 sin el texto', async () => {
    const { reportes, unidadDeTrabajo, caso } = await escenario();

    await caso.ejecutar({ idReporte: ID, idAutor: AUTOR, descripcion: 'Poste caído' });

    expect((await reportes.buscarPorId(idReporte(ID)))?.descripcion).toBe('Poste caído');
    expect(unidadDeTrabajo.eventos).toHaveLength(1);
    expect(unidadDeTrabajo.eventos[0]).toMatchObject({
      tipo: 'DescripcionAgregada',
      version: 1,
      contenido: { idReporte: ID },
    });
    expect(JSON.stringify(unidadDeTrabajo.eventos)).not.toContain('Poste');
  });

  it('HU-10: un reporte inexistente da NO_ENCONTRADO', async () => {
    const { caso } = await escenario();

    await expect(
      caso.ejecutar({
        idReporte: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000999',
        idAutor: AUTOR,
        descripcion: 'x',
      }),
    ).rejects.toMatchObject({ tipo: 'NO_ENCONTRADO', codigo: 'REPORTE_NO_ENCONTRADO' });
  });

  it.each([
    ['otro usuario', OTRO, 'texto', 'PROHIBIDO', 'NO_ES_EL_AUTOR'],
    ['texto vacío', AUTOR, '  ', 'VALIDACION_FALLIDA', 'DESCRIPCION_INVALIDA'],
  ])('HU-10: con %s falla', async (_caso, idAutor, descripcion, tipo, codigo) => {
    const { caso, unidadDeTrabajo } = await escenario();

    await expect(caso.ejecutar({ idReporte: ID, idAutor, descripcion })).rejects.toMatchObject({
      tipo,
      codigo,
    });
    expect(unidadDeTrabajo.eventos).toEqual([]);
  });

  it('HU-10: una segunda descripción da CONFLICTO', async () => {
    const { caso } = await escenario();
    await caso.ejecutar({ idReporte: ID, idAutor: AUTOR, descripcion: 'primera' });

    await expect(
      caso.ejecutar({ idReporte: ID, idAutor: AUTOR, descripcion: 'segunda' }),
    ).rejects.toMatchObject({ tipo: 'CONFLICTO', codigo: 'DESCRIPCION_YA_AGREGADA' });
  });

  it('HU-10: un reporte resuelto da CONFLICTO', async () => {
    const { caso } = await escenario((r, ahora) => r.marcarResuelto(ahora));

    await expect(
      caso.ejecutar({ idReporte: ID, idAutor: AUTOR, descripcion: 'texto' }),
    ).rejects.toMatchObject({ tipo: 'CONFLICTO', codigo: 'REPORTE_NO_VIGENTE' });
  });

  it('SRS 3.2.7: al autor silenciado se le acepta sin guardar ni emitir nada', async () => {
    const { caso, reportes, unidadDeTrabajo } = await escenario((r, ahora) =>
      r.rechazar('AUTOR_SILENCIADO', ahora),
    );

    await caso.ejecutar({ idReporte: ID, idAutor: AUTOR, descripcion: 'texto' });

    expect((await reportes.buscarPorId(idReporte(ID)))?.descripcion).toBeNull();
    expect(unidadDeTrabajo.eventos).toEqual([]);
  });
});
