import { PuntoGeo, idReporte, idUsuario } from '@gis/shared-kernel';
import { describe, expect, it } from 'vitest';
import { CATEGORIAS_MVP } from '../domain/category.js';
import { ErrorClaveDeIdempotenciaInvalida } from '../domain/errors.js';
import { Reporte } from '../domain/report.js';

const crear = (idempotencyKey: string) =>
  Reporte.crear({
    id: idReporte('6f1c2f0e-3b7a-4d2a-9c58-0a4f5b1d2e3f'),
    categoria: CATEGORIAS_MVP[0]!,
    authorId: idUsuario('11111111-1111-4111-8111-111111111111'),
    location: PuntoGeo.crear(-16.5, -68.15),
    idempotencyKey,
    ahora: new Date('2026-10-12T12:00:00Z'),
  });

describe('Reporte: clave de idempotencia', () => {
  it('HU-05: conserva la clave que generó el cliente', () => {
    const clave = 'b7e2a9c4-51d3-4f6a-9e08-3c2d1a0f9b77';

    expect(crear(clave).idempotencyKey).toBe(clave);
  });

  it.each(['', 'corta', 'con espacios dentro', 'x'.repeat(129)])(
    'HU-05: rechaza la clave "%s"',
    (clave) => {
      expect(() => crear(clave)).toThrow(ErrorClaveDeIdempotenciaInvalida);
    },
  );
});
