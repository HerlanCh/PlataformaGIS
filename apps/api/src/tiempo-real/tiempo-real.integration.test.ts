import type { AddressInfo } from 'node:net';
import type { EventoDeIntegracion } from '@gis/contracts';
import { identityModulo } from '@gis/module-identity';
import {
  CaducarReportes,
  RepositorioReportesPostgis,
  reportsModulo,
  UnidadDeTrabajoReportePg,
} from '@gis/module-reports';
import { RepositorioReputacionesPg, verificationModulo } from '@gis/module-verification';
import {
  BusDeEventosConSalida,
  cargarConfig,
  cargarInterruptores,
  crearDb,
  crearRegistro,
  DespachadorDeSalida,
  migracionesDePlataforma,
  migrarTodo,
} from '@gis/platform';
import type { Db } from '@gis/platform';
import { idUsuario, PuntoGeo } from '@gis/shared-kernel';
import { createTestDatabase, describeIntegration, desplazar } from '@gis/testing';
import type { TestDatabase } from '@gis/testing';
import type { FastifyInstance } from 'fastify';
import { io as conectar } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../app.js';
import { componerCasosDeUso, generadorUuid, relojDelSistema } from '../composicion/casos-de-uso.js';
import { LimitadorDeFrecuenciaEnProceso } from '../composicion/limitador.js';
import { suscribirManejadores } from '../composicion/manejadores.js';
import { ProgramadorDeTareas } from '../composicion/programador.js';
import { ServicioDeTokens } from '../http/tokens.js';
import { configJwtDePrueba, relojReal } from '../tests/apoyo.js';
import { adjuntarTiempoReal } from './servidor.js';
import type { RespuestaDeVentana, TiempoReal } from './servidor.js';

const registro = crearRegistro('silent');
// Dos zonas a unos 10 km: celdas distintas aun en la precisión gruesa.
const zonaA = PuntoGeo.crear(-16.5, -68.15);
const zonaB = PuntoGeo.crear(-16.42, -68.23);
const bbox = (p: PuntoGeo, delta = 0.004) =>
  [p.longitud - delta, p.latitud - delta, p.longitud + delta, p.latitud + delta]
    .map((n) => n.toFixed(5))
    .join(',');

interface Cliente {
  readonly socket: Socket;
  readonly eventos: EventoDeIntegracion[];
}

