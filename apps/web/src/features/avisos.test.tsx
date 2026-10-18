import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { destinoDeLaUrl } from '../App.js';
import { useEstado } from '../estado.js';
import { infracciones } from '../pruebas/axe.js';
import { reiniciarAlmacen } from '../services/almacen.js';
import { avisoDeReporte } from '../services/aviso.js';
import { aBytes, activarAvisos, desactivarAvisos, estadoDeAvisos } from '../services/push.js';
import { ActivarAvisos } from './avisos/ActivarAvisos.js';
import { HojaDeInstalar } from './instalar/HojaDeInstalar.js';
import {
  escucharInstalacion,
  formaDeInstalar,
  reiniciarInstalacion,
} from './instalar/instalacion.js';
import { OfertaDeInstalar } from './instalar/OfertaDeInstalar.js';

const API = 'http://api.test';
const ENDPOINT = 'https://push.example.org/abc';

const json = (cuerpo: unknown, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(cuerpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const pedidos: Request[] = [];
function api(clave: number = 200) {
  const pedir = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const s = new Request(entrada, init);
    pedidos.push(s.clone());
    if (s.url.endsWith('/v1/dispositivos')) {
      return json({
        idUsuario: '11111111-1111-4111-8111-111111111111',
        token: 'tok',
        expiraEn: new Date(Date.now() + 86_400_000).toISOString(),
      });
    }
    if (s.url.endsWith('/clave-publica')) return json({ clavePublica: 'AQID' }, clave);
    return json(null, 204);
  }) as unknown as typeof fetch;
  vi.stubGlobal('fetch', pedir);
  return pedir;
}

/** Un navegador con Web Push: service worker registrado, permiso y suscripción falsos. */
function navegadorConPush(permiso: NotificationPermission, suscrito = false) {
  let suscripcion: PushSubscription | null = suscrito ? falsa() : null;
  function falsa(): PushSubscription {
    return {
      endpoint: ENDPOINT,
      toJSON: () => ({ endpoint: ENDPOINT, keys: { p256dh: 'p', auth: 'a' } }),
      unsubscribe: vi.fn(() => {
        suscripcion = null;
        return Promise.resolve(true);
      }),
    } as unknown as PushSubscription;
  }
  const pushManager = {
    subscribe: vi.fn(() => {
      suscripcion = falsa();
      return Promise.resolve(suscripcion);
    }),
    getSubscription: () => Promise.resolve(suscripcion),
  };
  const registro = { pushManager };
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve(registro), getRegistration: () => Promise.resolve(registro) },
  });
  vi.stubGlobal('PushManager', function PushManager() {});
  vi.stubGlobal(
    'Notification',
    Object.assign(function Notification() {}, {
      permission: permiso,
      requestPermission: vi.fn(() => Promise.resolve('granted')),
    }),
  );
  return pushManager;
}

const montar = (hijo: ReactNode) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {hijo}
    </QueryClientProvider>,
  );

const agenteDeUsuario = (valor: string) =>
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: valor });

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  reiniciarAlmacen();
  reiniciarInstalacion();
  pedidos.length = 0;
  agenteDeUsuario('Mozilla/5.0 (Linux; Android 14) Chrome/130');
  useEstado.setState({ aviso: null, instalarAbierta: false, zonasAbiertas: false, destino: null });
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

describe('avisos Web Push del dispositivo (HU-08)', () => {
  it('HU-08: activar pide el permiso, se suscribe con la clave VAPID y registra el dispositivo', async () => {
    const pushManager = navegadorConPush('default');
    const pedir = api();

    expect(await activarAvisos(API, pedir)).toBe('activos');

    expect(pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: new Uint8Array([1, 2, 3]),
    });
    const alta = pedidos.find(
      (p) => p.method === 'POST' && p.url.endsWith('/v1/notificaciones/push'),
    )!;
    expect(await alta.json()).toEqual({ endpoint: ENDPOINT, keys: { p256dh: 'p', auth: 'a' } });
    expect(alta.headers.get('authorization')).toBe('Bearer tok');
  });

  it('HU-08: desactivar da de baja el endpoint en la API y en el navegador', async () => {
    navegadorConPush('granted', true);
    const pedir = api();

    expect(await desactivarAvisos(API, pedir)).toBe('inactivos');

    const baja = pedidos.find((p) => p.method === 'DELETE')!;
    expect(await baja.json()).toEqual({ endpoint: ENDPOINT });
  });

  it('si la persona niega el permiso, los avisos quedan bloqueados sin pedir nada a la API', async () => {
    navegadorConPush('default');
    vi.mocked(Notification.requestPermission).mockResolvedValueOnce('denied');
    const pedir = api();

    expect(await activarAvisos(API, pedir)).toBe('bloqueados');
    expect(pedidos).toEqual([]);
  });

  it('si la API no ofrece avisos (404), se informa', async () => {
    navegadorConPush('default');

    await expect(activarAvisos(API, api(404))).rejects.toMatchObject({ name: 'Error' });
  });

  it('el estado distingue activos, inactivos, bloqueados, sin soporte y iPhone sin instalar', async () => {
    navegadorConPush('granted', true);
    expect(await estadoDeAvisos()).toBe('activos');
    navegadorConPush('granted');
    expect(await estadoDeAvisos()).toBe('inactivos');
    navegadorConPush('denied');
    expect(await estadoDeAvisos()).toBe('bloqueados');
    navegadorConPush('default');
    expect(await estadoDeAvisos()).toBe('inactivos');

    agenteDeUsuario('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    expect(await estadoDeAvisos()).toBe('requiere-instalar');

    agenteDeUsuario('Mozilla/5.0 (Linux; Android 14)');
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: undefined });
    expect(await estadoDeAvisos()).toBe('no-compatible');
  });

  it('la clave en base64 de URL se convierte a bytes', () => {
    expect([...aBytes('-_8')]).toEqual([251, 255]);
  });

  it('HU-08: el botón activa los avisos y lo confirma', async () => {
    navegadorConPush('default');
    api();
    montar(<ActivarAvisos />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Activar avisos en este dispositivo' }),
    );

    expect(await screen.findByText('Avisos activados en este dispositivo.')).toBeTruthy();
    expect(useEstado.getState().aviso?.texto).toBe(
      'Listo: te avisaremos de incidentes en tus zonas.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar' }));
    expect(
      await screen.findByRole('button', { name: 'Activar avisos en este dispositivo' }),
    ).toBeTruthy();
  });

  it('si la API no ofrece avisos, el botón lo explica', async () => {
    navegadorConPush('default');
    api(404);
    montar(<ActivarAvisos />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Activar avisos en este dispositivo' }),
    );

    await waitFor(() =>
      expect(useEstado.getState().aviso?.texto).toBe('Los avisos no están disponibles por ahora.'),
    );
  });

  it('en iPhone sin instalar ofrece la ayuda para instalar', async () => {
    agenteDeUsuario('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    montar(<ActivarAvisos />);

    fireEvent.click(await screen.findByRole('button', { name: 'Cómo instalar' }));

    expect(useEstado.getState().instalarAbierta).toBe(true);
  });

  it('bloqueados: explica cómo permitirlos', async () => {
    navegadorConPush('denied');
    montar(<ActivarAvisos />);

    expect(await screen.findByText(/Bloqueaste los avisos de este sitio/)).toBeTruthy();
  });
});

