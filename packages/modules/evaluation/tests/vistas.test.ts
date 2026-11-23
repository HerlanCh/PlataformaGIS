import { describe, expect, it } from 'vitest';
import type { Envio, EstadoRegistrado, Transicion } from '../domain/registro.js';
import { reconstruirVistas, VENTANA_BASE_MS } from '../domain/vistas.js';
import type { Caja } from '../domain/vistas.js';

const id = (n: number) => `6f1c2f0e-3b7a-4d2a-9c58-${String(n).padStart(12, '0')}`;
const cero = new Date('2026-11-22T12:00:00.000Z');
const minutos = (n: number) => new Date(cero.getTime() + n * 60_000);
const centro = { latitud: -16.5, longitud: -68.15 };
const caja: Caja = {
  latitudMin: -16.51,
  latitudMax: -16.49,
  longitudMin: -68.16,
  longitudMax: -68.14,
};

let evento = 1000;

/** Un reporte creado en el minuto `en`, con su envío y su primera transición. */
function reporte(
  n: number,
  en: number,
  cambios: Partial<Envio> = {},
  ttl = 360,
): { envio: Envio; transicion: Transicion } {
  return {
    envio: {
      idEnvio: id(n),
      tipo: 'CREADO',
      idReporte: id(n),
      codigoCategoria: 'bloqueo',
      publicLocation: centro,
      fuenteOficial: null,
      recibidoEn: minutos(en),
      ...cambios,
    },
    transicion: transicion(n, 'ACTIVO', en, en + ttl),
  };
}

function transicion(
  n: number,
  estado: EstadoRegistrado,
  en: number,
  caduca: number | null,
): Transicion {
  return {
    idEvento: id((evento += 1)),
    idReporte: id(n),
    estado,
    caducaEn: caduca === null ? null : minutos(caduca),
    ocurridoEn: minutos(en),
  };
}

const duplicado = (n: number, deReporte: number, en: number): Envio => ({
  idEnvio: id(n),
  tipo: 'DUPLICADO',
  idReporte: id(deReporte),
  codigoCategoria: 'bloqueo',
  publicLocation: { latitud: -16.5003, longitud: -68.15 },
  fuenteOficial: null,
  recibidoEn: minutos(en),
});

function vistas(envios: Envio[], transiciones: Transicion[], en: number) {
  return reconstruirVistas({ envios, transiciones }, minutos(en), caja);
}

const idsProcesada = (v: ReturnType<typeof vistas>) => v.procesada.map((p) => p.idReporte);
const idsBase = (v: ReturnType<typeof vistas>) => v.base.map((p) => p.idEnvio);

