import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CENTRO_LA_PAZ } from '../domain/geo.js';
import type { ReportePublico } from '../domain/reportes.js';
import { useEstado } from '../estado.js';
import { infracciones } from '../pruebas/axe.js';
import { Avisos } from '../ui/Avisos.js';
import { Encabezado } from '../ui/Encabezado.js';
import { PanelCerca } from './cerca/PanelCerca.js';
import { HojaDeCategorias } from './reporte/HojaDeCategorias.js';
import { mensajeDeResultado, mensajeDeUbicacion } from './reporte/mensajes.js';

const reporte = (
  id: string,
  norteM: number,
  cambios: Partial<ReportePublico> = {},
): ReportePublico => ({
  id,
  codigoCategoria: 'bloqueo',
  estado: 'ACTIVO',
  publicLocation: {
    latitud: CENTRO_LA_PAZ.latitud + norteM / 111_195,
    longitud: CENTRO_LA_PAZ.longitud,
  },
  creadoEn: '2026-10-18T12:00:00.000Z',
  caducaEn: '2026-10-18T22:40:00.000Z',
  ...cambios,
});

const panel = (reportes: ReportePublico[], extra: Partial<Parameters<typeof PanelCerca>[0]> = {}) =>
  render(
    <PanelCerca
      reportes={reportes}
      desde={CENTRO_LA_PAZ}
      origen="gps"
      cargando={false}
      fallo={false}
      reintentar={vi.fn()}
      {...extra}
    />,
  );

