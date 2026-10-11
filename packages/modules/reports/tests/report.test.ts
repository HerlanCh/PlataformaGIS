import { GeoPoint, reportId, userId } from '@gis/shared-kernel';
import { describe, expect, it } from 'vitest';
import { MVP_CATEGORIES } from '../domain/category.js';
import type { Category } from '../domain/category.js';
import {
  ExtensionLimitReachedError,
  InvalidTransitionError,
  NotExpiredYetError,
} from '../domain/errors.js';
import { Report, TRANSITIONS } from '../domain/report.js';
import type { ReportStatus } from '../domain/report.js';

const categoria = (codigo: string): Category => {
  const encontrada = MVP_CATEGORIES.find((c) => c.code === codigo);
  if (!encontrada) throw new Error(`categoría desconocida: ${codigo}`);
  return encontrada;
};

const creado = new Date('2026-10-11T12:00:00Z');
const minutosDespues = (minutos: number) => new Date(creado.getTime() + minutos * 60_000);
const laPaz = GeoPoint.create(-16.5, -68.15);
const autor = userId('11111111-1111-4111-8111-111111111111');

const crear = (codigo = 'accidente') =>
  Report.create({
    id: reportId('6f1c2f0e-3b7a-4d2a-9c58-0a4f5b1d2e3f'),
    category: categoria(codigo),
    authorId: autor,
    location: laPaz,
    now: creado,
  });

/** Lleva un reporte nuevo al estado indicado por un camino válido. */
function enEstado(estado: ReportStatus): Report {
  const reporte = crear();
  const caminos: Record<ReportStatus, (r: Report) => void> = {
    ACTIVO: () => {},
    CONFIRMADO: (r) => r.markConfirmed(creado),
    RESUELTO: (r) => r.markResolved(creado),
    CADUCADO: (r) => r.expire(minutosDespues(181)),
    RECHAZADO: (r) => r.reject('MODERACION', creado),
  };
  caminos[estado](reporte);
  reporte.pullEvents();
  return reporte;
}

/** Intenta la transición hacia `destino` con el método que le corresponde. */
const INTENTAR: Record<Exclude<ReportStatus, 'ACTIVO'>, (r: Report) => void> = {
  CONFIRMADO: (r) => r.markConfirmed(creado),
  RESUELTO: (r) => r.markResolved(creado),
  // Muy después de cualquier caducidad posible, para probar solo la máquina de estados.
  CADUCADO: (r) => r.expire(minutosDespues(100_000)),
  RECHAZADO: (r) => r.reject('MODERACION', creado),
};

const ESTADOS = Object.keys(TRANSITIONS) as ReportStatus[];
const DESTINOS = Object.keys(INTENTAR) as Exclude<ReportStatus, 'ACTIVO'>[];
const PARES = ESTADOS.flatMap((desde) => DESTINOS.map((hacia) => [desde, hacia] as const));

describe('Report: creación', () => {
  it('HU-01: nace ACTIVO, con la caducidad de su categoría', () => {
    const reporte = crear('bloqueo');

    expect(reporte).toMatchObject({
      status: 'ACTIVO',
      categoryCode: 'bloqueo',
      authorId: autor,
      ttlMinutes: 360,
      createdAt: creado,
      expiresAt: minutosDespues(360),
      extensions: 0,
      rejectionReason: null,
      isActive: true,
    });
    expect(reporte.pullEvents()).toEqual([{ type: 'ReportCreated', occurredAt: creado }]);
  });

  it('HU-02: en una categoría no sensible la ubicación pública es la real', () => {
    expect(crear('bloqueo').publicLocation.equals(laPaz)).toBe(true);
  });

  it('HU-02: en "robo" la ubicación pública no es la real, que se conserva aparte', () => {
    const reporte = crear('robo');

    expect(reporte.location.equals(laPaz)).toBe(true);
    expect(reporte.publicLocation.equals(laPaz)).toBe(false);
    expect(reporte.location.distanceTo(reporte.publicLocation)).toBeLessThanOrEqual(142);
  });
});

describe('Report: máquina de estados', () => {
  const validos = PARES.filter(([desde, hacia]) => TRANSITIONS[desde].includes(hacia));
  const invalidos = PARES.filter(([desde, hacia]) => !TRANSITIONS[desde].includes(hacia));

  it('la tabla de transiciones es la del roadmap', () => {
    expect(TRANSITIONS).toEqual({
      ACTIVO: ['CONFIRMADO', 'RESUELTO', 'CADUCADO', 'RECHAZADO'],
      CONFIRMADO: ['RESUELTO', 'CADUCADO', 'RECHAZADO'],
      RESUELTO: [],
      CADUCADO: [],
      RECHAZADO: [],
    });
    expect(validos).toHaveLength(7);
    expect(invalidos).toHaveLength(13);
  });

  it.each(validos)('permite %s → %s', (desde, hacia) => {
    const reporte = enEstado(desde);

    INTENTAR[hacia](reporte);

    expect(reporte.status).toBe(hacia);
  });

  it.each(invalidos)('rechaza %s → %s', (desde, hacia) => {
    const reporte = enEstado(desde);

    expect(() => INTENTAR[hacia](reporte)).toThrow(InvalidTransitionError);
    expect(reporte.status).toBe(desde);
    expect(reporte.pullEvents()).toEqual([]);
  });

  it('un estado final deja de estar vigente', () => {
    expect(enEstado('CONFIRMADO').isActive).toBe(true);
    expect(enEstado('RESUELTO').isActive).toBe(false);
    expect(enEstado('CADUCADO').isActive).toBe(false);
    expect(enEstado('RECHAZADO').isActive).toBe(false);
  });
});

