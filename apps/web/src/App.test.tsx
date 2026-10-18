import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';
import { useEstado } from './estado.js';
import { reiniciarAlmacen } from './services/almacen.js';

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    connect: vi.fn(),
    close: vi.fn(),
    connected: false,
  })),
}));

const LA_PAZ = { coords: { latitude: -16.4955, longitude: -68.1336 } };
const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

let sinSenal = false;
let reportesDeLaVentana: unknown[] = [];
const reportesEnviados: unknown[] = [];

function api(entrada: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new Request(entrada, init).url;
  if (sinSenal) return Promise.reject(new TypeError('Failed to fetch'));
  if (url.includes('/v1/dispositivos')) {
    return Promise.resolve(
      json({
        idUsuario: '11111111-1111-4111-8111-111111111111',
        rol: 'CIUDADANO',
        esNuevo: true,
        token: 'tok',
        expiraEn: new Date(Date.now() + 86_400_000).toISOString(),
      }),
    );
  }
  if (url.includes('/v1/reportes') && init?.method === 'POST') {
    reportesEnviados.push(JSON.parse(String(init.body)));
    return Promise.resolve(
      json(
        {
          resultado: 'CREADO',
          reporte: {
            id: '22222222-2222-4222-8222-222222222222',
            codigoCategoria: 'bloqueo',
            estado: 'ACTIVO',
            publicLocation: { latitud: -16.4955, longitud: -68.1336 },
            creadoEn: '2026-10-18T12:00:00.000Z',
            caducaEn: '2026-10-18T18:00:00.000Z',
          },
        },
        201,
      ),
    );
  }
  return Promise.resolve(json({ reportes: reportesDeLaVentana }));
}

function montar() {
  const consulta = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={consulta}>
      <App />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  reiniciarAlmacen();
  sinSenal = false;
  reportesDeLaVentana = [];
  reportesEnviados.length = 0;
  useEstado.setState({
    hojaAbierta: false,
    pendientes: 0,
    aviso: null,
    posicion: null,
    ventana: null,
  });
  vi.stubGlobal('fetch', vi.fn(api));
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: (ok: (p: unknown) => void) => ok(LA_PAZ) },
  });
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** La hoja de categorías se descarga al abrirla: se espera a que aparezca. */
const reportarBloqueo = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Reportar' }));
  fireEvent.click(await screen.findByRole('button', { name: /Bloqueo o protesta vial/ }));
};

describe('PWA: mapa en vivo y reporte en dos toques', () => {
  it('HU-08: al tocar un aviso, la app abre el reporte y limpia la URL', async () => {
    reportesDeLaVentana = [
      {
        id: '33333333-3333-4333-8333-333333333333',
        codigoCategoria: 'bloqueo',
        estado: 'ACTIVO',
        publicLocation: { latitud: -16.4955, longitud: -68.1336 },
        creadoEn: '2026-10-18T12:00:00.000Z',
        caducaEn: '2026-10-18T18:00:00.000Z',
      },
    ];
    globalThis.history.pushState(
      null,
      '',
      '/?reporte=33333333-3333-4333-8333-333333333333&lat=-16.4955&lon=-68.1336',
    );
    montar();

    expect(await screen.findByRole('heading', { name: 'Bloqueo o protesta vial' })).toBeTruthy();
    expect(globalThis.location.search).toBe('');
    expect(useEstado.getState().destino).toBeNull();
  });

  it('muestra el mapa de OpenStreetMap y el panel «Cerca de ti»', async () => {
    const { container } = montar();

    expect(screen.getByRole('application', { name: 'Mapa de incidentes' })).toBeTruthy();
    expect(container.querySelector('.leaflet-container')).not.toBeNull();
    expect(await screen.findByText(/Todo tranquilo/)).toBeTruthy();
  });

  it('HU-01: dos toques envían el reporte con la ubicación del GPS', async () => {
    montar();

    await reportarBloqueo();

    expect(await screen.findByText('Reporte enviado. Ya aparece en el mapa.')).toBeTruthy();
    expect(reportesEnviados).toEqual([
      { codigoCategoria: 'bloqueo', latitud: -16.4955, longitud: -68.1336 },
    ]);
  });

  it('HU-05: sin señal el reporte queda pendiente y se envía al volver la conexión', async () => {
    montar();
    sinSenal = true;

    await reportarBloqueo();

    expect(await screen.findByText(/Sin señal: tu reporte se enviará solo/)).toBeTruthy();
    expect(await screen.findByText('1 reporte pendiente de envío')).toBeTruthy();

    sinSenal = false;
    window.dispatchEvent(new Event('online'));

    expect(await screen.findByText('Reporte enviado. Ya aparece en el mapa.')).toBeTruthy();
    expect(reportesEnviados).toHaveLength(1);
    expect(screen.queryByText(/pendiente de envío/)).toBeNull();
  });

  it('sin permiso de ubicación explica cómo activarla', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (_ok: unknown, fallo: (e: unknown) => void) => fallo({ code: 1 }),
      },
    });
    montar();

    await reportarBloqueo();

    expect(await screen.findByText(/Activa la ubicación para reportar/)).toBeTruthy();
    expect(reportesEnviados).toEqual([]);
  });
});
