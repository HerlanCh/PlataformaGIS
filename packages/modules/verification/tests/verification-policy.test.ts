import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PoliticaDeVerificacion } from '../domain/verification-policy.js';
import type { ValorVoto } from '../domain/vote.js';
import { reporte, voto } from './fixtures.js';

const activo = reporte({ estado: 'ACTIVO', extensiones: 0 });
const confirmado = reporte({ estado: 'CONFIRMADO', extensiones: 1 });

describe('PoliticaDeVerificacion: conteo', () => {
  it('suma por separado confirmaciones y negaciones', () => {
    const votos = [
      voto(1, 'CONFIRMACION', 1.5),
      voto(2, 'CONFIRMACION', 1),
      voto(3, 'NEGACION', 2),
    ];

    expect(PoliticaDeVerificacion.contar(votos, 'CONFIRMACION')).toEqual({
      peso: 2.5,
      votantes: 2,
    });
    expect(PoliticaDeVerificacion.contar(votos, 'NEGACION')).toEqual({ peso: 2, votantes: 1 });
  });

  it('los votos de usuarios silenciados no pesan ni cuentan como votante', () => {
    const votos = [voto(1, 'CONFIRMACION', 1), voto(2, 'CONFIRMACION', 0)];

    expect(PoliticaDeVerificacion.contar(votos, 'CONFIRMACION')).toEqual({ peso: 1, votantes: 1 });
  });

  it('la suma no arrastra error de coma flotante', () => {
    // 1.05 + 1.05 + 0.9 es 3.0000000000000004 en coma flotante.
    const votos = [1.05, 1.05, 0.9].map((peso, i) => voto(i, 'CONFIRMACION', peso));

    expect(PoliticaDeVerificacion.contar(votos, 'CONFIRMACION').peso).toBe(3);
  });
});

describe('PoliticaDeVerificacion: decisión', () => {
  it('HU-03: confirma al llegar a 3.0 con dos votantes distintos', () => {
    const votos = [voto(1, 'CONFIRMACION', 2.0), voto(2, 'CONFIRMACION', 1.0)];

    expect(PoliticaDeVerificacion.decidir(activo, votos)).toBe('CONFIRMAR');
  });

  it('HU-03: con 2.0 de confirmaciones todavía no confirma', () => {
    expect(PoliticaDeVerificacion.decidir(activo, [voto(1, 'CONFIRMACION', 2.0)])).toBe('NINGUNA');
  });

  it('HU-03: resuelve cuando las negaciones de tres usuarios suman 3.0', () => {
    const votos = [voto(1, 'NEGACION'), voto(2, 'NEGACION'), voto(3, 'NEGACION')];

    expect(PoliticaDeVerificacion.decidir(activo, votos)).toBe('RESOLVER');
    expect(PoliticaDeVerificacion.decidir(confirmado, votos)).toBe('RESOLVER');
  });

  it('HU-03: un solo votante con reputación 4.0 no confirma', () => {
    expect(PoliticaDeVerificacion.decidir(activo, [voto(1, 'CONFIRMACION', 4.0)])).toBe('NINGUNA');
  });

  it('HU-03: un solo votante con reputación 4.0 tampoco resuelve', () => {
    expect(PoliticaDeVerificacion.decidir(activo, [voto(1, 'NEGACION', 4.0)])).toBe('NINGUNA');
  });

  it('HU-03: la segunda extensión llega al sumar 6.0 confirmaciones', () => {
    const cinco = [voto(1, 'CONFIRMACION', 2.5), voto(2, 'CONFIRMACION', 2.5)];

    expect(PoliticaDeVerificacion.decidir(confirmado, cinco)).toBe('NINGUNA');
    expect(
      PoliticaDeVerificacion.decidir(confirmado, [...cinco, voto(3, 'CONFIRMACION', 1.0)]),
    ).toBe('EXTENDER');
  });

  it('HU-03: con las dos extensiones usadas, más confirmaciones no extienden', () => {
    const agotado = reporte({ estado: 'CONFIRMADO', extensiones: 2 });
    const votos = [1, 2, 3, 4].map((n) => voto(n, 'CONFIRMACION', 2.5));

    expect(PoliticaDeVerificacion.decidir(agotado, votos)).toBe('NINGUNA');
  });

  it('un reporte ya confirmado no vuelve a confirmarse', () => {
    const votos = [voto(1, 'CONFIRMACION', 2.0), voto(2, 'CONFIRMACION', 1.0)];

    expect(PoliticaDeVerificacion.decidir(confirmado, votos)).toBe('NINGUNA');
  });

  it('las negaciones tienen prioridad sobre las confirmaciones', () => {
    const votos = [
      voto(1, 'CONFIRMACION', 3.0),
      voto(2, 'CONFIRMACION', 3.0),
      voto(3, 'NEGACION', 1.5),
      voto(4, 'NEGACION', 1.5),
    ];

    expect(PoliticaDeVerificacion.decidir(confirmado, votos)).toBe('RESOLVER');
  });

  it.each(['RESUELTO', 'CADUCADO', 'RECHAZADO'] as const)(
    'no decide nada sobre un reporte %s',
    (status) => {
      const votos = [1, 2, 3].map((n) => voto(n, 'NEGACION', 5));

      expect(PoliticaDeVerificacion.decidir(reporte({ estado: status }), votos)).toBe('NINGUNA');
    },
  );

  it('sin votos no decide nada', () => {
    expect(PoliticaDeVerificacion.decidir(activo, [])).toBe('NINGUNA');
  });
});

