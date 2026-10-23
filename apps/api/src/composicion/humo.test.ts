import type { EventoDeIntegracion } from '@gis/contracts';
import type { RepositorioDeReportes } from '@gis/module-reports';
import { describe, expect, it, vi } from 'vitest';
import { cargarConfigHttp } from '../http/config-http.js';
import { reportesDeHumo, salvoHumo } from './humo.js';
import { consultaDeReportesFinalizados } from './puentes.js';

const HUMO = '00000000-0000-4000-8000-00000000f00d';
const VECINO = '00000000-0000-4000-8000-000000000001';
const DEL_HUMO = '00000000-0000-4000-8000-0000000000a1';
const DEL_VECINO = '00000000-0000-4000-8000-0000000000a2';

const reporte = (id: string, authorId: string) => ({
  id,
  authorId,
  codigoCategoria: 'bloqueo',
  estado: 'RECHAZADO',
  motivoRechazo: 'MODERACION',
  publicLocation: { latitud: -16.5, longitud: -68.13 },
  creadoEn: new Date('2026-10-23T12:00:00Z'),
  extensiones: 0,
});

const reportes = {
  buscarPorId: (id: string) =>
    Promise.resolve(
      { [DEL_HUMO]: reporte(DEL_HUMO, HUMO), [DEL_VECINO]: reporte(DEL_VECINO, VECINO) }[id] ??
        null,
    ),
  buscarIdsFinalizados: () => Promise.resolve([]),
} as unknown as RepositorioDeReportes;

const evento = (idReporte: string): EventoDeIntegracion => ({
  id: '00000000-0000-4000-8000-0000000000e1',
  tipo: 'ReporteCreado',
  version: 1,
  ocurridoEn: '2026-10-23T12:00:00.000Z',
  contenido: { idReporte },
});

describe('Reportes de la prueba de humo (roadmap 12)', () => {
  it('RNF-05: reconoce los reportes del usuario de humo y solo esos', async () => {
    const esDeHumo = reportesDeHumo(reportes, HUMO);

    expect(await esDeHumo(DEL_HUMO)).toBe(true);
    expect(await esDeHumo(DEL_VECINO)).toBe(false);
    expect(await esDeHumo('00000000-0000-4000-8000-0000000000ff')).toBe(false);
  });

  it('RNF-05: sin usuario de humo configurado, ningún reporte es de humo ni se consulta', async () => {
    const buscarPorId = vi.fn();
    const esDeHumo = reportesDeHumo({ buscarPorId } as unknown as RepositorioDeReportes, null);

    expect(await esDeHumo(DEL_HUMO)).toBe(false);
    expect(buscarPorId).not.toHaveBeenCalled();
  });

  it('HU-08: el reporte de humo no avisa a los suscriptores; el de un vecino sí', async () => {
    const manejar = vi.fn(() => Promise.resolve());
    const manejador = salvoHumo(reportesDeHumo(reportes, HUMO), manejar);

    await manejador(evento(DEL_HUMO));
    await manejador(evento(DEL_VECINO));

    expect(manejar).toHaveBeenCalledExactlyOnceWith(evento(DEL_VECINO));
  });

  it('RNF-05: un evento sin idReporte pasa siempre al manejador', async () => {
    const manejar = vi.fn(() => Promise.resolve());
    const sinReporte = { ...evento(DEL_HUMO), contenido: { idUsuario: HUMO } };

    await salvoHumo(reportesDeHumo(reportes, HUMO), manejar)(sinReporte);

    expect(manejar).toHaveBeenCalledExactlyOnceWith(sinReporte);
  });

  it('HU-11: el reporte de humo no entra en los datos abiertos; el de un vecino sí', async () => {
    const consulta = consultaDeReportesFinalizados(reportes, HUMO);

    expect(await consulta.buscar(DEL_HUMO)).toBeNull();
    expect(await consulta.buscar(DEL_VECINO)).toMatchObject({ idReporte: DEL_VECINO });
  });

  it('HU-11: los datos abiertos nunca reciben el autor', async () => {
    const fila = await consultaDeReportesFinalizados(reportes).buscar(DEL_VECINO);

    expect(fila).not.toHaveProperty('authorId');
  });

  it('RNF-05: HUMO_ID_USUARIO es opcional y debe ser un UUID', () => {
    expect(cargarConfigHttp({}).idUsuarioDeHumo).toBeNull();
    expect(cargarConfigHttp({ HUMO_ID_USUARIO: '' }).idUsuarioDeHumo).toBeNull();
    expect(cargarConfigHttp({ HUMO_ID_USUARIO: HUMO }).idUsuarioDeHumo).toBe(HUMO);
    expect(() => cargarConfigHttp({ HUMO_ID_USUARIO: 'no-es-uuid' })).toThrow(/HUMO_ID_USUARIO/);
  });
});
