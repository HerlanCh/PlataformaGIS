import type { EventoDeIntegracion } from '@gis/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { avisarSalida } from './aviso-de-salida.js';
import { BusDeEventosConSalida, DespachadorDeSalida } from './despachador.js';
import type { Db } from './database.js';
import { crearRegistro } from './logger.js';

const registro = crearRegistro('silent');
const MINUTO = 60_000;

/** Fila del outbox tal como la devuelve la consulta del despachador. */
const filaDe = (id: string): Record<string, unknown> => {
  const evento: EventoDeIntegracion = {
    id,
    tipo: 'Prueba',
    version: 1,
    ocurridoEn: '2026-11-22T12:00:00.000Z',
    contenido: {},
  };
  return { id, tipo: 'Prueba.v1', contenido: evento, intentos: 0 };
};

/** Consulta encadenable de Drizzle que, al esperarla, devuelve `filas`. */
function consultaQueDevuelve(filas: readonly unknown[]) {
  const consulta: Record<string, unknown> = {
    then: (resolver: (valor: readonly unknown[]) => unknown) => resolver(filas),
  };
  for (const metodo of ['from', 'where', 'orderBy', 'limit', 'set', 'values']) {
    consulta[metodo] = () => consulta;
  }
  consulta.for = () => Promise.resolve(filas);
  consulta.onConflictDoNothing = () => Promise.resolve();
  return consulta;
}

/**
 * Base falsa: cuenta las pasadas (una transacción por pasada) y, en cada una, devuelve los
 * pendientes que queden en `pendientes`.
 */
function baseFalsa(pendientes: Record<string, unknown>[][] = []) {
  const vacia = consultaQueDevuelve([]);
  const tx = {
    select: () => consultaQueDevuelve(pendientes.shift() ?? []),
    update: () => vacia,
  };
  const transaction = vi.fn(async (pasada: (t: typeof tx) => Promise<unknown>) => pasada(tx));
  const db = { transaction, select: () => vacia, insert: () => vacia } as unknown as Db;
  return { db, pasadas: () => transaction.mock.calls.length };
}

describe('DespachadorDeSalida: sondeo de la base (RSK-02)', () => {
  let despachador: DespachadorDeSalida | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    const enMarcha = despachador?.detener();
    await vi.runOnlyPendingTimersAsync();
    await enMarcha;
    despachador = undefined;
    vi.useRealTimers();
  });

  const iniciar = (db: Db, bus = new BusDeEventosConSalida(db)) => {
    despachador = new DespachadorDeSalida(db, bus, { registro });
    despachador.iniciar();
    return despachador;
  };

  it('RSK-02: sin eventos nuevos no vuelve a consultar la base cada pocos milisegundos', async () => {
    const { db, pasadas } = baseFalsa();
    iniciar(db);

    await vi.advanceTimersByTimeAsync(0);
    expect(pasadas()).toBe(1);

    await vi.advanceTimersByTimeAsync(30 * MINUTO);
    expect(pasadas()).toBe(1);
  });

  it('RSK-02: al guardar eventos hace una pasada enseguida y la repite unos instantes por si aún no hay COMMIT', async () => {
    const { db, pasadas } = baseFalsa();
    iniciar(db);
    await vi.advanceTimersByTimeAsync(0);

    avisarSalida();
    await vi.advanceTimersByTimeAsync(0);
    expect(pasadas()).toBe(2);

    await vi.advanceTimersByTimeAsync(5000);
    const trasLaVentana = pasadas();
    expect(trasLaVentana).toBeGreaterThan(2);

    await vi.advanceTimersByTimeAsync(30 * MINUTO);
    expect(pasadas()).toBe(trasLaVentana);
  });

  it('RSK-02: la ventana termina en cuanto una pasada entrega algo', async () => {
    const { db, pasadas } = baseFalsa([[], [filaDe('00000000-0000-4000-8000-000000000001')]]);
    iniciar(db);
    await vi.advanceTimersByTimeAsync(0);

    avisarSalida();
    await vi.advanceTimersByTimeAsync(5000);

    expect(pasadas()).toBe(2);
  });

  it('RSK-02: un aviso durante una pasada en curso programa otra al terminar', async () => {
    let liberar: () => void = () => undefined;
    const { db } = baseFalsa();
    const original = db.transaction.bind(db);
    let primera = true;
    const transaction = vi.fn(async (pasada: Parameters<Db['transaction']>[0]) => {
      if (primera) {
        primera = false;
        await new Promise<void>((listo) => (liberar = listo));
      }
      return original(pasada);
    });
    iniciar({ ...db, transaction } as unknown as Db);
    await vi.advanceTimersByTimeAsync(0);

    avisarSalida();
    liberar();
    await vi.advanceTimersByTimeAsync(0);

    expect(transaction.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('RSK-02: tras un fallo de entrega, la siguiente pasada llega con el reintento y no con el respaldo', async () => {
    const id = '00000000-0000-4000-8000-000000000002';
    const { db, pasadas } = baseFalsa([[filaDe(id)]]);
    const bus = new BusDeEventosConSalida(db);
    bus.suscribir('Prueba.v1', 'falla', () => Promise.reject(new Error('caído')));
    iniciar(db, bus);
    await vi.advanceTimersByTimeAsync(0);
    expect(pasadas()).toBe(1);

    // Primer reintento: 2 s (`esperaDeReintentoS(1)`) más el margen de reloj.
    await vi.advanceTimersByTimeAsync(2000);
    expect(pasadas()).toBe(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(pasadas()).toBe(2);
  });

  it('detenido, ignora los avisos', async () => {
    const { db, pasadas } = baseFalsa();
    const enMarcha = iniciar(db);
    await vi.advanceTimersByTimeAsync(0);
    await enMarcha.detener();

    avisarSalida();
    await vi.advanceTimersByTimeAsync(5000);

    expect(pasadas()).toBe(1);
  });
});