describe('reconstruirVistas (ADR-007)', () => {
  it('HU-14: la procesada absorbe el duplicado y la base lo muestra como un punto propio', () => {
    const { envio, transicion: creacion } = reporte(1, 0);

    const v = vistas([envio, duplicado(2, 1, 5)], [creacion], 10);

    expect(v.procesada).toEqual([
      {
        idReporte: id(1),
        codigoCategoria: 'bloqueo',
        publicLocation: centro,
        estado: 'ACTIVO',
        caducaEn: minutos(360),
        fuenteOficial: null,
      },
    ]);
    // La base va del envío más reciente al más antiguo, sin estado ni caducidad.
    expect(v.base).toEqual([
      expect.objectContaining({ idEnvio: id(2), idReporte: id(1), recibidoEn: minutos(5) }),
      expect.objectContaining({ idEnvio: id(1), idReporte: id(1), recibidoEn: minutos(0) }),
    ]);
    expect(v.base[0]).not.toHaveProperty('estado');
    expect(v).toMatchObject({ instante: minutos(10), caja });
  });

  it('HU-14: usa el estado y la caducidad que el reporte tenía en el instante, no los posteriores', () => {
    const { envio, transicion: creacion } = reporte(1, 0);
    const confirmacion = transicion(1, 'CONFIRMADO', 30, 540);
    const extension = transicion(1, 'CONFIRMADO', 60, 720);

    const antes = vistas([envio], [extension, confirmacion, creacion], 20);
    const confirmado = vistas([envio], [extension, confirmacion, creacion], 45);
    const extendido = vistas([envio], [extension, confirmacion, creacion], 60);

    expect(antes.procesada[0]).toMatchObject({ estado: 'ACTIVO', caducaEn: minutos(360) });
    expect(confirmado.procesada[0]).toMatchObject({ estado: 'CONFIRMADO', caducaEn: minutos(540) });
    expect(extendido.procesada[0]).toMatchObject({ estado: 'CONFIRMADO', caducaEn: minutos(720) });
  });

  it('HU-14: un reporte vencido sale de la procesada como en el mapa, aunque aún no se haya caducado', () => {
    const { envio, transicion: creacion } = reporte(1, 0, {}, 120);

    expect(idsProcesada(vistas([envio], [creacion], 120))).toEqual([id(1)]);
    expect(idsProcesada(vistas([envio], [creacion], 121))).toEqual([]);
    // La base no tiene caducidad: el envío sigue durante 24 h.
    expect(idsBase(vistas([envio], [creacion], 121))).toEqual([id(1)]);
  });

  it('HU-14: un reporte resuelto o caducado sale de la procesada y sigue en la base', () => {
    const resuelto = reporte(1, 0);
    const caducado = reporte(2, 0);
    const cierres = [transicion(1, 'RESUELTO', 30, null), transicion(2, 'CADUCADO', 40, null)];
    const envios = [resuelto.envio, caducado.envio];
    const todas = [resuelto.transicion, caducado.transicion, ...cierres];

    const v = vistas(envios, todas, 50);

    expect(v.procesada).toEqual([]);
    expect(idsBase(v).toSorted()).toEqual([id(1), id(2)]);
  });

  it('HU-14: un rechazo por moderación quita el reporte y sus duplicados de ambas vistas desde el rechazo', () => {
    const { envio, transicion: creacion } = reporte(1, 0);
    const rechazo = transicion(1, 'RECHAZADO', 30, null);
    const envios = [envio, duplicado(2, 1, 10)];

    const antes = vistas(envios, [creacion, rechazo], 29);
    const despues = vistas(envios, [creacion, rechazo], 30);

    expect([idsProcesada(antes), idsBase(antes)]).toEqual([[id(1)], [id(2), id(1)]]);
    expect([idsProcesada(despues), idsBase(despues)]).toEqual([[], []]);
  });

  it('HU-14: la base muestra los envíos de (t − 24 h, t] y nunca uno posterior al instante', () => {
    const viejo = reporte(1, 0, {}, 2000);
    const nuevo = reporte(2, 10, {}, 2000);
    const t = VENTANA_BASE_MS / 60_000;

    const v = vistas([viejo.envio, nuevo.envio], [viejo.transicion, nuevo.transicion], t);
    const antesDelNuevo = vistas(
      [viejo.envio, nuevo.envio],
      [viejo.transicion, nuevo.transicion],
      5,
    );

    // El de hace 24 h justas queda fuera de la base, pero sigue vigente en la procesada.
    expect(idsBase(v)).toEqual([id(2)]);
    expect(idsProcesada(v)).toEqual([id(1), id(2)]);
    expect([idsProcesada(antesDelNuevo), idsBase(antesDelNuevo)]).toEqual([[id(1)], [id(1)]]);
  });

  it('HU-14: un incidente oficial aparece igual en ambas vistas mientras está vigente, aunque tenga más de 24 h', () => {
    const oficial = reporte(
      1,
      0,
      { fuenteOficial: 'TRANSITO', codigoCategoria: 'infraestructura' },
      2000,
    );
    const t = VENTANA_BASE_MS / 60_000 + 60;

    const vigente = vistas([oficial.envio], [oficial.transicion], t);
    const vencido = vistas([oficial.envio], [oficial.transicion], 2001);

    expect(idsProcesada(vigente)).toEqual([id(1)]);
    expect(vigente.base).toEqual([
      expect.objectContaining({ idEnvio: id(1), fuenteOficial: 'TRANSITO' }),
    ]);
    expect([idsProcesada(vencido), idsBase(vencido)]).toEqual([[], []]);
  });

  it('HU-14: solo cuenta lo que cae en la zona, con el borde incluido', () => {
    const dentro = reporte(1, 0);
    const borde = reporte(2, 0, { publicLocation: { latitud: caja.latitudMax, longitud: -68.15 } });
    const fuera = reporte(3, 0, { publicLocation: { latitud: -16.6, longitud: -68.15 } });
    const envios = [dentro.envio, borde.envio, fuera.envio];

    const v = vistas(envios, [dentro.transicion, borde.transicion, fuera.transicion], 10);

    expect(idsProcesada(v)).toEqual([id(1), id(2)]);
    expect(idsBase(v).toSorted()).toEqual([id(1), id(2)]);
  });

  it('HU-14: un reporte anterior a la activación del módulo no tiene envío ni aparece en la procesada', () => {
    const sinEnvio = transicion(9, 'ACTIVO', 0, 360);

    const v = vistas([duplicado(2, 9, 5)], [sinEnvio], 10);

    expect(v.procesada).toEqual([]);
    expect(idsBase(v)).toEqual([id(2)]);
  });
});
