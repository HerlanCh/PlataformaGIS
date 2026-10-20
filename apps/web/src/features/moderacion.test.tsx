import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEstado } from '../estado.js';
import { infracciones } from '../pruebas/axe.js';
import { pantallaDe } from '../Raiz.js';
import { reiniciarAlmacen } from '../services/almacen.js';
import { decidir, ErrorDeModeracion, obtenerCola } from '../services/moderacion.js';
import type { CasoDeModeracion } from '../services/moderacion.js';
import { obtenerToken, rolActual } from '../services/sesion.js';
import { Encabezado } from '../ui/Encabezado.js';
import { PantallaDeModeracion } from './moderacion/PantallaDeModeracion.js';
import { mensajeDeDecision, textoDeMotivo } from './moderacion/textos.js';

const API = 'http://api.prueba';
const ID_USUARIO = '11111111-1111-4111-8111-111111111111';
const ID = '33333333-3333-4333-8333-333333333333';

const caso = (cambios: Partial<CasoDeModeracion> = {}): CasoDeModeracion => ({
  idReporte: ID,
  codigoCategoria: 'robo',
  estado: 'ACTIVO',
  descripcion: 'Promo en https://spam.example',
  publicLocation: { latitud: -16.5, longitud: -68.15 },
  creadoEn: '2026-10-19T12:00:00.000Z',
  negaciones: 2,
  marcado: true,
  motivos: ['ENLACE', 'SPAM'],
  ...cambios,
});

const json = (cuerpo: unknown, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(cuerpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const pedidos: Request[] = [];

/** API falsa: registra el dispositivo con `rol` y responde la cola y las decisiones. */
function api(
  rol: 'CIUDADANO' | 'MODERADOR',
  cola: () => Response = () => json({ casos: [caso()] }),
) {
  const pedir = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const solicitud = new Request(entrada, init);
    pedidos.push(solicitud.clone());
    if (solicitud.url.endsWith('/v1/dispositivos')) {
      return json({
        idUsuario: ID_USUARIO,
        rol,
        token: 'tok',
        expiraEn: new Date(Date.now() + 86_400_000).toISOString(),
      });
    }
    if (solicitud.url.endsWith('/v1/moderacion/cola')) return cola();
    if (solicitud.method === 'POST') return json(null, 204);
    return json({}, 500);
  });
  vi.stubGlobal('fetch', pedir);
  return pedir as unknown as typeof fetch;
}

const montar = (hijo: ReactNode) => {
  const consulta = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={consulta}>{hijo}</QueryClientProvider>);
};