describeIntegration('tiempo real: difusión por celdas con el despachador del outbox', () => {
  let base: TestDatabase;
  let db: Db;
  let app: FastifyInstance;
  let tiempoReal: TiempoReal;
  let despachador: DespachadorDeSalida;
  let url: string;
  const tokens = new ServicioDeTokens(configJwtDePrueba(), relojReal);
  const clientes: Socket[] = [];

  async function cliente(ventana: PuntoGeo, token?: string): Promise<Cliente> {
    const valido =
      token ??
      (await tokens.firmar({ idUsuario: generadorUuid.siguiente(), rol: 'CIUDADANO' })).token;
    const socket = conectar(url, { transports: ['websocket'], auth: { token: valido } });
    clientes.push(socket);
    const eventos: EventoDeIntegracion[] = [];
    socket.on('evento', (evento: EventoDeIntegracion) => eventos.push(evento));
    await new Promise<void>((listo, fallo) => {
      socket.once('connect', listo);
      socket.once('connect_error', fallo);
    });
    const respuesta = await socket.emitWithAck('viewport:actualizar', { bbox: bbox(ventana) });
    expect(respuesta).toMatchObject({ ok: true });
    return { socket, eventos };
  }

  let n = 0;
  async function registrar() {
    n += 1;
    const respuesta = await app.inject({
      method: 'POST',
      url: '/v1/dispositivos',
      payload: { hashDispositivo: `tiempo-real-${String(n).padStart(6, '0')}` },
    });
    return respuesta.json() as { idUsuario: string; token: string };
  }

  let clave = 0;
  const crearReporte = async (token: string, punto: PuntoGeo, codigoCategoria = 'accidente') =>
    (
      await app.inject({
        method: 'POST',
        url: '/v1/reportes',
        headers: {
          authorization: `Bearer ${token}`,
          'idempotency-key': `tiempo-real-${String((clave += 1)).padStart(5, '0')}`,
        },
        payload: { codigoCategoria, latitud: punto.latitud, longitud: punto.longitud },
      })
    ).json().reporte as { id: string; caducaEn: string };

  const confirmar = (token: string, id: string, punto: PuntoGeo) =>
    app.inject({
      method: 'POST',
      url: `/v1/reportes/${id}/confirmar`,
      headers: { authorization: `Bearer ${token}` },
      payload: { latitud: punto.latitud, longitud: punto.longitud },
    });

  const esperarEvento = (c: Cliente, tipo: string, idReporte: string) =>
    expect
      .poll(
        () =>
          c.eventos.find(
            (e) =>
              e.tipo === tipo && (e.contenido as { idReporte: string }).idReporte === idReporte,
          ),
        { timeout: 8000, interval: 50 },
      )
      .toBeDefined();

  beforeAll(async () => {
    base = await createTestDatabase();
    db = crearDb(base.pool);
    await migrarTodo(db, [
      migracionesDePlataforma,
      ...[identityModulo, reportsModulo, verificationModulo].map((m) => m.migraciones!),
    ]);
    // Módulos opcionales apagados: la difusión y la cadena de votos no dependen de ellos.
    const interruptores = cargarInterruptores({});
    const bus = new BusDeEventosConSalida(db);
    app = await construirApp({
      config: cargarConfig({ DATABASE_URL: base.url, CORS_ORIGIN: 'http://localhost:5173' }),
      interruptores,
      registro,
      db: base.pool,
      bus,
      modulos: [],
      api: {
        casos: componerCasosDeUso({
          db,
          interruptores,
          limitador: new LimitadorDeFrecuenciaEnProceso(relojDelSistema),
        }),
        tokens,
        limitePorMinuto: 10_000,
      },
    });
    tiempoReal = adjuntarTiempoReal(app.server, {
      origenCors: 'http://localhost:5173',
      tokens,
      recuperacionMs: 30_000,
    });
    suscribirManejadores({
      bus,
      db,
      interruptores,
      registro,
      tiempoReal,
      reloj: relojDelSistema,
      ids: generadorUuid,
    });
    despachador = new DespachadorDeSalida(db, bus, { registro, intervaloMs: 20 });
    await app.listen({ port: 0, host: '127.0.0.1' });
    url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
    despachador.iniciar();
  });

  afterAll(async () => {
    for (const socket of clientes) socket.close();
    await despachador?.detener();
    await tiempoReal?.close();
    await app?.close();
    await base?.close();
  });

  describe('conexión', () => {
    it.each([
      ['sin token', undefined, 'TOKEN_AUSENTE'],
      ['con un token alterado', 'x.y.z', 'TOKEN_INVALIDO'],
    ])('se rechaza %s', async (_caso, token, codigo) => {
      const socket = conectar(url, {
        transports: ['websocket'],
        auth: token === undefined ? {} : { token },
        reconnection: false,
      });
      clientes.push(socket);

      const error = await new Promise<Error>((listo) => socket.once('connect_error', listo));

      expect(error.message).toBe(codigo);
    });

    it('rechaza una ventana mal escrita o demasiado grande', async () => {
      const { socket } = await cliente(zonaA);

      const mal: RespuestaDeVentana = await socket.emitWithAck('viewport:actualizar', {
        bbox: '1,2',
      });
      const enorme: RespuestaDeVentana = await socket.emitWithAck('viewport:actualizar', {
        bbox: '-179,-80,179,80',
      });

      expect(mal).toEqual({ ok: false, codigo: 'VENTANA_INVALIDA' });
      expect(enorme).toEqual({ ok: false, codigo: 'VENTANA_DEMASIADO_GRANDE' });
    });
  });

  it('HU-02: un reporte en la celda A llega solo al cliente que mira la celda A', async () => {
    const enA = await cliente(zonaA);
    const enB = await cliente(zonaB);
    const { token } = await registrar();

    const reporte = await crearReporte(token, zonaA);

    await esperarEvento(enA, 'ReporteCreado', reporte.id);
    // Margen para que, si se hubiera difundido mal, también le llegara a B.
    await new Promise((listo) => setTimeout(listo, 300));
    expect(
      enB.eventos.some((e) => (e.contenido as { idReporte: string }).idReporte === reporte.id),
    ).toBe(false);
    const recibido = enA.eventos.find((e) => e.tipo === 'ReporteCreado')!;
    expect(Object.keys(recibido.contenido as object)).not.toContain('location');
  });

  it('HU-03: la cadena voto → confirmación → reputación funciona con el despachador real', async () => {
    const punto = desplazar(zonaA, 600, 0);
    const mirando = await cliente(punto);
    const autor = await registrar();
    const votantes = [await registrar(), await registrar(), await registrar()];
    const reporte = await crearReporte(autor.token, punto, 'bloqueo');

    for (const votante of votantes) {
      expect((await confirmar(votante.token, reporte.id, punto)).statusCode).toBe(200);
    }

    await esperarEvento(mirando, 'ReporteConfirmado', reporte.id);
    const reputaciones = new RepositorioReputacionesPg(db);
    await expect
      .poll(
        async () => (await reputaciones.buscarPorUsuario(idUsuario(autor.idUsuario)))?.puntaje,
        {
          timeout: 8000,
        },
      )
      .toBe(1.2);
  });

  it('reconexión: al volver dentro del plazo, el cliente recibe lo ocurrido durante el corte', async () => {
    const punto = desplazar(zonaA, -600, 0);
    const mirando = await cliente(punto);
    const { token } = await registrar();
    // La recuperación reenvía desde el último paquete recibido: el cliente ya recibió uno.
    const previo = await crearReporte(token, desplazar(punto, 0, 200), 'accidente');
    await esperarEvento(mirando, 'ReporteCreado', previo.id);

    const desconectado = new Promise((listo) => mirando.socket.once('disconnect', listo));
    mirando.socket.io.engine.close();
    await desconectado;
    const reporte = await crearReporte(token, punto, 'jauria');
    await new Promise((listo) => setTimeout(listo, 500));

    await esperarEvento(mirando, 'ReporteCreado', reporte.id);
    expect(mirando.socket.recovered).toBe(true);
  });

  it('HU-04: la tarea de caducidad caduca el reporte vencido y su evento llega al mapa', async () => {
    const punto = desplazar(zonaB, 0, 600);
    const mirando = await cliente(punto);
    const { token } = await registrar();
    const reporte = await crearReporte(token, punto, 'robo');
    const despuesDeCaducar = { ahora: () => new Date(Date.parse(reporte.caducaEn) + 60_000) };
    const programador = new ProgramadorDeTareas(registro);
    const caducar = new CaducarReportes({
      reportes: new RepositorioReportesPostgis(db),
      unidadDeTrabajo: new UnidadDeTrabajoReportePg(db),
      reloj: despuesDeCaducar,
      ids: generadorUuid,
    });

    await programador.ejecutar({
      nombre: 'caducar-reportes',
      intervaloMs: 60_000,
      ejecutar: () => caducar.ejecutar(),
    });

    await esperarEvento(mirando, 'ReporteCaducado', reporte.id);
  });
});
