import { idUsuario } from '@gis/shared-kernel';
import { describe, expect, it } from 'vitest';
import { AscenderAModerador } from '../application/ascender-a-moderador.js';
import { Usuario } from '../domain/user.js';
import { UsuariosEnMemoria } from './dobles.js';

const ID = '00000000-0000-4000-8000-000000000001';

function escenario() {
  const usuarios = new UsuariosEnMemoria();
  usuarios.filas.set(
    idUsuario(ID),
    Usuario.registrarDispositivo({
      id: idUsuario(ID),
      hashDispositivo: 'a3f1c2d4e5b6978812345678',
      ahora: new Date('2026-10-19T12:00:00Z'),
    }),
  );
  return { usuarios, ascender: new AscenderAModerador(usuarios) };
}

describe('AscenderAModerador', () => {
  it('HU-12: da el rol MODERADOR a un ciudadano', async () => {
    const { usuarios, ascender } = escenario();

    expect(await ascender.ejecutar({ idUsuario: ID })).toBe('ASCENDIDO');
    expect((await usuarios.buscarPorId(idUsuario(ID)))?.rol).toBe('MODERADOR');
  });

  it('repetirlo no cambia nada', async () => {
    const { ascender } = escenario();
    await ascender.ejecutar({ idUsuario: ID });

    expect(await ascender.ejecutar({ idUsuario: ID })).toBe('YA_ERA_MODERADOR');
  });

  it('un usuario inexistente da NO_ENCONTRADO y un id mal escrito, VALIDACION_FALLIDA', async () => {
    const { ascender } = escenario();

    await expect(
      ascender.ejecutar({ idUsuario: '00000000-0000-4000-8000-000000000999' }),
    ).rejects.toMatchObject({ tipo: 'NO_ENCONTRADO', codigo: 'USUARIO_NO_ENCONTRADO' });
    await expect(ascender.ejecutar({ idUsuario: 'no-es-un-uuid' })).rejects.toMatchObject({
      tipo: 'VALIDACION_FALLIDA',
    });
  });
});