const decisiones = () =>
  pedidos.filter((p) => p.method === 'POST' && p.url.includes('/moderacion/'));

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  reiniciarAlmacen();
  pedidos.length = 0;
  useEstado.setState({ aviso: null, esModerador: false });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pantalla de moderación (HU-12)', () => {
  it('la ruta /moderacion abre su pantalla; cualquier otra, el mapa', () => {
    expect(pantallaDe('/moderacion')).not.toBeNull();
    expect(pantallaDe('/moderacion/')).not.toBeNull();
    expect(pantallaDe('/')).toBeNull();
  });

  it('HU-12: sin el rol muestra el identificador para pedirlo, y no la cola', async () => {
    api('CIUDADANO');
    montar(<PantallaDeModeracion />);

    expect(await screen.findByText(ID_USUARIO)).toBeTruthy();
    expect(screen.getByText('Esta pantalla es para el equipo de moderación.')).toBeTruthy();
    expect(pedidos.some((p) => p.url.endsWith('/v1/moderacion/cola'))).toBe(false);
  });

  it('HU-10 y HU-12: el moderador ve por qué está cada reporte y su descripción privada', async () => {
    api('MODERADOR');
    const { container } = montar(<PantallaDeModeracion />);

    expect(await screen.findByText('Promo en https://spam.example')).toBeTruthy();
    expect(screen.getByText('Marcado: Tiene un enlace · Parece publicidad')).toBeTruthy();
    expect(screen.getByText('2 personas dijeron que ya no está')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver en el mapa' }).getAttribute('href')).toBe(
      `/?reporte=${ID}&lat=-16.5&lon=-68.15`,
    );
    expect(await infracciones(container)).toEqual([]);
  });

  it('HU-12: mantener un reporte lo envía y avisa', async () => {
    api('MODERADOR');
    montar(<PantallaDeModeracion />);

    fireEvent.click(await screen.findByRole('button', { name: 'Mantener' }));

    await waitFor(() => expect(decisiones()).toHaveLength(1));
    expect(decisiones()[0]!.url.endsWith(`/v1/moderacion/reportes/${ID}/mantener`)).toBe(true);
    await waitFor(() =>
      expect(useEstado.getState().aviso?.texto).toBe('Reporte mantenido en el mapa.'),
    );
  });

  it('HU-12: rechazar exige un motivo y ofrece el de la regla ética', async () => {
    api('MODERADOR');
    montar(<PantallaDeModeracion />);
    fireEvent.click(await screen.findByRole('button', { name: 'Rechazar' }));
    const confirmar = screen.getByRole('button', { name: 'Sí, rechazar' });
    expect(confirmar).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByRole('button', { name: 'Identifica a una persona' }));
    fireEvent.click(confirmar);

    await waitFor(() => expect(decisiones()).toHaveLength(1));
    expect(decisiones()[0]!.url.endsWith(`/v1/moderacion/reportes/${ID}/rechazar`)).toBe(true);
    expect(await decisiones()[0]!.json()).toEqual({ motivo: 'Identifica a una persona' });
  });

  it('cancelar el rechazo vuelve a las dos decisiones', async () => {
    api('MODERADOR');
    montar(<PantallaDeModeracion />);
    fireEvent.click(await screen.findByRole('button', { name: 'Rechazar' }));

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.getByRole('button', { name: 'Mantener' })).toBeTruthy();
  });

  it('con la cola vacía lo dice', async () => {
    api('MODERADOR', () => json({ casos: [] }));
    montar(<PantallaDeModeracion />);

    expect(await screen.findByText('No hay reportes por revisar. Vuelve más tarde.')).toBeTruthy();
  });

  it('si la cola no carga, ofrece reintentar', async () => {
    api('MODERADOR', () => json({}, 500));
    montar(<PantallaDeModeracion />);

    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeTruthy();
  });

  it('un caso sin descripción y con una sola negación', async () => {
    api('MODERADOR', () =>
      json({ casos: [caso({ descripcion: null, marcado: false, motivos: [], negaciones: 1 })] }),
    );
    montar(<PantallaDeModeracion />);

    expect(await screen.findByText('Sin descripción del autor.')).toBeTruthy();
    expect(screen.getByText('1 persona dijo que ya no está')).toBeTruthy();
  });
});

describe('moderación: servicios y textos', () => {
  it('HU-12: guarda el rol de la credencial y el de moderador llega con un token nuevo', async () => {
    api('CIUDADANO');
    await obtenerToken(API);
    expect(await rolActual()).toBe('CIUDADANO');

    api('MODERADOR');
    await obtenerToken(API, { forzar: true });
    expect(await rolActual()).toBe('MODERADOR');
  });

  it('un 403 de la cola es un ErrorDeModeracion con su código', async () => {
    const pedir = api('CIUDADANO', () => json({ codigo: 'ROL_INSUFICIENTE' }, 403));

    const error = await obtenerCola(API, pedir).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ErrorDeModeracion);
    expect(mensajeDeDecision(error).texto).toBe('Tu cuenta ya no tiene el rol de moderación.');
  });

  it('una decisión rechazada por la API se explica; sin respuesta, se pide revisar la conexión', async () => {
    const conflicto = vi.fn(async () => json({ codigo: 'REPORTE_NO_VIGENTE' }, 409));
    const caido = vi.fn(async () => json({}, 503));
    api('MODERADOR');
    await obtenerToken(API);

    const vigente = await decidir(
      API,
      ID,
      { tipo: 'MANTENER' },
      conflicto as unknown as typeof fetch,
    ).catch((e: unknown) => e);
    const sinRed = await decidir(
      API,
      ID,
      { tipo: 'MANTENER' },
      caido as unknown as typeof fetch,
    ).catch((e: unknown) => e);

    expect(mensajeDeDecision(vigente).texto).toBe(
      'Ese reporte ya no está vigente: salió de la cola.',
    );
    expect(mensajeDeDecision(sinRed).texto).toContain('Revisa tu conexión');
    expect(textoDeMotivo('DATOS_PERSONALES')).toBe('Puede identificar a una persona');
    expect(textoDeMotivo('OTRO')).toBe('OTRO');
  });

  it('la cabecera muestra el acceso a moderación solo con el rol', () => {
    const { rerender } = render(<Encabezado />);
    expect(screen.queryByRole('link', { name: 'Moderación' })).toBeNull();

    useEstado.setState({ esModerador: true });
    rerender(<Encabezado />);

    expect(screen.getByRole('link', { name: 'Moderación' }).getAttribute('href')).toBe(
      '/moderacion',
    );
  });
});
