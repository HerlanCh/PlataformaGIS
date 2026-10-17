import { validarEntrada } from '@gis/contracts';
import { aErrorDeAplicacion, idUsuario } from '@gis/shared-kernel';
import type { GeneradorDeId, IdUsuario, Reloj } from '@gis/shared-kernel';
import { z } from 'zod';
import type { RepositorioDeUsuarios } from '../domain/ports.js';
import { Usuario } from '../domain/user.js';
import type { Rol } from '../domain/user.js';

const esquemaEntrada = z.object({ hashDispositivo: z.string() });

export type EntradaRegistrarDispositivo = z.input<typeof esquemaEntrada>;

export interface SalidaRegistrarDispositivo {
  readonly idUsuario: IdUsuario;
  readonly rol: Rol;
  /** `false` si el dispositivo ya estaba registrado. */
  readonly esNuevo: boolean;
}

export interface DependenciasRegistrarDispositivo {
  readonly usuarios: RepositorioDeUsuarios;
  readonly reloj: Reloj;
  readonly ids: GeneradorDeId;
}

const salida = (usuario: Usuario, esNuevo: boolean): SalidaRegistrarDispositivo => ({
  idUsuario: usuario.id,
  rol: usuario.rol,
  esNuevo,
});

/**
 * RF-01: crea un usuario anónimo para el dispositivo o recupera el que ya tiene. La credencial
 * firmada (JWT) la emite el adaptador HTTP en la Fase 6.
 */
export class RegistrarDispositivo {
  constructor(private readonly deps: DependenciasRegistrarDispositivo) {}

  async ejecutar(entrada: EntradaRegistrarDispositivo): Promise<SalidaRegistrarDispositivo> {
    const { hashDispositivo } = validarEntrada(esquemaEntrada, entrada);
    const existente = await this.deps.usuarios.buscarPorHashDispositivo(hashDispositivo);
    if (existente) return salida(existente, false);

    let nuevo: Usuario;
    try {
      nuevo = Usuario.registrarDispositivo({
        id: idUsuario(this.deps.ids.siguiente()),
        hashDispositivo,
        ahora: this.deps.reloj.ahora(),
      });
    } catch (error) {
      throw aErrorDeAplicacion(error, { HASH_DE_DISPOSITIVO_INVALIDO: 'VALIDACION_FALLIDA' });
    }

    try {
      await this.deps.usuarios.guardar(nuevo);
    } catch (error) {
      // Dos registros simultáneos del mismo dispositivo: el segundo devuelve el del primero.
      const ganador = await this.deps.usuarios.buscarPorHashDispositivo(hashDispositivo);
      if (ganador) return salida(ganador, false);
      throw error;
    }
    return salida(nuevo, true);
  }
}