describe('aviso push en el service worker (HU-08)', () => {
  it('HU-08: muestra la categoría, una etiqueta por reporte y abre el mapa en el reporte', () => {
    expect(
      avisoDeReporte({
        tipo: 'reporte-en-zona',
        idReporte: 'r1',
        codigoCategoria: 'bloqueo',
        publicLocation: { latitud: -16.5, longitud: -68.13 },
      }),
    ).toEqual({
      titulo: 'Bloqueo en tu zona',
      cuerpo: 'Línea Amarilla. Toca para verlo en el mapa.',
      etiqueta: 'reporte-r1',
      url: '/?reporte=r1&lat=-16.5&lon=-68.13',
    });
  });

  it('ignora un contenido que no es un aviso de reporte', () => {
    expect(avisoDeReporte(null)).toBeNull();
    expect(avisoDeReporte({ tipo: 'otro' })).toBeNull();
  });

  it('la app lee el reporte de la URL del aviso', () => {
    expect(destinoDeLaUrl('?reporte=r1&lat=-16.5&lon=-68.13')).toEqual({
      idReporte: 'r1',
      punto: { latitud: -16.5, longitud: -68.13 },
    });
    expect(destinoDeLaUrl('?reporte=r1')).toBeNull();
    expect(destinoDeLaUrl('')).toBeNull();
  });
});

describe('instalar la app', () => {
  it('en Android usa el aviso de instalación del navegador', async () => {
    escucharInstalacion();
    const prompt = vi.fn(() => Promise.resolve());
    const evento = Object.assign(new Event('beforeinstallprompt'), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    });
    globalThis.dispatchEvent(evento);
    useEstado.setState({ instalarAbierta: true });
    render(<HojaDeInstalar />);

    fireEvent.click(screen.getByRole('button', { name: 'Instalar app' }));

    await waitFor(() =>
      expect(useEstado.getState().aviso?.texto).toBe('Alerta LP quedó instalada.'),
    );
    expect(prompt).toHaveBeenCalled();
    globalThis.dispatchEvent(new Event('appinstalled'));
    expect(formaDeInstalar()).toBe('instalada');
  });

  it('en iPhone muestra los pasos para agregarla a inicio', async () => {
    agenteDeUsuario('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    useEstado.setState({ instalarAbierta: true });
    const { container } = render(<HojaDeInstalar />);

    expect(screen.getByText(/Toca «Compartir»/)).toBeTruthy();
    expect(screen.getByText(/Agregar a inicio/)).toBeTruthy();
    expect(await infracciones(container)).toEqual([]);
  });

  it('sin forma de instalar lo explica', () => {
    useEstado.setState({ instalarAbierta: true });
    render(<HojaDeInstalar />);

    expect(screen.getByText(/Abre esta página en Chrome/)).toBeTruthy();
  });

  it('la oferta del panel lleva a la ayuda y se puede descartar para siempre', () => {
    agenteDeUsuario('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    const { unmount } = render(<OfertaDeInstalar />);

    fireEvent.click(screen.getByRole('button', { name: 'Cómo instalar' }));
    expect(useEstado.getState().instalarAbierta).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'No mostrar más' }));
    expect(screen.queryByText(/Instala la app/)).toBeNull();

    unmount();
    render(<OfertaDeInstalar />);
    expect(screen.queryByText(/Instala la app/)).toBeNull();
    localStorage.removeItem('alerta-lp:oferta-instalar');
  });
});
