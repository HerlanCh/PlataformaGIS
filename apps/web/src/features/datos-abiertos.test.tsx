import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { infracciones } from '../pruebas/axe.js';
import { pantallaDe } from '../Raiz.js';
import { obtenerResumen, porcentaje, urlDelCsv } from '../services/datos-abiertos.js';
import type { ResumenDatosAbiertos } from '../services/datos-abiertos.js';
import { Encabezado } from '../ui/Encabezado.js';
import { PantallaDeDatosAbiertos } from './datos-abiertos/PantallaDeDatosAbiertos.js';

const LICENCIA = {
  nombre: 'CC BY 4.0',
  url: 'https://creativecommons.org/licenses/by/4.0/deed.es',
  atribucion: 'Alerta LP, plataforma comunitaria de La Paz y El Alto',
};

const resumen = (cambios: Partial<ResumenDatosAbiertos> = {}): ResumenDatosAbiertos => ({
  total: 8,
  confirmados: 6,
  porCategoria: [
    { codigoCategoria: 'bloqueo', cantidad: 5 },
    { codigoCategoria: 'robo', cantidad: 3 },
  ],
  porHoraDelDia: Array.from({ length: 24 }, (_, h) => (h === 18 ? 4 : h === 8 ? 4 : 0)),
  desde: '2026-10-01T12:00:00.000Z',
  hasta: '2026-10-19T12:00:00.000Z',
  licencia: LICENCIA,
  ...cambios,
});

function api(respuesta: () => Response) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => respuesta()),
  );
}

const montar = (hijo: ReactNode) => {
  const consulta = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={consulta}>{hijo}</QueryClientProvider>);
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('portal de datos abiertos (HU-11)', () => {
  it('la ruta /datos-abiertos abre su pantalla', () => {
    expect(pantallaDe('/datos-abiertos')).not.toBeNull();
  });

  it('HU-11: muestra los tableros, la descarga del CSV y la licencia de forma visible', async () => {
    api(() => Response.json(resumen()));
    const { container } = montar(<PantallaDeDatosAbiertos />);

    expect(await screen.findByText('75 %')).toBeTruthy();
    expect(screen.getByText('8')).toBeTruthy();
    expect(screen.getByText('Incidentes por línea')).toBeTruthy();
    expect(screen.getByText('18 h: 4 reportes')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Descargar CSV/ }).getAttribute('href')).toMatch(
      /\/v1\/datos-abiertos\.csv$/,
    );
    const licencia = screen.getByRole('link', { name: 'CC BY 4.0' });
    expect(licencia.getAttribute('href')).toBe(LICENCIA.url);
    expect(licencia.getAttribute('rel')).toContain('license');
    expect(await infracciones(container)).toEqual([]);
  });

  it('sin reportes terminados lo dice, y aun así ofrece la descarga y la licencia', async () => {
    api(() =>
      Response.json(
        resumen({
          total: 0,
          confirmados: 0,
          porCategoria: [],
          porHoraDelDia: Array.from({ length: 24 }, () => 0),
          desde: null,
          hasta: null,
        }),
      ),
    );
    montar(<PantallaDeDatosAbiertos />);

    expect(
      await screen.findByText('Todavía no hay reportes terminados para publicar.'),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'CC BY 4.0' })).toBeTruthy();
  });

  it('si el resumen no carga, ofrece reintentar', async () => {
    api(() => new Response('{}', { status: 503 }));
    montar(<PantallaDeDatosAbiertos />);

    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeTruthy();
    await expect(obtenerResumen('http://api', fetch)).rejects.toThrow('503');
  });

  it('calcula porcentajes y la dirección del CSV', () => {
    expect(porcentaje(6, 8)).toBe(75);
    expect(porcentaje(0, 0)).toBeNull();
    expect(urlDelCsv('http://api')).toBe('http://api/v1/datos-abiertos.csv');
  });

  it('la cabecera lleva a los datos abiertos a cualquier persona', () => {
    render(<Encabezado />);

    expect(screen.getByRole('link', { name: 'Datos abiertos' }).getAttribute('href')).toBe(
      '/datos-abiertos',
    );
  });
});
