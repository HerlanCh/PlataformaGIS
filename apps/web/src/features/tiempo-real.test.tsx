import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReportePublico } from '../domain/reportes.js';
import { ConexionTiempoReal } from '../services/tiempo-real.js';
import { fusionarEvento } from './mapa/usarReportes.js';

type Manejador = (dato?: unknown) => void;

const socket = vi.hoisted(() => {
  const manejadores = new Map<string, (dato?: unknown) => void>();
  const falso = {
    manejadores,
    connected: false,
    recovered: false,
    opciones: null as null | { auth: (responder: (d: unknown) => void) => void },
    on: vi.fn((evento: string, manejador: (dato?: unknown) => void) =>
      manejadores.set(evento, manejador),
    ),
    connect: vi.fn(),
    close: vi.fn(),
    emitidos: [] as unknown[],
    timeout: vi.fn(() => ({
      emitWithAck: vi.fn(async (evento: string, datos: unknown) => {
        falso.emitidos.push([evento, datos]);
        return { ok: true, salas: 4 };
      }),
    })),
  };
  return falso;
});

vi.mock('socket.io-client', () => ({
  io: vi.fn((_url: string, opciones: typeof socket.opciones) => {
    socket.opciones = opciones;
    return socket;
  }),
}));

const disparar = (evento: string, dato?: unknown) =>
  (socket.manejadores.get(evento) as Manejador)(dato);

function conectar() {
  const oyentes = { alEvento: vi.fn(), alEstado: vi.fn(), alPerderEventos: vi.fn() };
  const token = vi.fn(async () => 'tok');
  const conexion = new ConexionTiempoReal('http://api.test', token, oyentes);
  return { conexion, oyentes, token };
}

beforeEach(() => {
  socket.manejadores.clear();
  socket.emitidos = [];
  socket.connected = false;
  socket.recovered = false;
});

describe('cliente de tiempo real (HU-02, escenario 2)', () => {
  it('se autentica con el token y lo renueva tras un rechazo del handshake', async () => {
    const { token } = conectar();
    const responder = vi.fn();

    socket.opciones!.auth(responder);
    await vi.waitFor(() => expect(responder).toHaveBeenCalledWith({ token: 'tok' }));
    disparar('connect_error', new Error('TOKEN_VENCIDO'));
    socket.opciones!.auth(vi.fn());

    expect(token).toHaveBeenLastCalledWith({ forzar: true });
  });

  it('si no hay token, conecta sin credencial y el servidor lo rechaza', async () => {
    const oyentes = { alEvento: vi.fn(), alEstado: vi.fn(), alPerderEventos: vi.fn() };
    new ConexionTiempoReal('http://api.test', () => Promise.reject(new Error('sin red')), oyentes);
    const responder = vi.fn();

    socket.opciones!.auth(responder);

    await vi.waitFor(() => expect(responder).toHaveBeenCalledWith({}));
  });

  it('envía la ventana al conectar y cada vez que cambia', () => {
    const { conexion, oyentes } = conectar();
    conexion.conectar();
    conexion.actualizarVentana('-68.2,-16.6,-68.1,-16.5');
    expect(socket.emitidos).toEqual([]);

    socket.connected = true;
    disparar('connect');
    conexion.actualizarVentana('-68.3,-16.6,-68.1,-16.4');

    expect(oyentes.alEstado).toHaveBeenCalledWith('en-vivo');
    expect(socket.emitidos).toEqual([
      ['viewport:actualizar', { bbox: '-68.2,-16.6,-68.1,-16.5' }],
      ['viewport:actualizar', { bbox: '-68.3,-16.6,-68.1,-16.4' }],
    ]);
  });

  it('reenvía los eventos y avisa si una reconexión no recuperó lo perdido', () => {
    const { oyentes, conexion } = conectar();
    disparar('connect');
    disparar('evento', { id: 'e1' });
    disparar('disconnect');
    disparar('connect');
    socket.recovered = true;
    disparar('connect');
    conexion.cerrar();

    expect(oyentes.alEvento).toHaveBeenCalledWith({ id: 'e1' });
    expect(oyentes.alEstado).toHaveBeenCalledWith('sin-conexion');
    expect(oyentes.alPerderEventos).toHaveBeenCalledOnce();
    expect(socket.close).toHaveBeenCalled();
  });
});

describe('fusionarEvento', () => {
  it('aplica el evento a cada ventana en caché', () => {
    const consulta = new QueryClient();
    const ventana = {
      latitudMin: -16.51,
      latitudMax: -16.48,
      longitudMin: -68.15,
      longitudMax: -68.12,
    };
    const lista: ReportePublico[] = [
      {
        id: 'r1',
        codigoCategoria: 'bloqueo',
        estado: 'ACTIVO',
        publicLocation: { latitud: -16.4955, longitud: -68.1336 },
        creadoEn: '2026-10-18T12:00:00.000Z',
        caducaEn: '2026-10-18T18:00:00.000Z',
        fuenteOficial: null,
      },
    ];
    consulta.setQueryData(['reportes', ventana], lista);
    consulta.setQueryData(['reportes', 'sin-ventana'], lista);

    fusionarEvento(consulta, {
      id: 'e',
      tipo: 'ReporteCaducado',
      version: 1,
      ocurridoEn: '',
      contenido: { idReporte: 'r1' },
    });

    expect(consulta.getQueryData(['reportes', ventana])).toEqual([]);
    expect(consulta.getQueryData(['reportes', 'sin-ventana'])).toBe(lista);
  });
});
