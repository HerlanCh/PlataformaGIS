import { describe, expect, it } from 'vitest';
import {
  verificarBaseDeDatos,
  crearPool,
  ErrorDeConfig,
  crearRegistro,
  variableDeInterruptor,
  cargarConfig,
  cargarInterruptores,
  esBaseDeDatosNoDisponible,
  esClaveDuplicada,
} from './index.js';

describe('esClaveDuplicada', () => {
  const dePg = (code: string, constraint?: string) =>
    Object.assign(new Error('pg'), { code, constraint });

  it('reconoce la violación de clave única en el error o en su causa', () => {
    expect(esClaveDuplicada(dePg('23505'))).toBe(true);
    expect(esClaveDuplicada(new Error('drizzle', { cause: dePg('23505') }))).toBe(true);
  });

  it('con restricción, solo reconoce esa', () => {
    expect(esClaveDuplicada(dePg('23505', 'votos_pkey'), 'votos_pkey')).toBe(true);
    expect(esClaveDuplicada(dePg('23505', 'otra'), 'votos_pkey')).toBe(false);
  });

  it('no confunde otros errores', () => {
    expect(esClaveDuplicada(dePg('23503'))).toBe(false);
    expect(esClaveDuplicada('texto')).toBe(false);
    expect(esClaveDuplicada(undefined)).toBe(false);
  });
});

describe('esBaseDeDatosNoDisponible', () => {
  const conCodigo = (code: string) => Object.assign(new Error('pg'), { code });

  it('reconoce la caída de la base en el error o en su causa', () => {
    expect(esBaseDeDatosNoDisponible(conCodigo('ECONNREFUSED'))).toBe(true);
    expect(esBaseDeDatosNoDisponible(conCodigo('57P01'))).toBe(true);
    expect(esBaseDeDatosNoDisponible(conCodigo('08006'))).toBe(true);
    expect(esBaseDeDatosNoDisponible(new Error('timeout exceeded when trying to connect'))).toBe(
      true,
    );
    expect(esBaseDeDatosNoDisponible(new Error('drizzle', { cause: conCodigo('ETIMEDOUT') }))).toBe(
      true,
    );
  });

  it('no confunde otros errores', () => {
    expect(esBaseDeDatosNoDisponible(conCodigo('23505'))).toBe(false);
    expect(esBaseDeDatosNoDisponible(new Error('otro'))).toBe(false);
    expect(esBaseDeDatosNoDisponible('texto')).toBe(false);
  });
});

const entornoValido = {
  DATABASE_URL: 'postgres://gis:gis@localhost:5432/gis',
  CORS_ORIGIN: 'http://localhost:5173',
};

describe('cargarConfig', () => {
  it('aplica los valores por defecto', () => {
    expect(cargarConfig(entornoValido)).toEqual({
      version: '0.0.0-dev',
      entorno: 'development',
      puerto: 3000,
      nivelDeLog: 'info',
      urlBaseDeDatos: entornoValido.DATABASE_URL,
      origenCors: entornoValido.CORS_ORIGIN,
    });
  });

  it('convierte el puerto a número', () => {
    expect(cargarConfig({ ...entornoValido, PORT: '8080' }).puerto).toBe(8080);
  });

  it('no arranca si falta una variable obligatoria y dice cuál', () => {
    const cargar = () => cargarConfig({ CORS_ORIGIN: entornoValido.CORS_ORIGIN });

    expect(cargar).toThrow(ErrorDeConfig);
    expect(cargar).toThrow(/DATABASE_URL/);
  });

  it('rechaza valores inválidos', () => {
    expect(() => cargarConfig({ ...entornoValido, PORT: 'abc' })).toThrow(/PORT/);
    expect(() => cargarConfig({ ...entornoValido, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });
});

describe('cargarInterruptores', () => {
  it('los módulos imprescindibles siempre están activos', () => {
    const flags = cargarInterruptores({});

    expect(flags.estaActivo('reports')).toBe(true);
    expect(flags.estaActivo('verification')).toBe(true);
    expect(flags.estaActivo('identity')).toBe(true);
  });

  it('un módulo opcional está apagado salvo que su variable sea true', () => {
    const flags = cargarInterruptores({ FEATURE_HEATMAP: 'true', FEATURE_MODERATION: 'false' });

    expect(flags.estaActivo('heatmap')).toBe(true);
    expect(flags.estaActivo('moderation')).toBe(false);
    expect(flags.estaActivo('classifier')).toBe(false);
  });

  it('traduce el nombre del módulo a su variable', () => {
    expect(variableDeInterruptor('open-data')).toBe('FEATURE_OPEN_DATA');
    expect(cargarInterruptores({ FEATURE_OPEN_DATA: 'true' }).estaActivo('open-data')).toBe(true);
  });

  it('rechaza un valor que no sea true o false', () => {
    expect(() => cargarInterruptores({ FEATURE_HEATMAP: 'si' })).toThrow(/FEATURE_HEATMAP/);
  });
});

describe('checkDatabase', () => {
  it('informa que la base de datos responde', async () => {
    await expect(verificarBaseDeDatos({ query: async () => [] })).resolves.toEqual({ ok: true });
  });

  it('informa el error sin lanzarlo', async () => {
    const caida = {
      query: async () => {
        throw new Error('ECONNREFUSED');
      },
    };

    await expect(verificarBaseDeDatos(caida)).resolves.toEqual({
      ok: false,
      error: 'ECONNREFUSED',
    });
  });
});

describe('crearRegistro', () => {
  it('escribe JSON con el nivel configurado', () => {
    const lineas: string[] = [];
    const logger = crearRegistro('info', { write: (linea) => lineas.push(linea) });

    logger.debug('no se escribe');
    logger.info({ reqId: 'r-1' }, 'hola');

    expect(lineas).toHaveLength(1);
    expect(JSON.parse(lineas[0] ?? '')).toMatchObject({ msg: 'hola', reqId: 'r-1' });
  });
});

describe('crearPool', () => {
  it('un error en una conexión inactiva no tumba el proceso y se notifica', async () => {
    const errores: Error[] = [];
    const pool = crearPool('postgres://gis:gis@localhost:5432/gis', (error) => errores.push(error));
    const caida = new Error('terminating connection due to administrator command');

    // Sin un oyente, emitir "error" en un EventEmitter lanza una excepción.
    expect(() => pool.emit('error', caida)).not.toThrow();

    expect(errores).toEqual([caida]);
    await pool.end();
  });
});
