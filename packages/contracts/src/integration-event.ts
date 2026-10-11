import { z } from 'zod';

/** Sobre común de todo evento de integración entre módulos. */
export const integrationEventSchema = z.object({
  id: z.uuid(),
  type: z.string().min(1),
  version: z.number().int().positive(),
  occurredAt: z.iso.datetime(),
  payload: z.unknown(),
});

export type IntegrationEvent = z.infer<typeof integrationEventSchema>;

/**
 * A quién puede llegar un evento.
 * - `public`: puede difundirse a los clientes; nunca lleva ubicación real ni autor.
 * - `internal`: solo circula entre módulos del servidor.
 */
export type EventAudience = 'public' | 'internal';

/** Clave con la que se publica y se suscribe un evento: `ReportCreated.v1`. */
export const eventKey = (event: Pick<IntegrationEvent, 'type' | 'version'>): string =>
  `${event.type}.v${event.version}`;

/**
 * Declara un evento versionado. Un cambio incompatible crea una versión nueva;
 * un evento publicado nunca se modifica.
 */
export function defineEvent<Type extends string, Version extends number, Payload extends z.ZodType>(
  type: Type,
  version: Version,
  audience: EventAudience,
  payload: Payload,
) {
  return {
    type,
    version,
    audience,
    key: eventKey({ type, version }),
    payload,
    schema: integrationEventSchema.extend({
      type: z.literal(type),
      version: z.literal(version),
      payload,
    }),
  };
}

export type EventDefinition = ReturnType<typeof defineEvent>;
