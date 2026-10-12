import { cargarInterruptores, migracionesDePlataforma } from '@gis/platform';
import type { DefinicionDeModulo } from '@gis/platform';
import { describe, expect, it } from 'vitest';
import { conjuntosDeMigraciones } from './migrations.js';

const modulo = (name: string, conMigraciones = true): DefinicionDeModulo => ({
  nombre: name,
  registrar: () => {},
  ...(conMigraciones ? { migraciones: { nombre: name, carpeta: `/migraciones/${name}` } } : {}),
});

const nombres = (env: Record<string, string>, modules: DefinicionDeModulo[]) =>
  conjuntosDeMigraciones(cargarInterruptores(env), modules).map((conjunto) => conjunto.nombre);

describe('migrationSets', () => {
  it('la plataforma va siempre primero', () => {
    expect(conjuntosDeMigraciones(cargarInterruptores({}), [])).toEqual([migracionesDePlataforma]);
    expect(nombres({}, [modulo('reports')])).toEqual(['platform', 'reports']);
  });

  it('incluye los módulos imprescindibles aunque no haya interruptores', () => {
    expect(nombres({}, [modulo('identity'), modulo('reports'), modulo('verification')])).toEqual([
      'platform',
      'identity',
      'reports',
      'verification',
    ]);
  });

  it('un módulo opcional apagado no aplica sus migraciones', () => {
    const modules = [modulo('reports'), modulo('subscriptions')];

    expect(nombres({ FEATURE_SUBSCRIPTIONS: 'false' }, modules)).toEqual(['platform', 'reports']);
    expect(nombres({}, modules)).toEqual(['platform', 'reports']);
    expect(nombres({ FEATURE_SUBSCRIPTIONS: 'true' }, modules)).toEqual([
      'platform',
      'reports',
      'subscriptions',
    ]);
  });

  it('omite los módulos que no tienen tablas', () => {
    expect(nombres({}, [modulo('reports', false)])).toEqual(['platform']);
  });
});
