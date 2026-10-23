import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { infracciones } from '../pruebas/axe.js';
import { pantallaDe } from '../Raiz.js';
import { PantallaDePrivacidad, PantallaDeTerminos } from './legal/PantallasLegales.js';

describe('Privacidad y términos (roadmap 12)', () => {
  it('las rutas /privacidad y /terminos abren sus pantallas', () => {
    expect(pantallaDe('/privacidad')).not.toBeNull();
    expect(pantallaDe('/terminos/')).not.toBeNull();
  });

  it.each([
    ['privacidad', PantallaDePrivacidad],
    ['términos', PantallaDeTerminos],
  ])(
    'las dos pantallas recuerdan que la app no reemplaza a las emergencias (%s)',
    (_, Pantalla) => {
      render(<Pantalla />);

      expect(screen.getByRole('note').textContent).toMatch(
        /no reemplaza a las líneas de emergencia/,
      );
      expect(screen.getByRole('note').textContent).toMatch(/110/);
    },
  );

  it('RNF-14: la privacidad dice qué se publica y que el autor nunca se ve', async () => {
    const { container } = render(<PantallaDePrivacidad />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Privacidad');
    expect(container.textContent).toMatch(/Nadie más ve quién hizo el reporte/);
    expect(container.textContent).toMatch(/En los robos solo se muestra el centro/);
    expect(container.textContent).toMatch(/La descripción no se publica/);
    expect(screen.getByRole('link', { name: 'Términos de uso' }).getAttribute('href')).toBe(
      '/terminos',
    );
    expect(await infracciones(container)).toEqual([]);
  });

  it('los términos prohíben fotos y descripciones de personas y datos de terceros', async () => {
    const { container } = render(<PantallaDeTerminos />);

    expect(container.textContent).toMatch(/No describir ni identificar a personas/);
    expect(container.textContent).toMatch(/fotos/);
    expect(container.textContent).toMatch(/datos de terceros/);
    expect(screen.getByRole('link', { name: 'Privacidad' }).getAttribute('href')).toBe(
      '/privacidad',
    );
    expect(await infracciones(container)).toEqual([]);
  });
});
