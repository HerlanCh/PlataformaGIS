import {
  COLUMNAS_EXPORTADAS,
  exportacionACsv,
  RepositorioExportacionPg,
} from '@gis/module-evaluation';
import type { NombreDeTabla } from '@gis/module-evaluation';
import { PuntoGeo } from '@gis/shared-kernel';
import { describeIntegration, desplazar } from '@gis/testing';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { prepararCadena } from './cadena-de-prueba.js';
import type { Cadena } from './cadena-de-prueba.js';
import { leerExportacion } from './datos.js';
import type { DatosDeEvaluacion, TransicionDato } from './datos.js';
import { CATEGORIAS } from './piloto.js';
import { PARAMETROS_DEL_SRS, simular } from './simulador.js';

const plaza = PuntoGeo.crear(-16.5, -68.15);
const lejos = PuntoGeo.crear(-16.45, -68.2);

/** Estado, caducidad y hora de cada cambio; la caducidad real ocurre cuando corre la tarea. */
const historia = (transiciones: readonly TransicionDato[], idReporte: string) =>
  transiciones
    .filter((t) => t.idReporte === idReporte && t.estado !== 'CADUCADO')
    .toSorted((a, b) => a.ocurridoEn - b.ocurridoEn)
    .map((t) => [t.estado, t.caducaEn, t.ocurridoEn]);

/**
 * ADR-007, decisión 10: con los parámetros del SRS, el simulador de sensibilidad da el mismo
 * resultado que los casos de uso reales sobre el mismo registro (categorías no sensibles: en las
 * sensibles el simulador deduplica con la ubicación pública, una limitación declarada).
 */
describeIntegration('equivalencia del simulador con los casos de uso', () => {
  let cadena: Cadena;
  let datos: DatosDeEvaluacion;

  beforeAll(async () => {
    cadena = await prepararCadena('equivalencia');
    const { crear, votar, reloj, despachar } = cadena;
    const paso = async (minutos: number, accion: () => Promise<unknown>) => {
      reloj.avanzarMinutos(minutos);
      await accion();
      await despachar();
    };

    let bloqueo = '';
    await paso(0, async () => (bloqueo = await crear(1, 'bloqueo', plaza)));
    await paso(2, () => crear(2, 'bloqueo', desplazar(plaza, 20, 0))); // duplicado
    for (const votante of [3, 4]) {
      await paso(1, () => votar('confirmar', bloqueo, votante, desplazar(plaza, 300, 0))); // confirma
    }
    for (const votante of [5, 6, 7]) {
      await paso(1, () => votar('confirmar', bloqueo, votante, desplazar(plaza, 0, 300))); // extiende
    }
    let accidente = '';
    await paso(2, async () => (accidente = await crear(8, 'accidente', desplazar(plaza, -800, 0))));
    for (const votante of [9, 10, 11]) {
      await paso(1, () => votar('negar', accidente, votante, desplazar(plaza, -800, 200))); // resuelve
    }
    let jauria = '';
    await paso(2, async () => (jauria = await crear(12, 'jauria', desplazar(plaza, 0, -900))));
    await paso(1, () => cadena.rechazar(jauria));
    const oficial = desplazar(plaza, 500, 500);
    await paso(2, () => cadena.publicarOficial('infraestructura', oficial));
    await paso(1, () => crear(13, 'infraestructura', desplazar(oficial, 10, 0))); // duplicado del oficial
    await paso(2, () => crear(14, 'bloqueo', lejos)); // nadie lo vota: caduca
    await paso(400, () => cadena.caducar());
    await paso(5, () => crear(15, 'jauria', desplazar(lejos, 3000, 0)));

    const exportacion = await new RepositorioExportacionPg(cadena.db).exportar();
    const tablas = Object.keys(COLUMNAS_EXPORTADAS) as NombreDeTabla[];
    datos = leerExportacion(
      Object.fromEntries(tablas.map((t) => [t, exportacionACsv(t, exportacion[t])])) as Record<
        NombreDeTabla,
        string
      >,
    );
  });

  afterAll(async () => {
    await cadena?.base.close();
  });

  it('HU-14: con los parámetros del SRS el simulador da el mismo resultado que los casos de uso reales', () => {
    const simulacion = simular(datos, CATEGORIAS, PARAMETROS_DEL_SRS);
    const reportes = datos.envios.filter((e) => e.tipo === 'CREADO').map((e) => e.idReporte);

    // Los mismos envíos absorbidos por los mismos reportes.
    expect(simulacion.envios.map((e) => [e.idEnvio, e.idReporte])).toEqual(
      datos.envios.map((e) => [e.idEnvio, e.idReporte]),
    );
    // La misma historia de estados y caducidades en cada reporte.
    for (const id of reportes) {
      expect(historia(simulacion.transiciones, id), id).toEqual(historia(datos.transiciones, id));
    }
    // Lo que caducó en la realidad también caduca en la simulación.
    const caducados = (t: readonly TransicionDato[]) =>
      new Set(t.filter((x) => x.estado === 'CADUCADO').map((x) => x.idReporte));
    expect(
      [...caducados(datos.transiciones)].every((id) => caducados(simulacion.transiciones).has(id)),
    ).toBe(true);
  });

  it('HU-14: el escenario recorrió duplicado, confirmación, extensión, resolución, rechazo y caducidad', () => {
    const estados = new Set(datos.transiciones.map((t) => t.estado));
    const extensiones = datos.transiciones.filter((t) => t.estado === 'CONFIRMADO');

    expect([...estados].toSorted()).toEqual([
      'ACTIVO',
      'CADUCADO',
      'CONFIRMADO',
      'RECHAZADO',
      'RESUELTO',
    ]);
    expect(extensiones).toHaveLength(2);
    expect(datos.envios.filter((e) => e.tipo === 'DUPLICADO')).toHaveLength(2);
    expect(datos.votos.length).toBeGreaterThanOrEqual(10);
  });
});
