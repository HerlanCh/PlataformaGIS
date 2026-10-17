import { http } from '@gis/contracts';
import type { ReportePublico } from '@gis/module-reports';
import type { ZonaSuscrita } from '@gis/module-subscriptions';
import type { z } from 'zod';

/** Respuestas de error que puede dar cualquier ruta, todas en formato RFC 7807. */
export const ERRORES = {
  400: http.esquemaProblema,
  401: http.esquemaProblema,
  403: http.esquemaProblema,
  404: http.esquemaProblema,
  409: http.esquemaProblema,
  422: http.esquemaProblema,
  429: http.esquemaProblema,
} as const;

/** Proyección pública → JSON. Solo los campos del contrato: nunca la ubicación real ni el autor. */
export const aReporteHttp = (
  reporte: ReportePublico,
): z.output<typeof http.esquemaReportePublico> => ({
  id: reporte.id,
  codigoCategoria: reporte.codigoCategoria,
  estado: reporte.estado,
  publicLocation: {
    latitud: reporte.publicLocation.latitud,
    longitud: reporte.publicLocation.longitud,
  },
  creadoEn: reporte.creadoEn.toISOString(),
  caducaEn: reporte.caducaEn.toISOString(),
});

export const aZonaHttp = (zona: ZonaSuscrita): z.output<typeof http.esquemaZona> => ({
  id: zona.id,
  centro: { latitud: zona.centro.latitud, longitud: zona.centro.longitud },
  radioM: zona.radioM,
  categorias: [...zona.categorias],
  creadoEn: zona.creadoEn.toISOString(),
});
