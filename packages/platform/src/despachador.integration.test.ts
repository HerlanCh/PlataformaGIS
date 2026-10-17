import type { EventoDeIntegracion } from '@gis/contracts';
import { createTestDatabase, describeIntegration } from '@gis/testing';
import type { TestDatabase } from '@gis/testing';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  agregarASalida,
  BusDeEventosConSalida,
  crearDb,
  crearRegistro,
  DespachadorDeSalida,
  esperaDeReintentoS,
  migrarAvance,
  migracionesDePlataforma,
} from './index.js';
import type { Db } from './index.js';

const registro = crearRegistro('silent');
let secuencia = 0;
const evento = (tipo = 'Prueba', idReporte?: string): EventoDeIntegracion => {
  secuencia += 1;
  return {
    id: `00000000-0000-4000-8000-${String(secuencia).padStart(12, '0')}`,
    tipo,
    version: 1,
    ocurridoEn: new Date(Date.UTC(2026, 9, 17, 12, 0, secuencia)).toISOString(),
    contenido: idReporte === undefined ? { n: secuencia } : { n: secuencia, idReporte },
  };
};

describe('esperaDeReintentoS', () => {
  it('crece en potencias de 2 hasta 5 minutos', () => {
    expect([1, 2, 3, 8, 9, 20].map(esperaDeReintentoS)).toEqual([2, 4, 8, 256, 300, 300]);
  });
});

