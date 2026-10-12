import { z } from 'zod';

/** Sobre común de todo evento de integración entre módulos. */
export const esquemaEventoDeIntegracion = z.object({
  id: z.uuid(),
  tipo: z.string().min(1),
  version: z.number().int().positive(),
  ocurridoEn: z.iso.datetime(),
  contenido: z.unknown(),
});

export type EventoDeIntegracion = z.infer<typeof esquemaEventoDeIntegracion>;

/**
 * A quién puede llegar un evento.
 * - `publico`: puede difundirse a los clientes; nunca lleva ubicación real ni autor.
 * - `interno`: solo circula entre módulos del servidor.
 */
export type AudienciaDeEvento = 'publico' | 'interno';

/** Clave con la que se publica y se suscribe un evento: `ReporteCreado.v1`. */
export const claveDeEvento = (evento: Pick<EventoDeIntegracion, 'tipo' | 'version'>): string =>
  `${evento.tipo}.v${evento.version}`;

/**
 * Declara un evento versionado. Un cambio incompatible crea una versión nueva;
 * un evento publicado nunca se modifica.
 */
export function definirEvento<
  Type extends string,
  Version extends number,
  Payload extends z.ZodType,
>(tipo: Type, version: Version, audiencia: AudienciaDeEvento, contenido: Payload) {
  return {
    tipo,
    version,
    audiencia,
    clave: claveDeEvento({ tipo, version }),
    contenido,
    esquema: esquemaEventoDeIntegracion.extend({
      tipo: z.literal(tipo),
      version: z.literal(version),
      contenido,
    }),
  };
}

export type DefinicionDeEvento = ReturnType<typeof definirEvento>;
