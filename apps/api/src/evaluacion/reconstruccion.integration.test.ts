import { ConsultarVistas, RepositorioEvaluacionPg } from '@gis/module-evaluation';
import type { ReportePublico } from '@gis/module-reports';
import { PuntoGeo } from '@gis/shared-kernel';
import { describeIntegration, desplazar } from '@gis/testing';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { prepararCadena } from './cadena-de-prueba.js';
import type { Cadena } from './cadena-de-prueba.js';

const plaza = PuntoGeo.crear(-16.5, -68.15);
const caja = { latitudMin: -16.52, latitudMax: -16.48, longitudMin: -68.17, longitudMax: -68.13 };

interface Fotografia {
  readonly instante: Date;
  readonly mapa: readonly ReportePublico[];
}

/** Lo que importa comparar de un punto del mapa: qué reporte, dónde, en qué estado y hasta cuándo. */
const comparable = (p: {
  idReporte: string;
  codigoCategoria: string;
  estado: string;
  caducaEn: Date;
  latitud: number;
  longitud: number;
  fuenteOficial: string | null;
}) => ({ ...p, caducaEn: p.caducaEn.toISOString() });

/**
 * HU-14, ADR-007: el flujo real (casos de uso, outbox, despachador y los manejadores de producción)
 * sobre PostGIS. En varios instantes se fotografía lo que devuelve la consulta del mapa; al final,
 * la vista procesada reconstruida desde el registro de la evaluación debe coincidir con cada foto.
 */
describeIntegration('reconstrucción de la vista procesada', () => {
  let cadena: Cadena;
  const fotos: Fotografia[] = [];

  beforeAll(async () => {
    cadena = await prepararCadena('reconstruccion');
  });

  afterAll(async () => {
    await cadena?.base.close();
  });

  async function fotografiar(): Promise<void> {
    await cadena.despachar();
    const mapa = await cadena.casos.listarReportes.ejecutar({ ...caja, categorias: [] });
    fotos.push({ instante: cadena.reloj.ahora(), mapa });
  }

  it('HU-14: en cada instante la vista procesada coincide con lo que devolvía la consulta del mapa', async () => {
    const { crear, votar, reloj } = cadena;
    const bloqueo = await crear(1, 'bloqueo', plaza);
    await fotografiar();

    reloj.avanzarMinutos(5);
    await crear(2, 'bloqueo', desplazar(plaza, 20, 0)); // duplicado: confirma el bloqueo
    const robo = await crear(3, 'robo', desplazar(plaza, 0, 600)); // ubicación pública ofuscada
    await fotografiar();

    reloj.avanzarMinutos(5);
    await votar('confirmar', bloqueo, 4, desplazar(plaza, 300, 0));
    await votar('confirmar', bloqueo, 5, desplazar(plaza, 0, 300));
    await fotografiar(); // el bloqueo pasa a CONFIRMADO con más vigencia

    reloj.avanzarMinutos(5);
    const accidente = await crear(6, 'accidente', desplazar(plaza, -800, 0));
    const jauria = await crear(7, 'jauria', desplazar(plaza, 0, -900));
    await cadena.publicarOficial(
      'infraestructura',
      PuntoGeo.crear(plaza.latitud + 0.01, plaza.longitud),
    );
    await fotografiar();

    reloj.avanzarMinutos(5);
    await cadena.rechazar(jauria);
    for (const votante of [8, 9, 10]) {
      await votar('negar', accidente, votante, desplazar(plaza, -800, 200));
    }
    await fotografiar(); // la jauría rechazada y el accidente resuelto salen del mapa

    reloj.avanzarMinutos(110);
    await fotografiar(); // el robo (120 min) venció, pero aún no pasó la tarea de caducidad
    await cadena.caducar();
    await fotografiar();

    reloj.avanzarMinutos(600);
    await cadena.caducar();
    await fotografiar(); // también caducó el bloqueo confirmado

    const vistas = new ConsultarVistas(new RepositorioEvaluacionPg(cadena.db), reloj);
    const vistos = new Set<string>();
    for (const { instante, mapa } of fotos) {
      const reconstruida = await vistas.ejecutar({ rolActor: 'MODERADOR', instante, caja });
      const esperado = mapa
        .map((r) =>
          comparable({
            idReporte: r.id,
            codigoCategoria: r.codigoCategoria,
            estado: r.estado,
            caducaEn: r.caducaEn,
            latitud: r.publicLocation.latitud,
            longitud: r.publicLocation.longitud,
            fuenteOficial: r.fuenteOficial,
          }),
        )
        .toSorted((a, b) => a.idReporte.localeCompare(b.idReporte));
      const obtenido = reconstruida.procesada.map(({ publicLocation, ...p }) =>
        comparable({ ...p, ...publicLocation }),
      );

      expect(obtenido, `instante ${instante.toISOString()}`).toEqual(esperado);
      for (const p of esperado) vistos.add(`${p.idReporte}:${p.estado}`);
    }
    // El escenario recorrió los casos que importan.
    expect(vistos).toContain(`${bloqueo}:CONFIRMADO`);
    expect(vistos).toContain(`${robo}:ACTIVO`);
    expect(fotos.at(-1)!.mapa.map((r) => r.fuenteOficial)).toEqual(['TRANSITO']);
  });

  it('HU-14: el duplicado es un punto propio en la vista base y el rechazo lo quita de ambas vistas', async () => {
    const vistas = new ConsultarVistas(new RepositorioEvaluacionPg(cadena.db), cadena.reloj);
    const [, segunda, , , rechazo] = fotos;

    const conDuplicado = await vistas.ejecutar({
      rolActor: 'MODERADOR',
      instante: segunda!.instante,
      caja,
    });
    const trasRechazo = await vistas.ejecutar({
      rolActor: 'MODERADOR',
      instante: rechazo!.instante,
      caja,
    });

    const bloqueo = conDuplicado.procesada.find((p) => p.codigoCategoria === 'bloqueo')!;
    expect(conDuplicado.base.filter((p) => p.idReporte === bloqueo.idReporte)).toHaveLength(2);
    expect(conDuplicado.procesada.filter((p) => p.codigoCategoria === 'bloqueo')).toHaveLength(1);
    const categorias = (v: typeof trasRechazo) => [
      ...v.procesada.map((p) => p.codigoCategoria),
      ...v.base.map((p) => p.codigoCategoria),
    ];
    expect(categorias(trasRechazo)).not.toContain('jauria');
    // El accidente resuelto ya no está en la procesada, pero su envío sigue en la base.
    expect(trasRechazo.procesada.map((p) => p.codigoCategoria)).not.toContain('accidente');
    expect(trasRechazo.base.map((p) => p.codigoCategoria)).toContain('accidente');
  });
});