describe('PoliticaDeVerificacion: propiedades', () => {
  const valor = fc.constantFrom<ValorVoto>('CONFIRMACION', 'NEGACION');
  const peso = fc.integer({ min: 0, max: 100 }).map((n) => n / 20); // 0.00 a 5.00 en pasos de 0.05
  const estado = fc.constantFrom(activo, confirmado);
  const votos = fc
    .array(fc.tuple(valor, peso), { maxLength: 12 })
    .map((lista) => lista.map(([v, p], i) => voto(i, v, p)));

  it('nunca confirma ni resuelve con un solo votante, por alta que sea su reputación', () => {
    fc.assert(
      fc.property(estado, valor, peso, (report, v, p) => {
        expect(PoliticaDeVerificacion.decidir(report, [voto(1, v, p)])).toBe('NINGUNA');
      }),
    );
  });

  it('añadir el voto de un usuario silenciado nunca cambia la decisión', () => {
    fc.assert(
      fc.property(estado, votos, valor, (report, lista, v) => {
        const antes = PoliticaDeVerificacion.decidir(report, lista);
        const despues = PoliticaDeVerificacion.decidir(report, [...lista, voto(500, v, 0)]);

        expect(despues).toBe(antes);
      }),
    );
  });

  it('solo confirma con al menos 3.0 de confirmaciones y solo resuelve con al menos 3.0 de negaciones', () => {
    fc.assert(
      fc.property(estado, votos, (report, lista) => {
        const decision = PoliticaDeVerificacion.decidir(report, lista);
        const confirmaciones = PoliticaDeVerificacion.contar(lista, 'CONFIRMACION');
        const negaciones = PoliticaDeVerificacion.contar(lista, 'NEGACION');

        if (decision === 'CONFIRMAR') {
          expect(confirmaciones.peso).toBeGreaterThanOrEqual(3);
          expect(confirmaciones.votantes).toBeGreaterThanOrEqual(2);
        }
        if (decision === 'EXTENDER') expect(confirmaciones.peso).toBeGreaterThanOrEqual(6);
        if (decision === 'RESOLVER') {
          expect(negaciones.peso).toBeGreaterThanOrEqual(3);
          expect(negaciones.votantes).toBeGreaterThanOrEqual(2);
        }
      }),
    );
  });
});