describe('Report: confirmación y extensiones', () => {
  it('HU-03: al confirmarse, un accidente (TTL 180) extiende su caducidad 90 minutos', () => {
    const reporte = crear('accidente');
    reporte.pullEvents();

    reporte.markConfirmed(minutosDespues(10));

    expect(reporte).toMatchObject({
      status: 'CONFIRMADO',
      expiresAt: minutosDespues(270),
      extensions: 1,
    });
    expect(reporte.pullEvents()).toEqual([
      { type: 'ReportConfirmed', occurredAt: minutosDespues(10), expiresAt: minutosDespues(270) },
    ]);
  });

  it('HU-03: la segunda extensión añade otro 50 % del TTL original', () => {
    const reporte = enEstado('CONFIRMADO');

    reporte.extendExpiration(minutosDespues(20));

    expect(reporte).toMatchObject({ expiresAt: minutosDespues(360), extensions: 2 });
    expect(reporte.pullEvents()).toEqual([
      { type: 'ReportExtended', occurredAt: minutosDespues(20), expiresAt: minutosDespues(360) },
    ]);
  });

  it('HU-03: ninguna confirmación posterior extiende más allá de dos veces', () => {
    const reporte = enEstado('CONFIRMADO');
    reporte.extendExpiration(creado);

    expect(() => reporte.extendExpiration(creado)).toThrow(ExtensionLimitReachedError);
    expect(reporte).toMatchObject({ expiresAt: minutosDespues(360), extensions: 2 });
  });

  it.each(['ACTIVO', 'RESUELTO', 'CADUCADO', 'RECHAZADO'] as const)(
    'un reporte %s no admite extensión',
    (estado) => {
      expect(() => enEstado(estado).extendExpiration(creado)).toThrow(InvalidTransitionError);
    },
  );
});

describe('Report: caducidad', () => {
  it('HU-04: un accidente de hace 181 minutos pasa a CADUCADO', () => {
    const reporte = crear('accidente');
    reporte.pullEvents();

    reporte.expire(minutosDespues(181));

    expect(reporte.status).toBe('CADUCADO');
    expect(reporte.pullEvents()).toEqual([
      { type: 'ReportExpired', occurredAt: minutosDespues(181) },
    ]);
  });

  it('HU-04: a los 179 minutos conserva su estado', () => {
    const reporte = crear('accidente');

    expect(() => reporte.expire(minutosDespues(179))).toThrow(NotExpiredYetError);
    expect(reporte.status).toBe('ACTIVO');
  });

  it('HU-04: un reporte CONFIRMADO caduca cuando pasa su caducidad extendida', () => {
    const reporte = enEstado('CONFIRMADO'); // caducidad extendida a los 270 minutos

    expect(() => reporte.expire(minutosDespues(200))).toThrow(NotExpiredYetError);
    reporte.expire(minutosDespues(271));

    expect(reporte.status).toBe('CADUCADO');
  });
});

describe('Report: resolución y rechazo', () => {
  it('HU-03: las negaciones de la comunidad lo dejan RESUELTO', () => {
    const reporte = enEstado('CONFIRMADO');

    reporte.markResolved(minutosDespues(30));

    expect(reporte.status).toBe('RESUELTO');
    expect(reporte.pullEvents()).toEqual([
      { type: 'ReportResolved', occurredAt: minutosDespues(30) },
    ]);
  });

  it('HU-12: un moderador lo rechaza y queda registrado el motivo', () => {
    const reporte = enEstado('ACTIVO');

    reporte.reject('MODERACION', minutosDespues(5));

    expect(reporte).toMatchObject({ status: 'RECHAZADO', rejectionReason: 'MODERACION' });
    expect(reporte.pullEvents()).toEqual([
      { type: 'ReportRejected', occurredAt: minutosDespues(5), reason: 'MODERACION' },
    ]);
  });

  it('el reporte de un autor silenciado se crea ACTIVO y pasa de inmediato a RECHAZADO', () => {
    const reporte = crear();

    reporte.reject('AUTOR_SILENCIADO', creado);

    expect(reporte).toMatchObject({ status: 'RECHAZADO', rejectionReason: 'AUTOR_SILENCIADO' });
    expect(reporte.pullEvents().map((evento) => evento.type)).toEqual([
      'ReportCreated',
      'ReportRejected',
    ]);
  });
});

describe('Report: persistencia y eventos', () => {
  it('se reconstruye sin registrar eventos', () => {
    const original = enEstado('CONFIRMADO');

    const restaurado = Report.restore({
      id: original.id,
      categoryCode: original.categoryCode,
      authorId: original.authorId,
      location: original.location,
      publicLocation: original.publicLocation,
      status: original.status,
      ttlMinutes: original.ttlMinutes,
      createdAt: original.createdAt,
      expiresAt: original.expiresAt,
      extensions: original.extensions,
      rejectionReason: original.rejectionReason,
    });

    expect(restaurado).toMatchObject({ status: 'CONFIRMADO', extensions: 1 });
    expect(restaurado.pullEvents()).toEqual([]);
  });

  it('entregar los eventos vacía la lista', () => {
    const reporte = crear();

    expect(reporte.pullEvents()).toHaveLength(1);
    expect(reporte.pullEvents()).toEqual([]);
  });
});
