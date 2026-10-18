// Contrato HTTP de la API `/v1`. Estos esquemas validan las solicitudes, serializan las respuestas
// y generan el documento OpenAPI: lo que no está aquí no sale del servidor (RNF-14).
import { z } from 'zod';
import {
  esquemaCodigoCategoria,
  esquemaDecisionVerificacion,
  esquemaEstadoReporte,
  esquemaPuntoGeo,
} from './events.js';

const conId = <T extends z.ZodType>(esquema: T, id: string, descripcion: string): T =>
  esquema.meta({ id, description: descripcion });

// --- Comunes ---

/** Error en formato RFC 7807 (`application/problem+json`). */
export const esquemaProblema = conId(
  z.object({
    type: z.string(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string(),
    /** Código estable que el cliente puede leer: `YA_VOTO`, `TOKEN_VENCIDO`, etc. */
    codigo: z.string(),
    /** ID de correlación de la solicitud. */
    instance: z.string(),
  }),
  'Problema',
  'Error en formato RFC 7807',
);

const esquemaFecha = z.iso.datetime();
const esquemaUuid = z.uuid();

/** `lonMin,latMin,lonMax,latMax`, la convención de OpenAPI y de Leaflet. */
export const esquemaBbox = z
  .string()
  .regex(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/, 'bbox debe ser lonMin,latMin,lonMax,latMax')
  .transform((texto) => {
    const [longitudMin, latitudMin, longitudMax, latitudMax] = texto.split(',').map(Number) as [
      number,
      number,
      number,
      number,
    ];
    return { latitudMin, latitudMax, longitudMin, longitudMax };
  })
  .meta({
    description: 'Ventana como lonMin,latMin,lonMax,latMax',
    example: '-68.16,-16.51,-68.14,-16.49',
  });

/** Lista separada por comas: `bloqueo,robo`. Vacía o ausente significa todas. */
const esquemaListaDeCategorias = z
  .string()
  .regex(/^[a-z][a-z0-9_]*(,[a-z][a-z0-9_]*)*$/, 'categorias debe ser una lista separada por comas')
  .transform((texto) => texto.split(','))
  .optional()
  .meta({ description: 'Códigos de categoría separados por comas', example: 'bloqueo,robo' });

export const esquemaParametroId = z.object({ id: esquemaUuid });

// --- Dispositivos ---

export const esquemaRegistroDispositivo = conId(
  z.object({ hashDispositivo: z.string().min(1).max(128) }),
  'RegistroDispositivo',
  'Hash anónimo del dispositivo que genera el cliente',
);

export const esquemaCredencial = conId(
  z.object({
    idUsuario: esquemaUuid,
    rol: z.enum(['CIUDADANO', 'MODERADOR']),
    esNuevo: z.boolean(),
    /** JWT para la cabecera `Authorization: Bearer`. */
    token: z.string(),
    expiraEn: esquemaFecha,
  }),
  'Credencial',
  'Usuario anónimo y su token de acceso',
);

// --- Reportes ---

export const esquemaReportePublico = conId(
  z.object({
    id: esquemaUuid,
    codigoCategoria: esquemaCodigoCategoria,
    estado: esquemaEstadoReporte,
    publicLocation: esquemaPuntoGeo,
    creadoEn: esquemaFecha,
    caducaEn: esquemaFecha,
  }),
  'ReportePublico',
  'Lo que el público ve de un reporte: nunca la ubicación real ni el autor',
);

export const esquemaNuevoReporte = conId(
  z.object({
    codigoCategoria: esquemaCodigoCategoria,
    latitud: z.number(),
    longitud: z.number(),
  }),
  'NuevoReporte',
  'Categoría y posición del reporte',
);

export const esquemaCabecerasNuevoReporte = z.object({
  'idempotency-key': z
    .string()
    .meta({ description: 'Clave única que genera el cliente; un reenvío no crea otro reporte' }),
});

export const esquemaReporteCreado = conId(
  z.object({
    resultado: z.enum(['CREADO', 'DUPLICADO', 'PROPIO_EXISTENTE']),
    reporte: esquemaReportePublico,
  }),
  'ResultadoDeReporte',
  'CREADO, o DUPLICADO / PROPIO_EXISTENTE con el reporte vigente que ya existía',
);

export const esquemaConsultaReportes = z.object({
  bbox: esquemaBbox,
  categorias: esquemaListaDeCategorias,
});

export const esquemaListaDeReportes = conId(
  z.object({ reportes: z.array(esquemaReportePublico) }),
  'ListaDeReportes',
  'Reportes vigentes de la ventana, del más reciente al más antiguo',
);

// --- Votos ---

export const esquemaVoto = conId(
  z.object({ latitud: z.number(), longitud: z.number() }),
  'Voto',
  'Posición de quien vota: debe estar a 1000 m o menos del incidente',
);

export const esquemaVotoRegistrado = conId(
  z.object({ peso: z.number(), decision: esquemaDecisionVerificacion }),
  'VotoRegistrado',
  'Peso con el que contó el voto y decisión de verificación',
);

// --- Mapa de calor ---

export const esquemaConsultaMapaCalor = z.object({
  bbox: esquemaBbox,
  desde: esquemaFecha,
  hasta: esquemaFecha,
  tamanoCelda: z.coerce
    .number()
    .int()
    .optional()
    .meta({ description: 'Lado de la celda en metros' }),
  categorias: esquemaListaDeCategorias,
});

export const esquemaMapaDeCalor = conId(
  z.object({
    celdas: z.array(
      z.object({ latitud: z.number(), longitud: z.number(), cantidad: z.number().int() }),
    ),
  }),
  'MapaDeCalor',
  'Celdas con 3 o más reportes y su centro',
);

// --- Suscripciones ---

export const esquemaNuevaZona = conId(
  z.object({
    latitud: z.number(),
    longitud: z.number(),
    radioM: z.number().int(),
    categorias: z.array(esquemaCodigoCategoria),
  }),
  'NuevaZona',
  'Centro, radio entre 100 m y 2000 m y categorías de la zona',
);

export const esquemaZona = conId(
  z.object({
    id: esquemaUuid,
    centro: esquemaPuntoGeo,
    radioM: z.number().int(),
    categorias: z.array(esquemaCodigoCategoria),
    creadoEn: esquemaFecha,
  }),
  'Zona',
  'Zona suscrita',
);

export const esquemaListaDeZonas = conId(
  z.object({ zonas: z.array(esquemaZona) }),
  'ListaDeZonas',
  'Zonas suscritas del usuario, de la más reciente a la más antigua',
);

// --- Moderación ---

export const esquemaRechazo = conId(
  z.object({ motivo: z.string().min(1).max(500) }),
  'Rechazo',
  'Motivo del rechazo',
);

/** Respuesta sin cuerpo (204 y 202). */
export const esquemaSinContenido = z.undefined();
