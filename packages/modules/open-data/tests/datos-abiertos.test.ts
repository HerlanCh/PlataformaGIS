import {
  crearEvento,
  reporteCaducadoV1,
  reporteConfirmadoV1,
  reporteResueltoV1,
} from '@gis/contracts';
import { describe, expect, it } from 'vitest';
import { CargarHistorico } from '../application/cargar-historico.js';
import { aCsv, ConsultarDatosAbiertos } from '../application/consultar-datos-abiertos.js';
import { huellaDe, RegistrarDatoAbierto } from '../application/registrar-dato-abierto.js';
import {
  anonimizar,
  celdaDe,
  ErrorReporteNoPublicable,
  horaTruncada,
} from '../domain/dato-abierto.js';
import { LICENCIA } from '../domain/licencia.js';
import { openDataModulo } from '../index.js';
import { DatosEnMemoria, reporteFinalizado, ReportesFalsos } from './dobles.js';

const id = (n: number) => `6f1c2f0e-3b7a-4d2a-9c58-${String(n).padStart(12, '0')}`;
const sobre = { id: 'eeeeeeee-0000-4000-8000-000000000001', ocurridoEn: new Date() };
const HUELLA = 'a'.repeat(64);

describe('anonimización (HU-11)', () => {
  it('HU-11: cada fila tiene solo categoría, celda, hora truncada, estado final y confirmación', () => {
    const dato = anonimizar(reporteFinalizado(), HUELLA);

    expect(dato).toEqual({
      huella: HUELLA,
      codigoCategoria: 'bloqueo',
      celda: celdaDe(-16.4955, -68.1336),
      hora: new Date('2026-10-19T14:00:00.000Z'),
      estadoFinal: 'RESUELTO',
      fueConfirmado: true,
    });
    expect(JSON.stringify(dato)).not.toMatch(/-16\.4955|-68\.1336|6f1c2f0e/);
  });

  it('HU-11: la celda es el centro de una rejilla fija de 500 m, igual para puntos cercanos', () => {
    const a = celdaDe(-16.4955, -68.1336);
    const b = celdaDe(-16.4957, -68.1338);
    const lejos = celdaDe(-16.505, -68.1336);

    expect(a).toEqual(b);
    expect(lejos).not.toEqual(a);
    // A lo sumo media celda (unos 250 m) del punto, y nunca el punto mismo.
    expect(Math.abs(a.latitud + 16.4955) * 111_195).toBeLessThanOrEqual(251);
    expect(a.latitud).not.toBe(-16.4955);
  });

  it('trunca la hora a la hora en punto', () => {
    expect(horaTruncada(new Date('2026-10-19T23:59:59.999Z')).toISOString()).toBe(
      '2026-10-19T23:00:00.000Z',
    );
  });

  it.each([
    ['vigente', { estado: 'ACTIVO' }],
    ['rechazado por autor silenciado', { estado: 'RECHAZADO', motivoRechazo: 'AUTOR_SILENCIADO' }],
  ])('HU-11: no publica un reporte %s', (_caso, cambios) => {
    expect(() => anonimizar(reporteFinalizado(cambios), HUELLA)).toThrow(ErrorReporteNoPublicable);
  });

  it('un reporte sin confirmaciones no cuenta como confirmado', () => {
    expect(anonimizar(reporteFinalizado({ extensiones: 0 }), HUELLA).fueConfirmado).toBe(false);
  });
});

describe('RegistrarDatoAbierto', () => {
  function escenario() {
    const reportes = new ReportesFalsos();
    const datos = new DatosEnMemoria();
    return { reportes, datos, registrar: new RegistrarDatoAbierto(reportes, datos) };
  }

  it('HU-11: al resolverse o caducar un reporte guarda su fila una sola vez', async () => {
    const { reportes, datos, registrar } = escenario();
    reportes.poner(
      reporteFinalizado({ idReporte: id(1) }),
      reporteFinalizado({ idReporte: id(2), estado: 'CADUCADO' }),
    );

    await registrar.manejar(crearEvento(reporteResueltoV1, { idReporte: id(1) }, sobre));
    await registrar.manejar(crearEvento(reporteResueltoV1, { idReporte: id(1) }, sobre));
    await registrar.manejar(crearEvento(reporteCaducadoV1, { idReporte: id(2) }, sobre));

    expect([...datos.filas.keys()]).toEqual([huellaDe(id(1)), huellaDe(id(2))]);
    expect(huellaDe(id(1))).toMatch(/^[0-9a-f]{64}$/);
  });

  it('ignora otros eventos, reportes inexistentes y los que no se publican', async () => {
    const { reportes, datos, registrar } = escenario();
    reportes.poner(reporteFinalizado({ idReporte: id(3), estado: 'CONFIRMADO' }));

    await registrar.manejar(
      crearEvento(
        reporteConfirmadoV1,
        { idReporte: id(3), caducaEn: new Date().toISOString() },
        sobre,
      ),
    );

    expect(await registrar.registrar(id(3))).toBe(false);
    expect(await registrar.registrar(id(99))).toBe(false);
    expect(datos.filas.size).toBe(0);
  });

  it('escucha los tres desenlaces del reporte', () => {
    expect(RegistrarDatoAbierto.eventos).toEqual([
      'ReporteResuelto.v1',
      'ReporteCaducado.v1',
      'ReporteRechazado.v1',
    ]);
  });
});

describe('CargarHistorico', () => {
  it('HU-11: carga por lotes los reportes ya terminados y repetirlo no duplica', async () => {
    const reportes = new ReportesFalsos();
    const datos = new DatosEnMemoria();
    for (let n = 1; n <= 7; n += 1) {
      reportes.poner(
        reporteFinalizado({ idReporte: id(n), estado: n === 7 ? 'ACTIVO' : 'CADUCADO' }),
      );
    }
    const cargar = new CargarHistorico(reportes, new RegistrarDatoAbierto(reportes, datos));

    expect(await cargar.ejecutar(2)).toBe(6);
    expect(await cargar.ejecutar(2)).toBe(0);
    expect(datos.filas.size).toBe(6);
  });
});

describe('exportación CSV (HU-11)', () => {
  it('HU-11: exporta sin usuarios ni puntos exactos, con encabezado', async () => {
    const datos = new DatosEnMemoria();
    await datos.guardar(anonimizar(reporteFinalizado(), huellaDe(id(1))));

    const csv = await new ConsultarDatosAbiertos(datos).exportarCsv();
    const [encabezado, fila] = csv.trimEnd().split('\r\n');

    expect(encabezado).toBe(
      'categoria,celda_latitud,celda_longitud,hora_utc,estado_final,fue_confirmado',
    );
    expect(fila).toMatch(/^bloqueo,-16\.\d+,-68\.\d+,2026-10-19T14:00:00\.000Z,RESUELTO,true$/);
    expect(csv).not.toContain(huellaDe(id(1)));
    expect(aCsv([])).toBe(`${encabezado}\r\n`);
  });

  it('HU-11: declara una licencia abierta', () => {
    expect(LICENCIA.nombre).toBe('CC BY 4.0');
    expect(LICENCIA.url).toMatch(/^https:\/\/creativecommons\.org\/licenses\/by\/4\.0\//);
  });

  it('el módulo declara sus migraciones', () => {
    expect(openDataModulo.migraciones?.nombre).toBe('open-data');
  });
});
