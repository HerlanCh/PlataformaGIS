import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';

type Manejador = (dato?: unknown) => void;

const socket = vi.hoisted(() => {
  const manejadores = new Map<string, (dato?: unknown) => void>();
  return {
    manejadores,
    on: vi.fn((evento: string, manejador: (dato?: unknown) => void) => {
      manejadores.set(evento, manejador);
    }),
    close: vi.fn(),
  };
});

vi.mock('socket.io-client', () => ({ io: vi.fn(() => socket) }));

const emitir = (evento: string, dato?: unknown) =>
  act(() => (socket.manejadores.get(evento) as Manejador)(dato));

describe('PWA mínima', () => {
  beforeEach(() => {
    socket.manejadores.clear();
    socket.close.mockClear();
  });

  afterEach(cleanup);

  it('muestra el mapa centrado en La Paz', () => {
    const { container } = render(<App apiUrl="http://api.test" />);

    expect(screen.getByRole('application', { name: 'Mapa de incidentes' })).toBeTruthy();
    expect(container.querySelector('.leaflet-container')).not.toBeNull();
  });

  it('empieza sin conexión y a la espera del primer ping', () => {
    render(<App apiUrl="http://api.test" />);

    expect(screen.getByRole('status').textContent).toContain('Sin conexión');
    expect(screen.getByRole('status').textContent).toContain('Esperando el primer ping');
  });

  it('muestra el último ping recibido', () => {
    render(<App apiUrl="http://api.test" />);

    emitir('connect');
    emitir('ping', { seq: 7, at: '2026-10-11T16:30:00Z' });

    const estado = screen.getByRole('status').textContent;
    expect(estado).toContain('Conectado');
    expect(estado).toContain('Ping n.º 7');
    // 16:30 UTC son las 12:30 en La Paz.
    expect(estado).toContain('12:30');
  });

  it('avisa cuando se pierde la conexión y conserva el último ping', () => {
    render(<App apiUrl="http://api.test" />);
    emitir('ping', { seq: 3, at: '2026-10-11T16:30:00Z' });

    emitir('disconnect');

    const estado = screen.getByRole('status').textContent;
    expect(estado).toContain('Sin conexión');
    expect(estado).toContain('Ping n.º 3');
  });

  it('cierra la conexión al desmontar', () => {
    const { unmount } = render(<App apiUrl="http://api.test" />);

    unmount();

    expect(socket.close).toHaveBeenCalledOnce();
  });
});
