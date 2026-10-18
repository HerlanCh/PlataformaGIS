import { act, render, waitFor } from '@testing-library/react';
import L from 'leaflet';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CENTRO_LA_PAZ } from '../../domain/geo.js';
import { useEstado } from '../../estado.js';
import type { Zona } from '../../services/zonas.js';
import { Mapa } from './Mapa.js';
import type { Calor } from './Mapa.js';

// `leaflet.heat` dibuja en un canvas que jsdom no tiene: se reemplaza por una capa vacía.
const calorFalso = vi.hoisted(() => ({
  capa: null as null | { setLatLngs: ReturnType<typeof vi.fn> },
}));
vi.mock('leaflet.heat', async () => {
  const { default: Leaflet } = await import('leaflet');
  Object.assign(Leaflet, {
    heatLayer: () => {
      const capa = Object.assign(Leaflet.layerGroup(), { setLatLngs: vi.fn() });
      calorFalso.capa = capa;
      return capa;
    },
  });
  return {};
});

const zona: Zona = {
  id: '44444444-4444-4444-8444-444444444444',
  centro: CENTRO_LA_PAZ,
  radioM: 800,
  categorias: ['bloqueo'],
  creadoEn: '2026-10-18T12:00:00.000Z',
};

const SIN_CALOR: Calor = { celdas: null, cargando: false, fallo: false };

beforeEach(() => {
  calorFalso.capa = null;
  useEstado.setState({
    capa: 'incidentes',
    zonaEnEdicion: null,
    calorDisponible: true,
    posicion: null,
    enfoque: null,
  });
});

describe('capas del mapa', () => {
  it('HU-07: dibuja cada zona suscrita como un círculo de su radio', () => {
    const circulo = vi.spyOn(L, 'circle');

    render(<Mapa reportes={[]} calor={SIN_CALOR} zonas={[zona]} />);

    expect(circulo).toHaveBeenCalledWith(
      [CENTRO_LA_PAZ.latitud, CENTRO_LA_PAZ.longitud],
      expect.objectContaining({ radius: 800, className: 'zona-suscrita' }),
    );
    circulo.mockRestore();
  });

  it('HU-07: en modo de dibujo muestra la mira, toma el centro del mapa y sigue el radio', () => {
    useEstado.setState({ zonaEnEdicion: { radioM: 500, centro: null } });
    const { container } = render(<Mapa reportes={[]} calor={SIN_CALOR} zonas={[]} />);

    expect(container.querySelector('.mira')).not.toBeNull();
    expect(container.querySelector('.mapa__herramientas')).toBeNull();
    const centro = useEstado.getState().zonaEnEdicion?.centro;
    expect(centro?.latitud).toBeCloseTo(CENTRO_LA_PAZ.latitud, 3);

    act(() => useEstado.getState().fijarRadio(900));
    act(() => useEstado.getState().terminarZona());
    expect(container.querySelector('.mira')).toBeNull();
  });

  it('HU-03: deja a la vista la estación por la que pregunta el «¿Sigue ahí?»', () => {
    const desplazar = vi.spyOn(L.Map.prototype, 'panInside');
    render(<Mapa reportes={[]} calor={SIN_CALOR} zonas={[]} />);

    act(() => useEstado.getState().enfocar({ latitud: -16.49, longitud: -68.13 }));

    expect(desplazar).toHaveBeenCalledWith([-16.49, -68.13], expect.any(Object));
    desplazar.mockRestore();
  });

  it('HU-03: deja a la vista la estación por la que pregunta el «¿Sigue ahí?»', () => {
    const desplazar = vi.spyOn(L.Map.prototype, 'panInside');
    render(<Mapa reportes={[]} calor={SIN_CALOR} zonas={[]} />);

    act(() => useEstado.getState().enfocar({ latitud: -16.49, longitud: -68.13 }));

    expect(desplazar).toHaveBeenCalledWith([-16.49, -68.13], expect.any(Object));
    desplazar.mockRestore();
  });

  it('HU-06: con el historial activo dibuja el calor y muestra su barra', async () => {
    useEstado.setState({ capa: 'calor' });
    const calor: Calor = {
      celdas: [{ latitud: -16.5, longitud: -68.13, cantidad: 4 }],
      cargando: false,
      fallo: false,
    };
    const { container, rerender } = render(<Mapa reportes={[]} calor={calor} zonas={[]} />);

    await waitFor(() =>
      expect(calorFalso.capa?.setLatLngs).toHaveBeenCalledWith([[-16.5, -68.13, 1]]),
    );
    expect(container.querySelector('.barra-calor')).not.toBeNull();

    act(() => useEstado.setState({ capa: 'incidentes' }));
    rerender(<Mapa reportes={[]} calor={SIN_CALOR} zonas={[]} />);
    expect(container.querySelector('.barra-calor')).toBeNull();
  });
});
