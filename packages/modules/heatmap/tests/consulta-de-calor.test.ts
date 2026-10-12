import { describe, expect, it } from 'vitest';
import {
  cuadriculaPara,
  ErrorConsultaDeCalorInvalida,
  pasoDeCuadricula,
  TAMANO_CELDA_M,
  UMBRAL_ANONIMATO,
  validarConsultaDeCalor,
} from '../domain/consulta-de-calor.js';
import type { ConsultaDeCalor } from '../domain/consulta-de-calor.js';

const base: ConsultaDeCalor = {
  caja: { latitudMin: -16.52, latitudMax: -16.48, longitudMin: -68.16, longitudMax: -68.12 },
  tamanoCeldaM: 500,
  desde: new Date('2026-10-01T00:00:00Z'),
  hasta: new Date('2026-10-12T00:00:00Z'),
  categorias: [],
};

describe('validarConsultaDeCalor', () => {
  it('HU-06: el umbral de anonimato es de 3 reportes por celda', () => {
    expect(UMBRAL_ANONIMATO).toBe(3);
  });

  it('acepta una consulta válida', () => {
    expect(() => validarConsultaDeCalor(base)).not.toThrow();
  });

  it.each([TAMANO_CELDA_M.min, TAMANO_CELDA_M.max])(
    'acepta el tamaño de celda límite %d m',
    (m) => {
      expect(() => validarConsultaDeCalor({ ...base, tamanoCeldaM: m })).not.toThrow();
    },
  );

  it.each([
    ['una celda menor al mínimo', { tamanoCeldaM: TAMANO_CELDA_M.min - 1 }],
    ['una celda mayor al máximo', { tamanoCeldaM: TAMANO_CELDA_M.max + 1 }],
    ['una celda con decimales', { tamanoCeldaM: 250.5 }],
    ['una celda no numérica', { tamanoCeldaM: Number.NaN }],
    ['un rango de fechas invertido', { desde: base.hasta, hasta: base.desde }],
    ['una fecha inválida', { desde: new Date('no es una fecha') }],
    ['una caja invertida', { caja: { ...base.caja, latitudMin: -16.4, latitudMax: -16.5 } }],
  ])('HU-06: rechaza %s', (_nombre, cambios) => {
    expect(() => validarConsultaDeCalor({ ...base, ...cambios })).toThrow(
      ErrorConsultaDeCalorInvalida,
    );
  });
});

describe('cuadrícula del mapa de calor', () => {
  it('HU-06: el paso depende solo del tamaño de la celda', () => {
    const paso = pasoDeCuadricula(500);

    // 500 m son unos 0,0045° de latitud; en longitud algo más, por el coseno de la latitud.
    expect(paso.latitud).toBeCloseTo(500 / 111_195, 12);
    expect(paso.longitud).toBeGreaterThan(paso.latitud);
    expect(pasoDeCuadricula(1000).latitud).toBeCloseTo(paso.latitud * 2, 12);
  });

  it('HU-06: dos ventanas distintas comparten la misma cuadrícula', () => {
    const otra = { ...base.caja, latitudMin: -16.6, latitudMax: -16.55 };

    expect(cuadriculaPara(otra, 500).paso).toEqual(cuadriculaPara(base.caja, 500).paso);
  });

  it('HU-06: los centros de celda son múltiplos del paso', () => {
    const { paso, centros } = cuadriculaPara(base.caja, 500);
    const esMultiplo = (valor: number, lado: number) =>
      Math.abs(valor / lado - Math.round(valor / lado)) < 1e-6;

    expect(esMultiplo(centros.latitudMin, paso.latitud)).toBe(true);
    expect(esMultiplo(centros.latitudMax, paso.latitud)).toBe(true);
    expect(esMultiplo(centros.longitudMin, paso.longitud)).toBe(true);
    expect(esMultiplo(centros.longitudMax, paso.longitud)).toBe(true);
  });

  it('HU-06: la envolvente cubre la ventana con celdas enteras', () => {
    const { paso, centros, envolvente } = cuadriculaPara(base.caja, 500);

    expect(envolvente.latitudMin).toBeLessThanOrEqual(base.caja.latitudMin);
    expect(envolvente.latitudMax).toBeGreaterThanOrEqual(base.caja.latitudMax);
    expect(envolvente.longitudMin).toBeLessThanOrEqual(base.caja.longitudMin);
    expect(envolvente.longitudMax).toBeGreaterThanOrEqual(base.caja.longitudMax);
    expect(envolvente.latitudMin).toBeCloseTo(centros.latitudMin - paso.latitud / 2, 12);
    expect(envolvente.longitudMax).toBeCloseTo(centros.longitudMax + paso.longitud / 2, 12);
  });
});
