import { describe, expect, it } from 'vitest';
import { crearClienteApi } from './index.js';

const respuestaJson = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

describe('crearClienteApi', () => {
  it('llama a la ruta tipada y agrega el token cuando lo hay', async () => {
    const solicitudes: Request[] = [];
    const cliente = crearClienteApi({
      urlBase: 'https://api.example',
      obtenerToken: () => 'abc',
      fetch: async (entrada) => {
        solicitudes.push(entrada as Request);
        return respuestaJson({ reportes: [] });
      },
    });

    const { data } = await cliente.GET('/v1/reportes', {
      params: { query: { bbox: '-68.16,-16.51,-68.14,-16.49' } },
    });

    expect(data).toEqual({ reportes: [] });
    expect(solicitudes[0]!.url).toBe(
      'https://api.example/v1/reportes?bbox=-68.16%2C-16.51%2C-68.14%2C-16.49',
    );
    expect(solicitudes[0]!.headers.get('authorization')).toBe('Bearer abc');
  });

  it('sin token no envía Authorization y entrega el problema como error', async () => {
    const solicitudes: Request[] = [];
    const cliente = crearClienteApi({
      urlBase: 'https://api.example',
      obtenerToken: () => null,
      fetch: async (entrada) => {
        solicitudes.push(entrada as Request);
        return respuestaJson({ codigo: 'TOKEN_AUSENTE', status: 401 }, 401);
      },
    });

    const { error } = await cliente.POST('/v1/reportes', {
      params: { header: { 'idempotency-key': 'clave-0001' } },
      body: { codigoCategoria: 'bloqueo', latitud: -16.5, longitud: -68.15 },
    });

    expect(solicitudes[0]!.headers.has('authorization')).toBe(false);
    expect(error).toMatchObject({ codigo: 'TOKEN_AUSENTE' });
  });

  it('sin función de token no instala el middleware', async () => {
    const cliente = crearClienteApi({
      urlBase: 'https://api.example',
      fetch: async () => respuestaJson({ status: 'ok' }),
    });

    const { response } = await cliente.GET('/v1/reportes', {
      params: { query: { bbox: '1,2,3,4' } },
    });

    expect(response.status).toBe(200);
  });
});
