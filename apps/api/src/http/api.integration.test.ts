import { BusDeEventosEnMemoria } from '@gis/event-bus';
import { heatmapModulo } from '@gis/module-heatmap';
import { identityModulo } from '@gis/module-identity';
import { moderationModulo } from '@gis/module-moderation';
import { reportsModulo } from '@gis/module-reports';
import { subscriptionsModulo } from '@gis/module-subscriptions';
import { verificationModulo } from '@gis/module-verification';
import {
  cargarConfig,
  cargarInterruptores,
  crearDb,
  crearRegistro,
  migracionesDePlataforma,
  migrarTodo,
} from '@gis/platform';
import type { Db } from '@gis/platform';
import { PuntoGeo } from '@gis/shared-kernel';
import { createTestDatabase, describeIntegration, desplazar } from '@gis/testing';
import type { TestDatabase } from '@gis/testing';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../app.js';
import { componerCasosDeUso, relojDelSistema } from '../composicion/casos-de-uso.js';
import { LimitadorDeFrecuenciaEnProceso } from '../composicion/limitador.js';
import { configJwtDePrueba, relojReal, SECRETO_ANTERIOR_DE_PRUEBA } from '../tests/apoyo.js';
import { ServicioDeTokens } from './tokens.js';

const TODOS_ACTIVOS = {
  FEATURE_HEATMAP: 'true',
  FEATURE_SUBSCRIPTIONS: 'true',
  FEATURE_MODERATION: 'true',
};
const CAMPOS_PRIVADOS = ['location', 'authorId', 'author_id', 'ubicacion', 'idAutor'];
const plaza = PuntoGeo.crear(-16.4955, -68.1336);
const bbox = (punto: PuntoGeo, delta = 0.01) =>
  [punto.longitud - delta, punto.latitud - delta, punto.longitud + delta, punto.latitud + delta]
    .map((n) => n.toFixed(5))
    .join(',');

/** Nombres de todas las claves de un JSON, a cualquier profundidad. */
function claves(valor: unknown): string[] {
  if (Array.isArray(valor)) return valor.flatMap(claves);
  if (valor === null || typeof valor !== 'object') return [];
  return Object.entries(valor).flatMap(([clave, hijo]) => [clave, ...claves(hijo)]);
}

