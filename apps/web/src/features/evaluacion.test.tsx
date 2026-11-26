import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEstado } from '../estado.js';
import { infracciones } from '../pruebas/axe.js';
import { pantallaDe } from '../Raiz.js';
import { reiniciarAlmacen } from '../services/almacen.js';
import { bboxDe, clienteDeEvaluacion, ErrorDeEvaluacion } from '../services/evaluacion.js';
import type { TareaEnCurso } from '../services/evaluacion.js';
import { cajaAlrededor } from './evaluacion/Instantaneas.js';
import { PantallaDeEvaluacion } from './evaluacion/PantallaDeEvaluacion.js';
import { TareaEnPantalla } from './evaluacion/TareaCronometrada.js';
import {
  aLocal,
  horaCorta,
  hoyEnBolivia,
  mensajeDeError,
  minutosYSegundos,
  periodoDeDias,
} from './evaluacion/textos.js';

const API = 'http://localhost:3000';
const ID = '33333333-3333-4333-8333-333333333333';

const json = (cuerpo: unknown, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(cuerpo), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const pedidos: Request[] = [];

/** El primer pedido de la evaluación con ese método (el registro del dispositivo no cuenta). */
const pedidoDe = (metodo: string) =>
  pedidos.find((p) => p.method === metodo && p.url.includes('/v1/evaluacion'));

/** API falsa: registra el dispositivo con `rol` y responde la evaluación con `rutas`. */
function api(rol: 'CIUDADANO' | 'MODERADOR', rutas: Record<string, () => Response> = {}) {
  const pedir = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const solicitud = new Request(entrada, init);
    pedidos.push(solicitud.clone());
    if (solicitud.url.endsWith('/v1/dispositivos')) {
      return json({
        idUsuario: ID,
        rol,
        token: 'tok',
        expiraEn: new Date(Date.now() + 86_400_000).toISOString(),
      });
    }
    const ruta = Object.keys(rutas).find((r) => new URL(solicitud.url).pathname.endsWith(r));
    return ruta ? rutas[ruta]!() : json({ instantaneas: [], sesiones: [], verificaciones: [] });
  });
  vi.stubGlobal('fetch', pedir);
  return pedir;
}

