import { describe, expect, it } from 'vitest';
import { CATEGORIAS, categoriaDe } from './categorias.js';
import { aBbox, CENTRO_LA_PAZ, dentroDe, distanciaM, formatearDistancia } from './geo.js';
import { aplicarEvento, horaDe, vigenciaDe } from './reportes.js';
import type { EventoPublico, ReportePublico } from './reportes.js';

const ventana = {
  latitudMin: -16.51,
  latitudMax: -16.48,
  longitudMin: -68.15,
  longitudMax: -68.12,
};

const reporte = (id: string, cambios: Partial<ReportePublico> = {}): ReportePublico => ({
  id,
  codigoCategoria: 'bloqueo',
  estado: 'ACTIVO',
  publicLocation: { latitud: -16.4955, longitud: -68.1336 },
  creadoEn: '2026-10-18T12:00:00.000Z',
  caducaEn: '2026-10-18T18:00:00.000Z',
  ...cambios,
});

const evento = (tipo: string, contenido: Record<string, unknown>): EventoPublico => ({
  id: `e-${tipo}`,
  tipo,
  version: 1,
  ocurridoEn: '2026-10-18T12:00:00.000Z',
  contenido: contenido as EventoPublico['contenido'],
});

describe('categorías', () => {
  it('las cinco del SRS 3.1, cada una con su línea de Mi Teleférico y su TTL', () => {
    expect(CATEGORIAS.map((c) => [c.codigo, c.linea, c.horas])).toEqual([
      ['bloqueo', 'Amarilla', 6],
      ['accidente', 'Roja', 3],
      ['robo', 'Morada', 2],
      ['infraestructura', 'Café', 24],
      ['jauria', 'Naranja', 2],
    ]);
  });

  it('un código desconocido se muestra como incidente genérico', () => {
    expect(categoriaDe('nuevo')).toMatchObject({ corto: 'Incidente', linea: 'Plateada' });
    expect(categoriaDe('robo').corto).toBe('Robo');
  });
});

describe('geografía', () => {
  it('mide distancias y las dice como en la calle', () => {
    const cerca = { latitud: CENTRO_LA_PAZ.latitud + 0.003, longitud: CENTRO_LA_PAZ.longitud };

    expect(Math.round(distanciaM(CENTRO_LA_PAZ, cerca))).toBe(334);
    expect(formatearDistancia(334)).toBe('330 m');
    expect(formatearDistancia(3)).toBe('10 m');
    expect(formatearDistancia(1234)).toBe('1,2 km');
  });

  it('sabe si un punto cae en la ventana y la escribe como bbox', () => {
    expect(dentroDe(CENTRO_LA_PAZ, ventana)).toBe(true);
    expect(dentroDe({ latitud: -17, longitud: -68.13 }, ventana)).toBe(false);
    expect(aBbox(ventana)).toBe('-68.15000,-16.51000,-68.12000,-16.48000');
  });
});

describe('aplicarEvento (HU-02: el mapa se actualiza en vivo)', () => {
  it('ReporteCreado agrega el reporte si cae en la ventana y no estaba', () => {
    const creado = evento('ReporteCreado', {
      idReporte: 'r2',
      codigoCategoria: 'robo',
      estado: 'ACTIVO',
      publicLocation: { latitud: -16.49, longitud: -68.13 },
      creadoEn: '2026-10-18T12:05:00.000Z',
      caducaEn: '2026-10-18T14:05:00.000Z',
    });
    const lista = [reporte('r1')];

    const nueva = aplicarEvento(lista, creado, ventana);

    expect(nueva.map((r) => r.id)).toEqual(['r2', 'r1']);
    expect(nueva[0]).not.toHaveProperty('idReporte');
    expect(aplicarEvento(nueva, creado, ventana)).toBe(nueva);
  });

  it('ReporteCreado fuera de la ventana no cambia la lista', () => {
    const lejos = evento('ReporteCreado', {
      idReporte: 'r3',
      publicLocation: { latitud: -16.6, longitud: -68.2 },
    });
    const lista = [reporte('r1')];

    expect(aplicarEvento(lista, lejos, ventana)).toBe(lista);
  });

  it('ReporteConfirmado y ReporteExtendido lo marcan confirmado con su nueva vigencia', () => {
    const lista = [reporte('r1')];

    const confirmado = aplicarEvento(
      lista,
      evento('ReporteConfirmado', { idReporte: 'r1', caducaEn: '2026-10-18T21:00:00.000Z' }),
      ventana,
    );

    expect(confirmado[0]).toMatchObject({
      estado: 'CONFIRMADO',
      caducaEn: '2026-10-18T21:00:00.000Z',
    });
    expect(
      aplicarEvento(confirmado, evento('ReporteExtendido', { idReporte: 'r1' }), ventana)[0]
        ?.caducaEn,
    ).toBe('2026-10-18T21:00:00.000Z');
  });

  it.each(['ReporteResuelto', 'ReporteCaducado', 'ReporteRechazado'])(
    '%s lo retira del mapa',
    (tipo) => {
      expect(
        aplicarEvento([reporte('r1'), reporte('r2')], evento(tipo, { idReporte: 'r1' }), ventana),
      ).toEqual([reporte('r2')]);
    },
  );

  it('un evento de un reporte que no está en la lista, o de tipo desconocido, no la cambia', () => {
    const lista = [reporte('r1')];

    expect(aplicarEvento(lista, evento('ReporteCaducado', { idReporte: 'otro' }), ventana)).toBe(
      lista,
    );
    expect(aplicarEvento(lista, evento('Desconocido', { idReporte: 'r1' }), ventana)).toBe(lista);
  });

  it('las horas se muestran en la hora de Bolivia', () => {
    expect(horaDe('2026-10-18T22:40:00.000Z')).toBe('18:40');
  });

  it('la vigencia dice el día cuando no es hoy', () => {
    const ahora = new Date('2026-10-18T13:00:00.000Z');

    expect(vigenciaDe('2026-10-18T22:40:00.000Z', ahora)).toBe('18:40');
    expect(vigenciaDe('2026-10-19T13:10:00.000Z', ahora)).toBe('mañana 09:10');
    expect(vigenciaDe('2026-10-20T13:10:00.000Z', ahora)).toBe('20/10 09:10');
  });
});