describeIntegration('despachador del outbox', () => {
  let base: TestDatabase;
  let db: Db;

  const fila = async (id: string) => {
    const { rows } = await db.execute(
      sql`select publicado_en, intentos, ultimo_error, proximo_intento from eventos_salida where id = ${id}`,
    );
    return rows[0] as {
      publicado_en: Date | null;
      intentos: number;
      ultimo_error: string | null;
      proximo_intento: Date | null;
    };
  };
  const pendientes = async () => {
    const { rows } = await db.execute(
      sql`select count(*)::int as n from eventos_salida where publicado_en is null`,
    );
    return Number(rows[0]?.n);
  };
  const vencerReintentos = () =>
    db.execute(sql`update eventos_salida set proximo_intento = now() - interval '1 second'`);

  beforeAll(async () => {
    base = await createTestDatabase();
    db = crearDb(base.pool);
    await migrarAvance(db, migracionesDePlataforma);
  });

  beforeEach(async () => {
    await db.execute(sql`delete from eventos_salida`);
    await db.execute(sql`delete from eventos_procesados`);
  });

  afterAll(async () => {
    await base?.close();
  });

  it('publicar escribe en el outbox; un nombre repetido en la misma clave es un error', async () => {
    const bus = new BusDeEventosConSalida(db);
    const uno = evento();
    await bus.publicar(uno);
    const cancelar = bus.suscribir('Prueba.v1', 'a', vi.fn());

    expect(await pendientes()).toBe(1);
    expect(() => bus.suscribir('Prueba.v1', 'a', vi.fn())).toThrow('"a" ya escucha Prueba.v1');
    cancelar();
    expect(bus.manejadoresDe('Prueba.v1')).toEqual([]);
  });

  it('fiabilidad: los eventos guardados antes de un reinicio se entregan todos; los de un reporte, en orden', async () => {
    const REPORTE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const delReporte = [
      evento('Prueba', REPORTE),
      evento('Prueba', REPORTE),
      evento('Prueba', REPORTE),
    ];
    const sueltos = [evento(), evento()];
    const eventos = [...delReporte, ...sueltos];
    // El proceso "murió" después de guardar: nadie los publicó.
    await agregarASalida(db, eventos);
    const recibidos: string[] = [];
    const bus = new BusDeEventosConSalida(db);
    bus.suscribir('Prueba.v1', 'registro', (e) => void recibidos.push(e.id));

    // Un despachador nuevo, como tras reiniciar.
    await new DespachadorDeSalida(db, bus, { registro }).despacharPendientes();

    expect([...recibidos].sort()).toEqual(eventos.map((e) => e.id).sort());
    expect(recibidos.filter((id) => delReporte.some((e) => e.id === id))).toEqual(
      delReporte.map((e) => e.id),
    );
    expect(await pendientes()).toBe(0);
  });

  it('un evento sin manejadores se marca publicado', async () => {
    const huerfano = evento('SinOyentes');
    await agregarASalida(db, [huerfano]);

    await new DespachadorDeSalida(db, new BusDeEventosConSalida(db), {
      registro,
    }).despacharPendientes();

    expect((await fila(huerfano.id)).publicado_en).not.toBeNull();
  });

  it('si un manejador falla, se reintenta solo ese, con espera, sin repetir al que ya terminó', async () => {
    const uno = evento();
    await agregarASalida(db, [uno]);
    const sano = vi.fn();
    let fallar = true;
    const fragil = vi.fn(() => {
      if (fallar) throw new Error('caído');
    });
    const bus = new BusDeEventosConSalida(db);
    bus.suscribir('Prueba.v1', 'sano', sano);
    bus.suscribir('Prueba.v1', 'fragil', fragil);
    const despachador = new DespachadorDeSalida(db, bus, { registro });

    await despachador.despacharPendientes();
    const tras1 = await fila(uno.id);
    // Antes de la espera no se reintenta.
    await despachador.despacharPendientes();
    fallar = false;
    await vencerReintentos();
    await despachador.despacharPendientes();

    expect(tras1).toMatchObject({ publicado_en: null, intentos: 1, ultimo_error: 'fragil: caído' });
    expect(tras1.proximo_intento).not.toBeNull();
    expect(fragil).toHaveBeenCalledTimes(2);
    expect(sano).toHaveBeenCalledOnce();
    expect((await fila(uno.id)).publicado_en).not.toBeNull();
  });

  it('tras agotar los reintentos el evento se descarta con su error', async () => {
    const envenenado = evento();
    await agregarASalida(db, [envenenado]);
    const bus = new BusDeEventosConSalida(db);
    bus.suscribir('Prueba.v1', 'roto', () => {
      throw new Error('siempre');
    });
    const despachador = new DespachadorDeSalida(db, bus, { registro, maxIntentos: 2 });

    await despachador.despacharPendientes();
    await vencerReintentos();
    await despachador.despacharPendientes();

    expect(await fila(envenenado.id)).toMatchObject({ intentos: 2, ultimo_error: 'roto: siempre' });
    expect((await fila(envenenado.id)).publicado_en).not.toBeNull();
  });

  it('dos despachadores a la vez no entregan el mismo evento (SKIP LOCKED)', async () => {
    await agregarASalida(
      db,
      Array.from({ length: 20 }, () => evento()),
    );
    const entregas: string[] = [];
    const bus = new BusDeEventosConSalida(db);
    bus.suscribir('Prueba.v1', 'lento', async (e) => {
      entregas.push(e.id);
      await new Promise((listo) => setTimeout(listo, 5));
    });
    const a = new DespachadorDeSalida(db, bus, { registro, lote: 5 });
    const b = new DespachadorDeSalida(db, bus, { registro, lote: 5 });

    while ((await pendientes()) > 0) {
      await Promise.all([a.despacharPendientes(), b.despacharPendientes()]);
    }

    expect(entregas).toHaveLength(20);
    expect(new Set(entregas).size).toBe(20);
  });

  it('en marcha, entrega solo los eventos nuevos y se detiene de forma ordenada', async () => {
    const bus = new BusDeEventosConSalida(db);
    const recibidos: string[] = [];
    bus.suscribir('Prueba.v1', 'registro', (e) => void recibidos.push(e.id));
    const despachador = new DespachadorDeSalida(db, bus, { registro, intervaloMs: 20 });
    despachador.iniciar();
    despachador.iniciar();

    const nuevo = evento();
    await bus.publicar(nuevo);
    await vi.waitFor(() => expect(recibidos).toEqual([nuevo.id]), { timeout: 5000 });
    await despachador.detener();
    await bus.publicar(evento());
    await new Promise((listo) => setTimeout(listo, 100));

    expect(recibidos).toEqual([nuevo.id]);
  });

  it('una pasada que falla se registra y el despachador sigue', async () => {
    const error = vi.fn();
    const roto = { transaction: () => Promise.reject(new Error('sin base')) } as unknown as Db;
    const despachador = new DespachadorDeSalida(roto, new BusDeEventosConSalida(db), {
      registro: { ...registro, error } as unknown as typeof registro,
      intervaloMs: 10,
    });

    despachador.iniciar();
    await vi.waitFor(() => expect(error.mock.calls.length).toBeGreaterThanOrEqual(2), {
      timeout: 5000,
    });
    await despachador.detener();
  });
});