const montar = (hijo: ReactNode) => {
  const consulta = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={consulta}>{hijo}</QueryClientProvider>);
};

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  reiniciarAlmacen();
  pedidos.length = 0;
  useEstado.setState({ aviso: null, ventana: null });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('pantalla de evaluación (HU-14)', () => {
  it('la ruta /evaluacion abre su pantalla', () => {
    expect(pantallaDe('/evaluacion')).not.toBeNull();
  });

  it('HU-14: sin el rol no muestra las herramientas ni pide nada de la evaluación', async () => {
    api('CIUDADANO');
    montar(<PantallaDeEvaluacion />);

    expect(await screen.findByText(/equipo de investigación/)).toBeTruthy();
    expect(pedidos.some((p) => p.url.includes('/v1/evaluacion'))).toBe(false);
  });

  it('HU-14: congela una instantánea con el nombre, el instante y la zona alrededor del centro', async () => {
    api('MODERADOR', {
      '/v1/evaluacion/instantaneas': () =>
        json({
          instantaneas: [
            {
              id: ID,
              nombre: 'E1',
              instante: '2026-11-20T16:00:00.000Z',
              caja: cajaAlrededor({ latitud: -16.5, longitud: -68.15 }, 1000),
              creadaEn: '2026-11-21T12:00:00.000Z',
              puntosProcesada: 3,
              puntosBase: 7,
              clave: [],
            },
          ],
          avisos: ['Falta congelar E2.'],
        }),
    });
    const { container } = montar(<PantallaDeEvaluacion />);

    expect(await screen.findByText('3 en la vista procesada · 7 en la base')).toBeTruthy();
    expect(screen.getByText('Falta congelar E2.')).toBeTruthy();
    expect(screen.getByText('Sin clave todavía.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Centro de la zona (latitud, longitud)'), {
      target: { value: '-16.5, -68.15' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Congelar' }));

    await waitFor(() => expect(pedidoDe('POST') !== undefined).toBe(true));
    const cuerpo = await pedidoDe('POST')!.json();
    expect(cuerpo).toMatchObject({
      nombre: 'E1',
      bbox: bboxDe(cajaAlrededor({ latitud: -16.5, longitud: -68.15 }, 1000)),
    });
    expect(Number.isNaN(Date.parse(cuerpo.instante))).toBe(false);
    expect(await infracciones(container)).toEqual([]);
  });

  it('HU-14: abre la sesión con un código anónimo y su secuencia', async () => {
    api('MODERADOR', { '/v1/evaluacion/sesiones': () => json({ sesiones: [] }) });
    const { container } = montar(<PantallaDeEvaluacion />);
    fireEvent.click(await screen.findByLabelText('Tarea'));

    const abrir = screen.getByRole('button', { name: 'Abrir sesión' }) as HTMLButtonElement;
    fireEvent.change(screen.getByLabelText(/Código del participante/), {
      target: { value: 'Ana' },
    });
    expect(abrir.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Código del participante/), {
      target: { value: 'p07' },
    });
    fireEvent.click(abrir);

    // Por defecto la secuencia se sortea en la API (perfil v5, 6.3): no se envía.
    await waitFor(() => expect(pedidoDe('POST') !== undefined).toBe(true));
    expect(await pedidoDe('POST')!.json()).toEqual({ codigoParticipante: 'P07' });
    expect(await infracciones(container)).toEqual([]);
  });

  it('HU-14: una secuencia elegida a mano se envía tal cual', async () => {
    api('MODERADOR', { '/v1/evaluacion/sesiones': () => json({ sesiones: [] }) });
    montar(<PantallaDeEvaluacion />);
    fireEvent.click(await screen.findByLabelText('Tarea'));

    fireEvent.change(screen.getByLabelText(/Código del participante/), {
      target: { value: 'P08' },
    });
    fireEvent.click(screen.getByLabelText('3'));
    fireEvent.click(screen.getByRole('button', { name: 'Abrir sesión' }));

    await waitFor(() => expect(pedidoDe('POST') !== undefined).toBe(true));
    expect(await pedidoDe('POST')!.json()).toEqual({ codigoParticipante: 'P08', secuencia: 3 });
  });

  it('HU-14: los evaluadores fijan la clave eligiendo los incidentes etiquetados de la zona', async () => {
    const enLaZona = { latitud: -16.5, longitud: -68.15 };
    api('MODERADOR', {
      '/v1/evaluacion/instantaneas': () =>
        json({
          instantaneas: [
            {
              id: ID,
              nombre: 'E1',
              instante: '2026-11-20T16:00:00.000Z',
              caja: cajaAlrededor(enLaZona, 500),
              creadaEn: '2026-11-21T12:00:00.000Z',
              puntosProcesada: 1,
              puntosBase: 2,
              clave: [],
            },
          ],
          avisos: [],
        }),
      '/v1/evaluacion/etiquetado': () =>
        json({
          envios: [
            {
              idEnvio: 'e1',
              codigoCategoria: 'bloqueo',
              publicLocation: enLaZona,
              recibidoEn: '2026-11-20T15:00:00.000Z',
            },
            {
              idEnvio: 'e2',
              codigoCategoria: 'bloqueo',
              publicLocation: { latitud: -16.6, longitud: -68.15 },
              recibidoEn: '2026-11-20T15:00:00.000Z',
            },
          ],
          etiquetas: [
            { evaluador: 'A', idEnvio: 'e1', grupo: 'x' },
            { evaluador: 'CONSENSO', idEnvio: 'e1', grupo: '7' },
            { evaluador: 'A', idEnvio: 'e2', grupo: '8' },
          ],
        }),
      [`/v1/evaluacion/instantaneas/${ID}/clave`]: () => json({}),
    });
    const { container } = montar(<PantallaDeEvaluacion />);

    fireEvent.click(await screen.findByRole('button', { name: 'Fijar clave' }));
    // Solo el incidente del consenso dentro de la zona: el envío e2 está fuera.
    fireEvent.click(await screen.findByLabelText(/Incidente 7/));
    fireEvent.click(screen.getByRole('button', { name: 'Fijar clave (1)' }));

    await waitFor(() => expect(pedidoDe('PUT') !== undefined).toBe(true));
    expect(await pedidoDe('PUT')!.json()).toEqual({ grupos: ['7'] });
    expect(screen.queryByLabelText(/Incidente 8/)).toBeNull();
    expect(await infracciones(container)).toEqual([]);
  });

  it('HU-14: el etiquetado guarda solo lo que cambió, como el grupo de cada envío', async () => {
    api('MODERADOR', {
      '/v1/evaluacion/etiquetado': () =>
        json({
          envios: [
            {
              idEnvio: ID,
              codigoCategoria: 'bloqueo',
              publicLocation: { latitud: -16.5, longitud: -68.15 },
              recibidoEn: '2026-11-20T16:00:00.000Z',
            },
          ],
          etiquetas: [],
        }),
    });
    const { container } = montar(<PantallaDeEvaluacion />);
    fireEvent.click(await screen.findByLabelText('Etiquetar'));

    const grupo = await screen.findByLabelText(/Grupo del envío/);
    fireEvent.change(grupo, { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar/ }));

    await waitFor(() => expect(pedidoDe('PUT') !== undefined).toBe(true));
    expect(await pedidoDe('PUT')!.json()).toEqual({
      evaluador: 'A',
      asignaciones: [{ idEnvio: ID, grupo: '1' }],
    });
    expect(await infracciones(container)).toEqual([]);
  });

  it('HU-14: la verificación sortea y registra el resultado, la fuente y la hora de fin', async () => {
    api('MODERADOR', {
      '/v1/evaluacion/verificacion/sorteo': () =>
        json({
          confirmados: [
            {
              idReporte: ID,
              codigoCategoria: 'robo',
              publicLocation: { latitud: -16.5, longitud: -68.15 },
              creadoEn: '2026-11-20T16:00:00.000Z',
              confirmado: true,
            },
          ],
          noConfirmados: [],
        }),
      [`/v1/evaluacion/verificaciones/${ID}`]: () => json({}),
    });
    const { container } = montar(<PantallaDeEvaluacion />);
    fireEvent.click(await screen.findByLabelText('Verificar'));
    fireEvent.click(screen.getByRole('button', { name: 'Sortear alertas de esos días' }));

    fireEvent.change(await screen.findByLabelText(/Cuándo dejó de ser cierto/), {
      target: { value: '2026-11-20T15:30' },
    });
    fireEvent.change(screen.getByLabelText(/Fuente \(breve/), { target: { value: 'Visita' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(pedidoDe('PUT') !== undefined).toBe(true));
    expect(await pedidoDe('PUT')!.json()).toEqual({
      resultado: 'REAL',
      fuente: 'CAMPO',
      finEn: new Date('2026-11-20T15:30').toISOString(),
      detalleFuente: 'Visita',
    });
    expect(await infracciones(container)).toEqual([]);
  });
});

describe('recorrido de una sesión (HU-14)', () => {
  const tarea = (orden: 1 | 2, terminada: boolean) => ({
    id: `33333333-3333-4333-8333-33333333330${orden}`,
    orden,
    vista: 'BASE',
    escenario: 'E1',
    idInstantanea: ID,
    iniciadaEn: terminada ? '2026-11-22T12:00:00.000Z' : null,
    terminadaEn: terminada ? '2026-11-22T12:01:00.000Z' : null,
    duracionMs: terminada ? 60_000 : null,
    agotada: terminada ? false : null,
    marcas: [],
  });

  it('HU-14: empieza la tarea 1, la muestra en pantalla completa y al terminar vuelve a las sesiones', async () => {
    let terminada = false;
    api('MODERADOR', {
      '/v1/evaluacion/sesiones': () =>
        json({
          sesiones: [
            {
              id: ID,
              codigoParticipante: 'P01',
              secuencia: 1,
              creadaEn: '2026-11-22T11:59:00.000Z',
              tareas: [tarea(1, terminada), tarea(2, false)],
            },
          ],
        }),
      '/inicio': () =>
        json({
          idTarea: tarea(1, false).id,
          orden: 1,
          iniciadaEn: new Date().toISOString(),
          duracionMaximaMs: 180_000,
          caja: cajaAlrededor({ latitud: -16.5, longitud: -68.15 }, 500),
          puntos: [],
        }),
      '/fin': () => {
        terminada = true;
        return json(tarea(1, true));
      },
    });
    montar(<PantallaDeEvaluacion />);
    fireEvent.click(await screen.findByLabelText('Tarea'));

    fireEvent.click(await screen.findByRole('button', { name: 'Empezar tarea 1' }));
    expect(await screen.findByText('Tarea 1 de 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Terminar' }));

    expect(await screen.findByText(/Tarea 1: terminada · 0 marcados/)).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Empezar tarea 2' })).toBeTruthy();
    const fin = pedidos.find((p) => p.method === 'POST' && p.url.endsWith('/fin'))!;
    expect(await fin.json()).toEqual({ marcas: [] });
  });
});

describe('tarea en pantalla (HU-14)', () => {
  const tarea: TareaEnCurso = {
    idTarea: ID,
    orden: 1,
    iniciadaEn: '2026-11-22T12:00:00.000Z',
    duracionMaximaMs: 180_000,
    caja: cajaAlrededor({ latitud: -16.5, longitud: -68.15 }, 500),
    puntos: [],
  };

  it('HU-14: muestra la cuenta atrás y al agotarse los 180 s entrega sola, una sola vez', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] });
    const alTerminar = vi.fn();
    render(<TareaEnPantalla tarea={tarea} alTerminar={alTerminar} terminando={false} />);

    expect(screen.getByText('Tarea 1 de 2')).toBeTruthy();
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByLabelText('Tiempo restante').textContent).toBe('2:00');
    act(() => vi.advanceTimersByTime(121_000));
    fireEvent.click(screen.getByRole('button', { name: 'Terminar' }));

    expect(alTerminar).toHaveBeenCalledOnce();
    expect(alTerminar).toHaveBeenCalledWith([]);
  });

  it('HU-14: terminar antes de tiempo entrega lo marcado', () => {
    const alTerminar = vi.fn();
    render(<TareaEnPantalla tarea={tarea} alTerminar={alTerminar} terminando={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Terminar' }));

    expect(alTerminar).toHaveBeenCalledWith([]);
    expect(screen.queryByRole('button', { name: 'Centrar en mi ubicación' })).toBeNull();
  });
});

