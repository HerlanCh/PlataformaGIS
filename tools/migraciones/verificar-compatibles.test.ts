import { describe, expect, it } from 'vitest';
import { analizarMigracion } from './verificar-compatibles.mjs';

describe('Migraciones compatibles hacia atrás (roadmap 12)', () => {
  it('RNF-07: agregar tablas, columnas e índices es compatible', () => {
    const sql = [
      'CREATE TABLE "zonas" ("id" uuid PRIMARY KEY);',
      'ALTER TABLE "reportes" ADD COLUMN "nota" text;',
      'DROP INDEX "reportes_ubicacion_idx";',
      'CREATE INDEX "reportes_autor_idx" ON "reportes" ("id_autor");',
    ].join('--> statement-breakpoint\n');

    expect(analizarMigracion(sql)).toEqual([]);
  });

  it.each([
    ['borrar tabla', 'DROP TABLE "zonas";'],
    ['borrar columna', 'ALTER TABLE "reportes" DROP COLUMN "nota";'],
    ['renombrar', 'ALTER TABLE "reportes" RENAME COLUMN "nota" TO "texto";'],
    ['cambiar tipo', 'ALTER TABLE "reportes" ALTER COLUMN "nota" SET DATA TYPE varchar(80);'],
    ['cambiar tipo', 'alter table reportes alter column nota type varchar(80);'],
    ['exigir no nulo', 'ALTER TABLE "reportes" ALTER COLUMN "nota" SET NOT NULL;'],
  ])('RNF-07: detecta «%s» sin justificar', (operacion, sql) => {
    expect(analizarMigracion(sql).map((hallazgo) => hallazgo.operacion)).toEqual([operacion]);
  });

  it('RNF-07: una sentencia justificada con `-- compatible:` pasa', () => {
    const sql =
      '-- compatible: la API dejó de leer «nota» en la v2.10\nALTER TABLE "reportes" DROP COLUMN "nota";';

    expect(analizarMigracion(sql)).toEqual([]);
  });

  it('RNF-07: la justificación de una sentencia no cubre a la siguiente', () => {
    const sql = ['-- compatible: tabla sin uso\nDROP TABLE "viejas";', 'DROP TABLE "zonas";'].join(
      '--> statement-breakpoint\n',
    );

    expect(analizarMigracion(sql).map((h) => h.sentencia)).toEqual(['DROP TABLE "zonas";']);
  });

  it('RNF-07: el texto de un comentario no cuenta como SQL', () => {
    expect(analizarMigracion('-- antes se hacía drop column\nSELECT 1;')).toEqual([]);
  });
});