describeIntegration('API REST /v1', () => {
  let base: TestDatabase;
  let db: Db;
  let app: FastifyInstance;
  let tokens: ServicioDeTokens;
  const respuestas: { ruta: string; respuesta: LightMyRequestResponse }[] = [];

  async function crearApp(env: Record<string, string>, limitePorMinuto = 1000) {
    const interruptores = cargarInterruptores(env);
    return construirApp({
      config: cargarConfig({ DATABASE_URL: base.url, CORS_ORIGIN: 'http://localhost:5173' }),
      interruptores,
      registro: crearRegistro('silent'),
      db: base.pool,
      bus: new BusDeEventosEnMemoria(),
      modulos: [],
      api: {
        casos: componerCasosDeUso({
          db,
          interruptores,
          limitador: new LimitadorDeFrecuenciaEnProceso(relojDelSistema),
        }),
        tokens,
        limitePorMinuto,
      },
    });
  }

  /** Hace la solicitud y la guarda para las pruebas de contrato y de privacidad. */
  async function pedir(opciones: {
    method: 'GET' | 'POST' | 'DELETE';
    url: string;
    token?: string;
    payload?: unknown;
    headers?: Record<string, string>;
  }): Promise<LightMyRequestResponse> {
    const respuesta = await app.inject({
      method: opciones.method,
      url: opciones.url,
      headers: {
        ...(opciones.token ? { authorization: `Bearer ${opciones.token}` } : {}),
        ...opciones.headers,
      },
      ...(opciones.payload === undefined ? {} : { payload: opciones.payload as object }),
    });
    respuestas.push({ ruta: `${opciones.method} ${opciones.url.split('?')[0]}`, respuesta });
    return respuesta;
  }

  let n = 0;
  async function registrar(): Promise<{ idUsuario: string; token: string }> {
    n += 1;
    const respuesta = await pedir({
      method: 'POST',
      url: '/v1/dispositivos',
      payload: { hashDispositivo: `dispositivo-de-prueba-${String(n).padStart(4, '0')}` },
    });
    return respuesta.json();
  }

  let clave = 0;
  const crearReporte = (token: string, punto = plaza, codigoCategoria = 'bloqueo') =>
    pedir({
      method: 'POST',
      url: '/v1/reportes',
      token,
      headers: { 'idempotency-key': `clave-http-${String((clave += 1)).padStart(5, '0')}` },
      payload: { codigoCategoria, latitud: punto.latitud, longitud: punto.longitud },
    });

  beforeAll(async () => {
    base = await createTestDatabase();
    db = crearDb(base.pool);
    await migrarTodo(db, [
      migracionesDePlataforma,
      ...[
        identityModulo,
        reportsModulo,
        verificationModulo,
        subscriptionsModulo,
        moderationModulo,
        heatmapModulo,
      ].flatMap((m) => (m.migraciones ? [m.migraciones] : [])),
    ]);
    tokens = new ServicioDeTokens(
      configJwtDePrueba({ secretoAnterior: SECRETO_ANTERIOR_DE_PRUEBA }),
      relojReal,
    );
    app = await crearApp(TODOS_ACTIVOS);
  });

  afterAll(async () => {
    await app?.close();
    await base?.close();
  });

  describe('dispositivos', () => {
    it('RF-01: registra el dispositivo y entrega un token; repetirlo devuelve el mismo usuario', async () => {
      const primera = await pedir({
        method: 'POST',
        url: '/v1/dispositivos',
        payload: { hashDispositivo: 'dispositivo-repetido-0001' },
      });
      const segunda = await pedir({
        method: 'POST',
        url: '/v1/dispositivos',
        payload: { hashDispositivo: 'dispositivo-repetido-0001' },
      });

      expect(primera.statusCode).toBe(200);
      expect(primera.json()).toMatchObject({ rol: 'CIUDADANO', esNuevo: true });
      expect(segunda.json()).toMatchObject({
        idUsuario: primera.json().idUsuario,
        esNuevo: false,
      });
      expect(await tokens.verificar(segunda.json().token)).toEqual({
        idUsuario: primera.json().idUsuario,
        rol: 'CIUDADANO',
      });
    });

    it('un hash mal formado es una regla incumplida (422)', async () => {
      const respuesta = await pedir({
        method: 'POST',
        url: '/v1/dispositivos',
        payload: { hashDispositivo: 'corto' },
      });

      expect(respuesta.statusCode).toBe(422);
      expect(respuesta.headers['content-type']).toContain('application/problem+json');
      expect(respuesta.json()).toMatchObject({ codigo: 'HASH_DE_DISPOSITIVO_INVALIDO' });
    });
  });

  describe('reportes', () => {
    it('HU-01: crea un reporte (201) con su ubicación pública y sin autor', async () => {
      const { token } = await registrar();

      const respuesta = await crearReporte(token, plaza, 'robo');

      expect(respuesta.statusCode).toBe(201);
      const { resultado, reporte } = respuesta.json();
      expect(resultado).toBe('CREADO');
      expect(reporte).toMatchObject({ codigoCategoria: 'robo', estado: 'ACTIVO' });
      expect(reporte.publicLocation).not.toEqual({
        latitud: plaza.latitud,
        longitud: plaza.longitud,
      });
    });

    it('HU-05: el reenvío con la misma Idempotency-Key devuelve el mismo reporte', async () => {
      const { token } = await registrar();
      const envio = {
        method: 'POST' as const,
        url: '/v1/reportes',
        token,
        headers: { 'idempotency-key': 'reenvio-http-0001' },
        payload: { codigoCategoria: 'accidente', latitud: -16.52, longitud: -68.12 },
      };

      const primera = await pedir(envio);
      const segunda = await pedir(envio);

      expect(segunda.json().reporte.id).toBe(primera.json().reporte.id);
    });

    it('HU-01: un duplicado de otro usuario responde 200 con el reporte existente', async () => {
      const ana = await registrar();
      const beto = await registrar();
      const punto = PuntoGeo.crear(-16.45, -68.15);
      const original = await crearReporte(ana.token, punto, 'jauria');

      const duplicado = await crearReporte(beto.token, desplazar(punto, 20, 0), 'jauria');

      expect(duplicado.statusCode).toBe(200);
      expect(duplicado.json()).toMatchObject({
        resultado: 'DUPLICADO',
        reporte: { id: original.json().reporte.id },
      });
    });

    it('exige la cabecera Idempotency-Key (400)', async () => {
      const { token } = await registrar();

      const respuesta = await pedir({
        method: 'POST',
        url: '/v1/reportes',
        token,
        payload: { codigoCategoria: 'bloqueo', latitud: plaza.latitud, longitud: plaza.longitud },
      });

      expect(respuesta.statusCode).toBe(400);
      expect(respuesta.json()).toMatchObject({ codigo: 'ENTRADA_INVALIDA', status: 400 });
    });

    it('HU-01: fuera del área de servicio es 422', async () => {
      const { token } = await registrar();

      const respuesta = await crearReporte(token, {
        latitud: -17.39,
        longitud: -66.16,
      } as PuntoGeo);

      expect(respuesta.statusCode).toBe(422);
      expect(respuesta.json().codigo).toBe('FUERA_DEL_AREA_DE_SERVICIO');
    });

    it('HU-01: el sexto reporte en 10 minutos es 429 con Retry-After', async () => {
      const { token } = await registrar();
      for (let i = 0; i < 5; i += 1) {
        expect(
          (await crearReporte(token, desplazar(plaza, 0, 400 * (i + 1)), 'infraestructura'))
            .statusCode,
        ).toBe(201);
      }

      const sexto = await crearReporte(token, desplazar(plaza, 3000, 0), 'infraestructura');

      expect(sexto.statusCode).toBe(429);
      expect(Number(sexto.headers['retry-after'])).toBeGreaterThan(0);
    });

    it('HU-02: lista los reportes vigentes de la ventana', async () => {
      const { token } = await registrar();
      const punto = PuntoGeo.crear(-16.41, -68.25);
      const creado = await crearReporte(token, punto, 'accidente');

      const respuesta = await pedir({ method: 'GET', url: `/v1/reportes?bbox=${bbox(punto)}` });

      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.json().reportes.map((r: { id: string }) => r.id)).toContain(
        creado.json().reporte.id,
      );
    });

    it('rechaza una ventana mal escrita (400)', async () => {
      const respuesta = await pedir({ method: 'GET', url: '/v1/reportes?bbox=1,2,3' });

      expect(respuesta.statusCode).toBe(400);
    });
  });

  describe('autenticación', () => {
    const conToken = (token?: string) =>
      pedir({
        method: 'POST',
        url: '/v1/reportes',
        ...(token === undefined ? {} : { token }),
        headers: { 'idempotency-key': 'sin-autenticar-01' },
        payload: { codigoCategoria: 'bloqueo', latitud: plaza.latitud, longitud: plaza.longitud },
      });

    it('sin token es 401 TOKEN_AUSENTE', async () => {
      const respuesta = await conToken();

      expect(respuesta.statusCode).toBe(401);
      expect(respuesta.json().codigo).toBe('TOKEN_AUSENTE');
    });

    it('un token alterado es 401 TOKEN_INVALIDO', async () => {
      const { token } = await registrar();

      expect((await conToken(`${token}x`)).json().codigo).toBe('TOKEN_INVALIDO');
    });

    it('un token vencido es 401 TOKEN_VENCIDO', async () => {
      const { idUsuario } = await registrar();
      const hace2Horas = { ahora: () => new Date(Date.now() - 2 * 3_600_000) };
      const viejo = await new ServicioDeTokens(configJwtDePrueba(), hace2Horas).firmar({
        idUsuario,
        rol: 'CIUDADANO',
      });

      const respuesta = await conToken(viejo.token);

      expect(respuesta.statusCode).toBe(401);
      expect(respuesta.json().codigo).toBe('TOKEN_VENCIDO');
    });

    it('rotación: un token firmado con la clave anterior se acepta', async () => {
      const { idUsuario } = await registrar();
      const conClaveAnterior = await new ServicioDeTokens(
        configJwtDePrueba({ secreto: SECRETO_ANTERIOR_DE_PRUEBA }),
        relojReal,
      ).firmar({ idUsuario, rol: 'CIUDADANO' });

      expect((await conToken(conClaveAnterior.token)).statusCode).toBe(201);
    });
  });

  describe('votos', () => {
    it('HU-03: otro usuario cercano confirma; el autor no puede; el voto repetido es 409', async () => {
      const autor = await registrar();
      const votante = await registrar();
      const punto = PuntoGeo.crear(-16.53, -68.08);
      const { reporte } = (await crearReporte(autor.token, punto, 'accidente')).json();
      const voto = (token: string, ruta = 'confirmar') =>
        pedir({
          method: 'POST',
          url: `/v1/reportes/${reporte.id}/${ruta}`,
          token,
          payload: { latitud: punto.latitud, longitud: punto.longitud },
        });

      const valido = await voto(votante.token);
      const delAutor = await voto(autor.token, 'negar');
      const repetido = await voto(votante.token, 'negar');

      expect(valido.statusCode).toBe(200);
      expect(valido.json()).toEqual({ peso: 1, decision: 'NINGUNA' });
      expect([delAutor.statusCode, delAutor.json().codigo]).toEqual([403, 'AUTOR_NO_PUEDE_VOTAR']);
      expect([repetido.statusCode, repetido.json().codigo]).toEqual([409, 'YA_VOTO']);
    });

    it('un reporte inexistente es 404', async () => {
      const { token } = await registrar();

      const respuesta = await pedir({
        method: 'POST',
        url: '/v1/reportes/7a2d3e1f-4c8b-4e3b-8d69-1b5a6c2e3f40/confirmar',
        token,
        payload: { latitud: plaza.latitud, longitud: plaza.longitud },
      });

      expect(respuesta.statusCode).toBe(404);
    });
  });

  describe('mapa de calor, suscripciones y moderación', () => {
    it('HU-06: devuelve las celdas del rango', async () => {
      const respuesta = await pedir({
        method: 'GET',
        url: `/v1/mapa-calor?bbox=${bbox(plaza, 0.05)}&desde=2026-10-01T00:00:00Z&hasta=2026-10-30T00:00:00Z&tamanoCelda=500`,
      });

      expect(respuesta.statusCode).toBe(200);
      expect(Array.isArray(respuesta.json().celdas)).toBe(true);
    });

    it('HU-06: un rango de más de 90 días es 422', async () => {
      const respuesta = await pedir({
        method: 'GET',
        url: `/v1/mapa-calor?bbox=${bbox(plaza)}&desde=2026-01-01T00:00:00Z&hasta=2026-10-30T00:00:00Z`,
      });

      expect([respuesta.statusCode, respuesta.json().codigo]).toEqual([
        422,
        'RANGO_DEMASIADO_AMPLIO',
      ]);
    });

    it('HU-07: crea (201), lista y elimina (204) una zona; la de otro usuario es 403', async () => {
      const ana = await registrar();
      const beto = await registrar();
      const creada = await pedir({
        method: 'POST',
        url: '/v1/suscripciones',
        token: ana.token,
        payload: {
          latitud: plaza.latitud,
          longitud: plaza.longitud,
          radioM: 800,
          categorias: ['bloqueo'],
        },
      });
      const borrar = (token: string) =>
        pedir({ method: 'DELETE', url: `/v1/suscripciones/${creada.json().id}`, token });

      const listar = async (token: string) =>
        (await pedir({ method: 'GET', url: '/v1/suscripciones', token })).json().zonas as {
          id: string;
        }[];
      const deAna = await listar(ana.token);
      const deBeto = await listar(beto.token);
      const ajena = await borrar(beto.token);
      const propia = await borrar(ana.token);

      expect(creada.statusCode).toBe(201);
      expect(creada.json()).toMatchObject({ radioM: 800, categorias: ['bloqueo'] });
      expect(ajena.statusCode).toBe(403);
      expect(propia.statusCode).toBe(204);
      expect(deAna.map((z) => z.id)).toEqual([creada.json().id]);
      expect(deBeto).toEqual([]);
      expect(await listar(ana.token)).toEqual([]);
    });

    it('HU-12: un ciudadano no puede rechazar (403); un moderador sí (202)', async () => {
      const autor = await registrar();
      const punto = PuntoGeo.crear(-16.43, -68.29);
      const { reporte } = (await crearReporte(autor.token, punto, 'jauria')).json();
      const moderador = await tokens.firmar({ idUsuario: autor.idUsuario, rol: 'MODERADOR' });
      const rechazar = (token: string) =>
        pedir({
          method: 'POST',
          url: `/v1/moderacion/reportes/${reporte.id}/rechazar`,
          token,
          payload: { motivo: 'Reporte falso' },
        });

      const ciudadano = await rechazar(autor.token);
      const conRol = await rechazar(moderador.token);

      expect([ciudadano.statusCode, ciudadano.json().codigo]).toEqual([403, 'ROL_INSUFICIENTE']);
      expect(conRol.statusCode).toBe(202);
    });
  });

  describe('protecciones', () => {
    it('un cuerpo de más de 16 KB es 413', async () => {
      const respuesta = await pedir({
        method: 'POST',
        url: '/v1/dispositivos',
        payload: { hashDispositivo: 'x'.repeat(20_000) },
      });

      expect(respuesta.statusCode).toBe(413);
    });

    it('envía cabeceras de seguridad y CORS solo para la PWA', async () => {
      const respuesta = await app.inject({
        method: 'GET',
        url: `/v1/reportes?bbox=${bbox(plaza)}`,
        headers: { origin: 'http://localhost:5173' },
      });
      const ajeno = await app.inject({
        method: 'GET',
        url: `/v1/reportes?bbox=${bbox(plaza)}`,
        headers: { origin: 'https://otro.example' },
      });

      expect(respuesta.headers['x-content-type-options']).toBe('nosniff');
      expect(respuesta.headers['content-security-policy']).toContain("default-src 'none'");
      expect(respuesta.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(ajeno.headers['access-control-allow-origin']).not.toBe('https://otro.example');
    });

    it('al superar el límite por IP responde 429 en formato RFC 7807', async () => {
      const limitada = await crearApp(TODOS_ACTIVOS, 2);
      const pedirSalud = () => limitada.inject({ method: 'GET', url: '/health' });
      await pedirSalud();
      await pedirSalud();

      const tercera = await pedirSalud();
      await limitada.close();

      expect(tercera.statusCode).toBe(429);
      expect(tercera.json()).toMatchObject({ codigo: 'LIMITE_EXCEDIDO', status: 429 });
    });

    it('un módulo opcional apagado no expone sus rutas (404)', async () => {
      const sinOpcionales = await crearApp({});
      const respuesta = await sinOpcionales.inject({ method: 'POST', url: '/v1/suscripciones' });
      await sinOpcionales.close();

      expect([respuesta.statusCode, respuesta.json().codigo]).toEqual([404, 'RUTA_NO_ENCONTRADA']);
    });

    it('publica el documento OpenAPI y Swagger UI en /docs', async () => {
      const documento = await app.inject({ method: 'GET', url: '/docs/json' });
      const interfaz = await app.inject({ method: 'GET', url: '/docs/' });

      expect(documento.json()).toMatchObject({ openapi: '3.1.0' });
      expect(Object.keys(documento.json().paths)).toContain('/v1/reportes');
      expect(interfaz.statusCode).toBe(200);
    });
  });

  describe('contrato y privacidad de todas las respuestas', () => {
    it('cada respuesta exitosa cumple su esquema OpenAPI', () => {
      const documento = app.swagger();
      const ajv = new Ajv2020({ strict: false, allErrors: true });
      addFormats(ajv);
      ajv.addSchema(documento, 'openapi');
      const exitosas = respuestas.filter(
        ({ respuesta }) => respuesta.statusCode < 300 && respuesta.body !== '',
      );

      expect(exitosas.length).toBeGreaterThan(10);
      for (const { ruta, respuesta } of exitosas) {
        const [metodo, url] = ruta.split(' ') as [string, string];
        const plantilla = url.replace(/[0-9a-f-]{36}/g, '{id}');
        const puntero = [
          'paths',
          plantilla,
          metodo.toLowerCase(),
          'responses',
          String(respuesta.statusCode),
          'content',
          'application/json',
          'schema',
        ]
          .map((parte) => parte.replaceAll('~', '~0').replaceAll('/', '~1'))
          .join('/');
        const validar = ajv.getSchema(`openapi#/${puntero}`);
        expect(validar, `${ruta} ${respuesta.statusCode} sin esquema`).toBeDefined();
        expect(validar!(respuesta.json()), `${ruta}: ${ajv.errorsText(validar!.errors)}`).toBe(
          true,
        );
      }
    });

    it('RNF-14: ninguna respuesta contiene la ubicación real ni el autor', () => {
      expect(respuestas.length).toBeGreaterThan(20);
      for (const { ruta, respuesta } of respuestas) {
        if (respuesta.body === '') continue;
        const presentes = claves(respuesta.json()).filter((c) => CAMPOS_PRIVADOS.includes(c));
        expect(presentes, ruta).toEqual([]);
      }
    });
  });
});
