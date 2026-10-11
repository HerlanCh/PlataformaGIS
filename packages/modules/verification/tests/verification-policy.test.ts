import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { VerificationPolicy } from '../domain/verification-policy.js';
import type { VoteValue } from '../domain/vote.js';
import { reporte, voto } from './fixtures.js';

const activo = reporte({ status: 'ACTIVO', extensions: 0 });
const confirmado = reporte({ status: 'CONFIRMADO', extensions: 1 });

describe('VerificationPolicy: conteo', () => {
  it('suma por separado confirmaciones y negaciones', () => {
    const votos = [
      voto(1, 'CONFIRMACION', 1.5),
      voto(2, 'CONFIRMACION', 1),
      voto(3, 'NEGACION', 2),
    ];

    expect(VerificationPolicy.tally(votos, 'CONFIRMACION')).toEqual({ weight: 2.5, voters: 2 });
    expect(VerificationPolicy.tally(votos, 'NEGACION')).toEqual({ weight: 2, voters: 1 });
  });

  it('los votos de usuarios silenciados no pesan ni cuentan como votante', () => {
    const votos = [voto(1, 'CONFIRMACION', 1), voto(2, 'CONFIRMACION', 0)];

    expect(VerificationPolicy.tally(votos, 'CONFIRMACION')).toEqual({ weight: 1, voters: 1 });
  });

  it('la suma no arrastra error de coma flotante', () => {
    // 1.05 + 1.05 + 0.9 es 3.0000000000000004 en coma flotante.
    const votos = [1.05, 1.05, 0.9].map((peso, i) => voto(i, 'CONFIRMACION', peso));

    expect(VerificationPolicy.tally(votos, 'CONFIRMACION').weight).toBe(3);
  });
});

describe('VerificationPolicy: decisión', () => {
  it('HU-03: confirma al llegar a 3.0 con dos votantes distintos', () => {
    const votos = [voto(1, 'CONFIRMACION', 2.0), voto(2, 'CONFIRMACION', 1.0)];

    expect(VerificationPolicy.decide(activo, votos)).toBe('CONFIRM');
  });

  it('HU-03: con 2.0 de confirmaciones todavía no confirma', () => {
    expect(VerificationPolicy.decide(activo, [voto(1, 'CONFIRMACION', 2.0)])).toBe('NONE');
  });

  it('HU-03: resuelve cuando las negaciones de tres usuarios suman 3.0', () => {
    const votos = [voto(1, 'NEGACION'), voto(2, 'NEGACION'), voto(3, 'NEGACION')];

    expect(VerificationPolicy.decide(activo, votos)).toBe('RESOLVE');
    expect(VerificationPolicy.decide(confirmado, votos)).toBe('RESOLVE');
  });

  it('HU-03: un solo votante con reputación 4.0 no confirma', () => {
    expect(VerificationPolicy.decide(activo, [voto(1, 'CONFIRMACION', 4.0)])).toBe('NONE');
  });

  it('HU-03: un solo votante con reputación 4.0 tampoco resuelve', () => {
    expect(VerificationPolicy.decide(activo, [voto(1, 'NEGACION', 4.0)])).toBe('NONE');
  });

  it('HU-03: la segunda extensión llega al sumar 6.0 confirmaciones', () => {
    const cinco = [voto(1, 'CONFIRMACION', 2.5), voto(2, 'CONFIRMACION', 2.5)];

    expect(VerificationPolicy.decide(confirmado, cinco)).toBe('NONE');
    expect(VerificationPolicy.decide(confirmado, [...cinco, voto(3, 'CONFIRMACION', 1.0)])).toBe(
      'EXTEND',
    );
  });

  it('HU-03: con las dos extensiones usadas, más confirmaciones no extienden', () => {
    const agotado = reporte({ status: 'CONFIRMADO', extensions: 2 });
    const votos = [1, 2, 3, 4].map((n) => voto(n, 'CONFIRMACION', 2.5));

    expect(VerificationPolicy.decide(agotado, votos)).toBe('NONE');
  });

  it('un reporte ya confirmado no vuelve a confirmarse', () => {
    const votos = [voto(1, 'CONFIRMACION', 2.0), voto(2, 'CONFIRMACION', 1.0)];

    expect(VerificationPolicy.decide(confirmado, votos)).toBe('NONE');
  });

  it('las negaciones tienen prioridad sobre las confirmaciones', () => {
    const votos = [
      voto(1, 'CONFIRMACION', 3.0),
      voto(2, 'CONFIRMACION', 3.0),
      voto(3, 'NEGACION', 1.5),
      voto(4, 'NEGACION', 1.5),
    ];

    expect(VerificationPolicy.decide(confirmado, votos)).toBe('RESOLVE');
  });

  it.each(['RESUELTO', 'CADUCADO', 'RECHAZADO'] as const)(
    'no decide nada sobre un reporte %s',
    (status) => {
      const votos = [1, 2, 3].map((n) => voto(n, 'NEGACION', 5));

      expect(VerificationPolicy.decide(reporte({ status }), votos)).toBe('NONE');
    },
  );

  it('sin votos no decide nada', () => {
    expect(VerificationPolicy.decide(activo, [])).toBe('NONE');
  });
});

describe('VerificationPolicy: propiedades', () => {
  const valor = fc.constantFrom<VoteValue>('CONFIRMACION', 'NEGACION');
  const peso = fc.integer({ min: 0, max: 100 }).map((n) => n / 20); // 0.00 a 5.00 en pasos de 0.05
  const estado = fc.constantFrom(activo, confirmado);
  const votos = fc
    .array(fc.tuple(valor, peso), { maxLength: 12 })
    .map((lista) => lista.map(([v, p], i) => voto(i, v, p)));

  it('nunca confirma ni resuelve con un solo votante, por alta que sea su reputación', () => {
    fc.assert(
      fc.property(estado, valor, peso, (report, v, p) => {
        expect(VerificationPolicy.decide(report, [voto(1, v, p)])).toBe('NONE');
      }),
    );
  });

  it('añadir el voto de un usuario silenciado nunca cambia la decisión', () => {
    fc.assert(
      fc.property(estado, votos, valor, (report, lista, v) => {
        const antes = VerificationPolicy.decide(report, lista);
        const despues = VerificationPolicy.decide(report, [...lista, voto(500, v, 0)]);

        expect(despues).toBe(antes);
      }),
    );
  });

  it('solo confirma con al menos 3.0 de confirmaciones y solo resuelve con al menos 3.0 de negaciones', () => {
    fc.assert(
      fc.property(estado, votos, (report, lista) => {
        const decision = VerificationPolicy.decide(report, lista);
        const confirmaciones = VerificationPolicy.tally(lista, 'CONFIRMACION');
        const negaciones = VerificationPolicy.tally(lista, 'NEGACION');

        if (decision === 'CONFIRM') {
          expect(confirmaciones.weight).toBeGreaterThanOrEqual(3);
          expect(confirmaciones.voters).toBeGreaterThanOrEqual(2);
        }
        if (decision === 'EXTEND') expect(confirmaciones.weight).toBeGreaterThanOrEqual(6);
        if (decision === 'RESOLVE') {
          expect(negaciones.weight).toBeGreaterThanOrEqual(3);
          expect(negaciones.voters).toBeGreaterThanOrEqual(2);
        }
      }),
    );
  });
});
