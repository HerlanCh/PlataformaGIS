import { GeoPoint, reportId, userId } from '@gis/shared-kernel';
import { describe, expect, it } from 'vitest';
import { MVP_CATEGORIES } from '../domain/category.js';
import { InvalidIdempotencyKeyError } from '../domain/errors.js';
import { Report } from '../domain/report.js';

const crear = (idempotencyKey: string) =>
  Report.create({
    id: reportId('6f1c2f0e-3b7a-4d2a-9c58-0a4f5b1d2e3f'),
    category: MVP_CATEGORIES[0]!,
    authorId: userId('11111111-1111-4111-8111-111111111111'),
    location: GeoPoint.create(-16.5, -68.15),
    idempotencyKey,
    now: new Date('2026-10-12T12:00:00Z'),
  });

describe('Report: clave de idempotencia', () => {
  it('HU-05: conserva la clave que generó el cliente', () => {
    const clave = 'b7e2a9c4-51d3-4f6a-9e08-3c2d1a0f9b77';

    expect(crear(clave).idempotencyKey).toBe(clave);
  });

  it.each(['', 'corta', 'con espacios dentro', 'x'.repeat(129)])(
    'HU-05: rechaza la clave "%s"',
    (clave) => {
      expect(() => crear(clave)).toThrow(InvalidIdempotencyKeyError);
    },
  );
});
