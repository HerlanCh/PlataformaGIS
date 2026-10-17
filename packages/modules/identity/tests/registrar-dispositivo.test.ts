import type { IdUsuario } from '@gis/shared-kernel';
import { GeneradorDeIdSecuencial, RelojFijo } from '@gis/testing';
import { describe, expect, it } from 'vitest';
import { RegistrarDispositivo } from '../application/registrar-dispositivo.js';
import type { RepositorioDeUsuarios } from '../domain/ports.js';
import type { Usuario } from '../domain/user.js';

class UsuariosEnMemoria implements RepositorioDeUsuarios {
  readonly filas = new Map<IdUsuario, Usuario>();

  buscarPorId(id: IdUsuario): Promise<Usuario | null> {
    return Promise.resolve(this.filas.get(id) ?? null);
  }

  buscarPorHashDispositivo(hash: string): Promise<Usuario | null> {
    return Promise.resolve(
      [...this.filas.values()].find((u) => u.hashDispositivo === hash) ?? null,
    );
  }

  buscarPorIdTelegram(idTelegram: string): Promise<Usuario | null> {
    return Promise.resolve(
      [...this.filas.values()].find((u) => u.idTelegram === idTelegram) ?? null,
    );
  }

  guardar(usuario: Usuario): Promise<void> {
    this.filas.set(usuario.id, usuario);
    return Promise.resolve();
  }
}

const HASH = 'a3f1c2d4e5b6978812345678';

function escenario() {
  const usuarios = new UsuariosEnMemoria();
  const deps = { usuarios, reloj: new RelojFijo(), ids: new GeneradorDeIdSecuencial() };
  return { usuarios, deps, registrar: new RegistrarDispositivo(deps) };
}

describe('RegistrarDispositivo', () => {
  it('RF-01: un dispositivo nuevo obtiene un usuario anónimo con rol CIUDADANO', async () => {
    const { registrar, usuarios } = escenario();

    const salida = await registrar.ejecutar({ hashDispositivo: HASH });

    expect(salida).toEqual({
      idUsuario: '00000000-0000-4000-8000-000000000001',
      rol: 'CIUDADANO',
      esNuevo: true,
    });
    expect(usuarios.filas.size).toBe(1);
  });

  it('RF-01: el mismo dispositivo recupera su usuario en vez de crear otro', async () => {
    const { registrar, usuarios } = escenario();
    const primero = await registrar.ejecutar({ hashDispositivo: HASH });

    const segundo = await registrar.ejecutar({ hashDispositivo: HASH });

    expect(segundo).toEqual({ ...primero, esNuevo: false });
    expect(usuarios.filas.size).toBe(1);
  });

  it('rechaza un hash de dispositivo mal formado', async () => {
    const { registrar } = escenario();

    await expect(registrar.ejecutar({ hashDispositivo: 'corto' })).rejects.toMatchObject({
      tipo: 'VALIDACION_FALLIDA',
      codigo: 'HASH_DE_DISPOSITIVO_INVALIDO',
    });
  });

  it('si otro registro simultáneo del mismo dispositivo ganó, devuelve ese usuario', async () => {
    const { deps, usuarios } = escenario();
    const otro = new RegistrarDispositivo({
      ...deps,
      ids: new GeneradorDeIdSecuencial('99999999'),
    });
    const conCarrera = { ...deps, usuarios: Object.create(usuarios) as UsuariosEnMemoria };
    conCarrera.usuarios.guardar = async () => {
      await otro.ejecutar({ hashDispositivo: HASH });
      throw new Error('clave duplicada');
    };
    conCarrera.usuarios.buscarPorHashDispositivo = async (hash) => {
      // Antes del guardado no existe; después, el del ganador.
      return usuarios.buscarPorHashDispositivo(hash);
    };

    const salida = await new RegistrarDispositivo(conCarrera).ejecutar({ hashDispositivo: HASH });

    expect(salida).toEqual({
      idUsuario: '99999999-0000-4000-8000-000000000001',
      rol: 'CIUDADANO',
      esNuevo: false,
    });
  });

  it('propaga el error de guardado si nadie más registró el dispositivo', async () => {
    const { deps, usuarios } = escenario();
    usuarios.guardar = () => Promise.reject(new Error('sin conexión'));

    await expect(
      new RegistrarDispositivo(deps).ejecutar({ hashDispositivo: HASH }),
    ).rejects.toThrow('sin conexión');
  });
});