describe('servicio y textos de la evaluación', () => {
  it('traduce el rechazo de la API a su código y a un mensaje', async () => {
    const pedir = vi.fn(async (entrada: RequestInfo | URL) =>
      String(entrada).endsWith('/v1/dispositivos')
        ? json({
            idUsuario: ID,
            rol: 'MODERADOR',
            token: 't',
            expiraEn: new Date(Date.now() + 1e8).toISOString(),
          })
        : json({ codigo: 'NOMBRE_REPETIDO' }, 409),
    );
    vi.stubGlobal('fetch', pedir);
    const cliente = clienteDeEvaluacion(API, pedir as unknown as typeof fetch);

    const error = await cliente.instantaneas().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ErrorDeEvaluacion);
    expect(mensajeDeError(error, 'otro')).toBe('Ya hay una instantánea con ese nombre.');
    expect(mensajeDeError(new Error('red'), 'Sin conexión')).toBe('Sin conexión');
  });

  it('los días de Bolivia van de medianoche a medianoche en UTC−4', () => {
    expect(periodoDeDias('2026-11-20', '2026-11-21')).toEqual({
      desde: '2026-11-20T04:00:00.000Z',
      hasta: '2026-11-22T04:00:00.000Z',
    });
    expect(hoyEnBolivia(new Date('2026-11-22T02:00:00.000Z'))).toBe('2026-11-21');
    // En 24 h, como el resto de la app: las 18:05 UTC son las 14:05 en Bolivia.
    expect(horaCorta('2026-11-22T18:05:00.000Z')).toBe('22/11, 14:05');
    expect(minutosYSegundos(65_400)).toBe('1:06');
    expect(minutosYSegundos(-5)).toBe('0:00');
    expect(aLocal(new Date(2026, 10, 22, 9, 5))).toBe('2026-11-22T09:05');
  });

  it('la zona alrededor del centro mide el doble del radio por lado', () => {
    const caja = cajaAlrededor({ latitud: -16.5, longitud: -68.15 }, 1000);

    expect((caja.latitudMax - caja.latitudMin) * 111_320).toBeCloseTo(2000, 0);
    expect(caja.longitudMin).toBeLessThan(-68.15);
  });
});
