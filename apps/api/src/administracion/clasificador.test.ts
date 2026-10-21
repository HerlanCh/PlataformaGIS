import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CONJUNTO_SINTETICO,
  evaluarYEscribirInforme,
  exportarConjunto,
  INFORME,
  RAIZ_DEL_REPOSITORIO,
  rutaDentroDe,
} from './clasificador.js';

let raiz: string;

beforeEach(async () => {
  raiz = await mkdtemp(join(tmpdir(), 'clasificador-'));
  await mkdir(join(raiz, 'docs', 'clasificador'), { recursive: true });
});

afterEach(async () => {
  await rm(raiz, { recursive: true, force: true });
});

describe('rutas de los scripts del clasificador', () => {
  it('acepta una ruta dentro del repositorio con la extensión pedida', () => {
    expect(rutaDentroDe(raiz, 'datos/conjunto.jsonl', '.jsonl')).toBe(
      join(raiz, 'datos', 'conjunto.jsonl'),
    );
  });

  it.each([
    ['sale del repositorio', '../fuera.jsonl'],
    ['es absoluta y está fuera', join(tmpdir(), 'otro', 'x.jsonl')],
    ['es la raíz misma', '.'],
    ['no tiene la extensión', 'datos/conjunto.txt'],
  ])('rechaza una ruta que %s', (_caso, argumento) => {
    expect(() => rutaDentroDe(raiz, argumento, '.jsonl')).toThrow();
  });

  it('el conjunto sintético y el informe están dentro del repositorio', () => {
    expect(() => rutaDentroDe(RAIZ_DEL_REPOSITORIO, CONJUNTO_SINTETICO, '.jsonl')).not.toThrow();
    expect(() => rutaDentroDe(RAIZ_DEL_REPOSITORIO, INFORME, '.md')).not.toThrow();
  });
});

describe('scripts del clasificador (HU-10)', () => {
  it('HU-10: evalúa un conjunto y escribe el informe en docs/clasificador', async () => {
    const lineas = Array.from({ length: 40 }, (_, i) =>
      JSON.stringify(
        i % 2 === 0
          ? { texto: `Visita https://spam${i}.example`, etiqueta: 'SOSPECHOSO' }
          : { texto: `Bloqueo número ${i} en la avenida`, etiqueta: 'NORMAL' },
      ),
    );
    await writeFile(join(raiz, 'conjunto.jsonl'), lineas.join('\n'));

    const resultado = await evaluarYEscribirInforme({
      raiz,
      conjunto: 'conjunto.jsonl',
      fecha: new Date('2026-10-20T12:00:00Z'),
    });

    const informe = await readFile(join(raiz, INFORME), 'utf8');
    expect(resultado.clasificador).toBe('reglas-v1');
    expect(informe).toContain('el 2026-10-20');
    expect(informe).toContain('`conjunto.jsonl`, 40 ejemplos');
  });

  it('no lee un conjunto fuera del repositorio', async () => {
    await expect(
      evaluarYEscribirInforme({ raiz, conjunto: '../../etc/passwd.jsonl', fecha: new Date() }),
    ).rejects.toThrow('dentro del repositorio');
  });

  it('HU-10: exporta el conjunto etiquetado en JSON Lines', async () => {
    const cantidad = await exportarConjunto({
      raiz,
      destino: 'exportado.jsonl',
      fuente: {
        decisiones: () =>
          Promise.resolve([
            { accion: 'RECHAZAR', descripcion: 'Promo en https://x.example' },
            { accion: 'MANTENER', descripcion: 'Bloqueo en la Pérez' },
          ]),
      },
    });

    expect(cantidad).toBe(2);
    expect(await readFile(join(raiz, 'exportado.jsonl'), 'utf8')).toBe(
      '{"texto":"Promo en https://x.example","etiqueta":"SOSPECHOSO"}\n' +
        '{"texto":"Bloqueo en la Pérez","etiqueta":"NORMAL"}\n',
    );
  });
});
