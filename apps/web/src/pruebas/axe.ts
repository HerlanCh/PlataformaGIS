import axe from 'axe-core';

/** Infracciones de accesibilidad (axe-core) de un fragmento renderizado. */
export async function infracciones(elemento: Element): Promise<string[]> {
  const resultado = await axe.run(elemento, {
    // jsdom no calcula colores ni diseño: el contraste se revisa en el navegador (Lighthouse, 8c).
    rules: { 'color-contrast': { enabled: false } },
  });
  return resultado.violations.map((v) => `${v.id}: ${v.help}`);
}
