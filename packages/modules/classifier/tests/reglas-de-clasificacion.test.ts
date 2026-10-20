import { describe, expect, it } from 'vitest';
import {
  clasificarPorReglas,
  PESOS,
  UMBRAL_DE_FRECUENCIA,
  UMBRAL_DE_SOSPECHA,
} from '../domain/reglas-de-clasificacion.js';

const conTexto = (descripcion: string | null, reportesRecientesDelAutor = 1) =>
  clasificarPorReglas({ descripcion, reportesRecientesDelAutor });

describe('reglas de clasificación (HU-10)', () => {
  it.each([
    'Visita https://ofertas.example para más info',
    'entra a www.promos-lapaz.net',
    'info en bloqueos.bo',
  ])('HU-10: marca un reporte con un enlace: «%s»', (texto) => {
    const resultado = conTexto(texto);

    expect(resultado.sospechoso).toBe(true);
    expect(resultado.motivos).toContain('ENLACE');
  });

  it.each([
    'GANA un premio GRATIS',
    'Promoción de préstamos al instante',
    'vendo celulares baratos',
  ])('HU-10: marca un reporte con palabras de spam: «%s»', (texto) => {
    const resultado = conTexto(texto);

    expect(resultado.sospechoso).toBe(true);
    expect(resultado.motivos).toContain('SPAM');
  });

  it.each([
    'el conductor llama al 71234567',
    'llamen al +591 76543210',
    'número +59162345678',
    'escriban a juan.perez@correo.com',
    'su CI 4567890 está en la billetera',
    'el auto con placa 2345-ABC chocó',
    'minibús 1234XYZ',
  ])('ética: marca los datos de una persona: «%s»', (texto) => {
    const resultado = conTexto(texto);

    expect(resultado.motivos).toContain('DATOS_PERSONALES');
    expect(resultado.sospechoso).toBe(true);
  });

  it.each([
    'Bloqueo total en la avenida 6 de Agosto, a 500 mts de la plaza',
    'Choque entre dos minibuses en la Buenos Aires, hay tráfico',
    'Poste de luz caído sobre la acera desde las 17:30',
    'Jauría de 8 perros en la calle 21 de Calacoto',
    'Desvío por obras a 120 kms de la ciudad, 2 hrs de espera',
    'Asalto a un transeúnte cerca del mercado Rodríguez, tengan cuidado',
  ])('HU-10: no marca una descripción normal: «%s»', (texto) => {
    expect(conTexto(texto)).toEqual({ sospechoso: false, motivos: [], puntaje: 0 });
  });

  it('HU-10: un reporte sin descripción solo se juzga por la frecuencia del autor', () => {
    expect(conTexto(null)).toEqual({ sospechoso: false, motivos: [], puntaje: 0 });
    expect(conTexto(null, UMBRAL_DE_FRECUENCIA)).toEqual({
      sospechoso: true,
      motivos: ['FRECUENCIA_DEL_AUTOR'],
      puntaje: PESOS.FRECUENCIA_DEL_AUTOR,
    });
    expect(conTexto(null, UMBRAL_DE_FRECUENCIA - 1).sospechoso).toBe(false);
  });

  it('un texto repetitivo o de longitud anormal suma, pero no basta solo', () => {
    expect(conTexto('aaaaaaa')).toMatchObject({
      sospechoso: false,
      motivos: ['TEXTO_REPETITIVO'],
    });
    expect(conTexto('xd')).toMatchObject({ sospechoso: false, motivos: ['LONGITUD_ANORMAL'] });
    expect(
      conTexto('bloqueo bloqueo bloqueo bloqueo bloqueo bloqueo bloqueo bloqueo').motivos,
    ).toEqual(['TEXTO_REPETITIVO']);
    expect(conTexto(`hola ${'abcdefghij'.repeat(5)}`).motivos).toEqual(['LONGITUD_ANORMAL']);
    // Dos indicios débiles juntos sí llegan al umbral.
    expect(conTexto('a'.repeat(45))).toMatchObject({
      sospechoso: true,
      motivos: ['TEXTO_REPETITIVO', 'LONGITUD_ANORMAL'],
    });
  });

  it('el puntaje suma los pesos sin pasar de 1', () => {
    const resultado = conTexto('GRATIS en https://x.com llama al 71234567', UMBRAL_DE_FRECUENCIA);

    expect(resultado.motivos).toEqual([
      'ENLACE',
      'SPAM',
      'DATOS_PERSONALES',
      'FRECUENCIA_DEL_AUTOR',
    ]);
    expect(resultado.puntaje).toBe(1);
    expect(UMBRAL_DE_SOSPECHA).toBeLessThanOrEqual(1);
  });
});