beforeEach(() => {
  useEstado.setState({ hojaAbierta: false, pendientes: 0, aviso: null, conexion: 'conectando' });
  // jsdom no implementa <dialog>.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

describe('Cerca de ti (HU-02)', () => {
  // La vigencia muestra solo la hora si vence hoy: se fija el día de los reportes de ejemplo.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-18T16:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('lista los incidentes del más cercano al más lejano, con distancia, estado y vencimiento', () => {
    panel([
      reporte('lejos', 1200, { codigoCategoria: 'accidente' }),
      reporte('cerca', 300, { estado: 'CONFIRMADO' }),
    ]);

    const filas = screen.getAllByRole('listitem');
    expect(filas.map((f) => f.textContent)).toEqual([
      'BloqueoConfirmadoa 300 mhasta 18:40',
      'AccidenteSin confirmara 1,2 kmhasta 18:40',
    ]);
  });

  it('muestra hasta cuatro estaciones y resume el resto', () => {
    panel(Array.from({ length: 9 }, (_, i) => reporte(`r${i}`, i * 100)));

    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByText('y 5 incidentes más en el mapa')).toBeTruthy();
  });

  it('sin GPS no promete cercanía: mide desde el centro del mapa y ofrece usar la ubicación', () => {
    panel([reporte('a', 300)], { origen: 'mapa' });

    expect(screen.getByRole('heading', { name: 'En esta zona' })).toBeTruthy();
    expect(screen.getByText('a 300 m del centro')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Usar mi ubicación' })).toBeTruthy();
  });

  it('dice que todo está tranquilo si no hay incidentes', () => {
    panel([]);

    expect(screen.getByText(/Todo tranquilo en esta zona/)).toBeTruthy();
  });

  it('muestra la carga y, si falla, permite reintentar', () => {
    const reintentar = vi.fn();
    const { rerender } = panel([], { cargando: true });
    expect(screen.getByLabelText('Cargando incidentes')).toBeTruthy();

    rerender(
      <PanelCerca
        reportes={[]}
        desde={CENTRO_LA_PAZ}
        origen="gps"
        cargando={false}
        fallo
        reintentar={reintentar}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(reintentar).toHaveBeenCalledOnce();
  });

  it('HU-05: indica los reportes pendientes de envío', () => {
    useEstado.setState({ pendientes: 2 });
    panel([]);

    expect(screen.getByText('2 reportes pendientes de envío')).toBeTruthy();
  });

  it('el botón Reportar abre la hoja de categorías', () => {
    panel([]);

    fireEvent.click(screen.getByRole('button', { name: 'Reportar' }));

    expect(useEstado.getState().hojaAbierta).toBe(true);
  });

  it('no tiene infracciones de accesibilidad', async () => {
    const { container } = panel([reporte('a', 200)]);

    expect(await infracciones(container)).toEqual([]);
  });
});

describe('Hoja de categorías (HU-01: dos toques)', () => {
  it('ofrece las cinco categorías y envía la elegida', () => {
    const alElegir = vi.fn();
    useEstado.setState({ hojaAbierta: true });
    render(<HojaDeCategorias alElegir={alElegir} />);

    const botones = screen.getAllByRole('button', { name: /Línea/ });
    fireEvent.click(screen.getByRole('button', { name: /Bloqueo o protesta vial/ }));

    expect(botones).toHaveLength(5);
    expect(alElegir).toHaveBeenCalledWith('bloqueo');
  });

  it('se cierra con el botón, con un toque en el fondo y al cerrarse el diálogo', () => {
    useEstado.setState({ hojaAbierta: true });
    const { container } = render(<HojaDeCategorias alElegir={vi.fn()} />);
    const dialogo = container.querySelector('dialog')!;

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(useEstado.getState().hojaAbierta).toBe(false);
    expect(dialogo.hasAttribute('open')).toBe(false);

    act(() => useEstado.setState({ hojaAbierta: true }));
    fireEvent.click(dialogo);
    expect(useEstado.getState().hojaAbierta).toBe(false);

    act(() => useEstado.setState({ hojaAbierta: true }));
    fireEvent(dialogo, new Event('close'));
    expect(useEstado.getState().hojaAbierta).toBe(false);
  });

  it('no tiene infracciones de accesibilidad', async () => {
    useEstado.setState({ hojaAbierta: true });
    const { container } = render(<HojaDeCategorias alElegir={vi.fn()} />);

    expect(await infracciones(container)).toEqual([]);
  });
});

describe('Encabezado y avisos', () => {
  it('muestra el estado del tiempo real y la leyenda de las líneas', () => {
    useEstado.setState({ conexion: 'en-vivo' });
    render(<Encabezado />);

    expect(screen.getByText('En vivo')).toBeTruthy();
    expect(screen.getByRole('list', { name: /Líneas de la red/ }).children).toHaveLength(5);
  });

  it('un aviso se anuncia y desaparece solo', () => {
    vi.useFakeTimers();
    render(<Avisos />);

    act(() => useEstado.getState().avisar('exito', 'Reporte enviado.'));
    expect(screen.getByText('Reporte enviado.')).toBeTruthy();
    act(() => vi.advanceTimersByTime(6100));
    vi.useRealTimers();

    expect(screen.queryByText('Reporte enviado.')).toBeNull();
  });
});

describe('mensajes al reportar', () => {
  it.each([
    [{ tipo: 'CREADO', idReporte: 'r' } as const, 'exito', 'Reporte enviado'],
    [{ tipo: 'DUPLICADO', idReporte: 'r' } as const, 'exito', 'confirmación'],
    [{ tipo: 'PROPIO_EXISTENTE', idReporte: 'r' } as const, 'info', 'Ya tienes'],
    [{ tipo: 'PENDIENTE' } as const, 'info', 'Sin señal'],
    [
      { tipo: 'RECHAZADO', codigo: 'FUERA_DEL_AREA_DE_SERVICIO', reintentarEnS: null } as const,
      'problema',
      'La Paz y El Alto',
    ],
    [
      { tipo: 'RECHAZADO', codigo: 'LIMITE_EXCEDIDO', reintentarEnS: 130 } as const,
      'problema',
      'en 3 min',
    ],
    [
      { tipo: 'RECHAZADO', codigo: 'LIMITE_EXCEDIDO', reintentarEnS: null } as const,
      'problema',
      'de nuevo.',
    ],
    [{ tipo: 'RECHAZADO', codigo: 'OTRO', reintentarEnS: null } as const, 'problema', 'No se pudo'],
  ])('%o', (resultado, tono, texto) => {
    const mensaje = mensajeDeResultado(resultado);

    expect(mensaje.tono).toBe(tono);
    expect(mensaje.texto).toContain(texto);
  });

  it('distingue el permiso de ubicación denegado de otros fallos del GPS', () => {
    expect(mensajeDeUbicacion({ code: 1 } as GeolocationPositionError).texto).toContain(
      'Activa la ubicación',
    );
    expect(mensajeDeUbicacion(null).texto).toContain('No pudimos obtener');
  });
});
