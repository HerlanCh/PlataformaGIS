import { readFile } from 'node:fs/promises';
import { ErrorDeConfig } from '@gis/platform';
import {
  ErrorConflicto,
  ErrorDeDominio,
  ErrorLimiteExcedido,
  ErrorNoEncontrado,
  ErrorProhibido,
  ErrorValidacionFallida,
} from '@gis/shared-kernel';
import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { documentoOpenApi } from '../openapi/documento.js';
import {
  configJwtDePrueba,
  relojReal,
  SECRETO_ANTERIOR_DE_PRUEBA,
  SECRETO_DE_PRUEBA,
} from '../tests/apoyo.js';
import { cargarConfigHttp } from './config-http.js';
import { aProblema, ErrorNoAutenticado } from './errores.js';
import { ServicioDeTokens } from './tokens.js';

const ID = '6f1c2f0e-3b7a-4d2a-9c58-0a4f5b1d2e3f';

describe('ServicioDeTokens', () => {
  const tokens = new ServicioDeTokens(configJwtDePrueba(), relojReal);

  it('firma y verifica la identidad, con su expiración', async () => {
    const antes = Date.now();
    const { token, expiraEn } = await tokens.firmar({ idUsuario: ID, rol: 'MODERADOR' });

    expect(await tokens.verificar(token)).toEqual({ idUsuario: ID, rol: 'MODERADOR' });
    expect(expiraEn.getTime()).toBeGreaterThanOrEqual(antes + 3600_000 - 1000);
  });

  it('rechaza un token firmado con una clave que no conoce', async () => {
    const ajeno = new ServicioDeTokens(
      configJwtDePrueba({ secreto: SECRETO_ANTERIOR_DE_PRUEBA }),
      relojReal,
    );
    const { token } = await ajeno.firmar({ idUsuario: ID, rol: 'CIUDADANO' });

    await expect(tokens.verificar(token)).rejects.toMatchObject({ codigo: 'TOKEN_INVALIDO' });
  });

  it('rechaza un token bien firmado con datos que no son válidos', async () => {
    const sinRol = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('no-es-uuid')
      .setIssuer('plataforma-gis')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(SECRETO_DE_PRUEBA));

    await expect(tokens.verificar(sinRol)).rejects.toMatchObject({ codigo: 'TOKEN_INVALIDO' });
    await expect(tokens.verificar('basura')).rejects.toBeInstanceOf(ErrorNoAutenticado);
  });
});

describe('aProblema', () => {
  it.each([
    [new ErrorNoEncontrado('X', 'm'), 404],
    [new ErrorProhibido('X', 'm'), 403],
    [new ErrorConflicto('X', 'm'), 409],
    [new ErrorValidacionFallida('X', 'm'), 422],
    [new ErrorLimiteExcedido(3), 429],
    [new ErrorNoAutenticado('TOKEN_VENCIDO', 'm'), 401],
    [new ErrorDeDominio('REGLA', 'm'), 422],
    [
      Object.assign(new Error('grande'), { statusCode: 413, code: 'FST_ERR_CTP_BODY_TOO_LARGE' }),
      413,
    ],
  ])('%o → %i', (error, status) => {
    expect(aProblema(error, 'req-1')).toMatchObject({ status, instance: 'req-1' });
  });

  it('un error inesperado es 500 y no revela su mensaje', () => {
    const problema = aProblema(new Error('contraseña de la base: secreta'), 'req-2');

    expect(problema).toMatchObject({ status: 500, codigo: 'ERROR_INTERNO' });
    expect(JSON.stringify(problema)).not.toContain('secreta');
  });

  it('el tipo del problema se deriva del código', () => {
    expect(aProblema(new ErrorConflicto('YA_VOTO', 'm'), 'r').type).toBe(
      'https://plataforma-gis.bo/problemas/ya-voto',
    );
  });
});

describe('cargarConfigHttp', () => {
  it('en desarrollo usa valores por defecto', () => {
    expect(cargarConfigHttp({ JWT_SECRET: '', JWT_SECRET_ANTERIOR: '' })).toMatchObject({
      jwt: { secretoAnterior: null, duracionS: 86_400 },
      limitePorMinuto: 300,
    });
  });

  it('lee la clave actual, la anterior y los límites', () => {
    const config = cargarConfigHttp({
      JWT_SECRET: SECRETO_DE_PRUEBA,
      JWT_SECRET_ANTERIOR: SECRETO_ANTERIOR_DE_PRUEBA,
      JWT_DURACION_S: '600',
      LIMITE_POR_MINUTO: '60',
    });

    expect(config).toEqual({
      jwt: {
        secreto: SECRETO_DE_PRUEBA,
        secretoAnterior: SECRETO_ANTERIOR_DE_PRUEBA,
        duracionS: 600,
      },
      limitePorMinuto: 60,
    });
  });

  it('en producción exige JWT_SECRET, y siempre de al menos 32 caracteres', () => {
    expect(() => cargarConfigHttp({ NODE_ENV: 'production' })).toThrow(ErrorDeConfig);
    expect(() => cargarConfigHttp({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET/);
    expect(() => cargarConfigHttp({ JWT_SECRET: 'corto' })).toThrow(/32/);
  });
});

describe('documento OpenAPI', () => {
  it('el contrato guardado para el cliente está al día (`pnpm gen:api`)', async () => {
    const guardado = JSON.parse(
      await readFile(
        new URL('../../../../packages/api-client/openapi.json', import.meta.url),
        'utf8',
      ),
    );

    expect(await documentoOpenApi()).toEqual(guardado);
  });
});
