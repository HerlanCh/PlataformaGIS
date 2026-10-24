// Reportador de errores de la API (roadmap 12): GlitchTip si hay DSN; si no, ninguno.
import { randomUUID } from 'node:crypto';
import { crearReportador, reportadorNulo } from '@gis/errores-remotos';
import type { ReportadorDeErrores } from '@gis/errores-remotos';
import type { ConfigHttp } from '../http/config-http.js';

/** Un envío que tarde más se abandona: nunca retiene a la API. */
const PLAZO_DE_ENVIO_MS = 5000;

const enviarConFetch = (url: string, cuerpo: string) =>
  fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: cuerpo,
    signal: AbortSignal.timeout(PLAZO_DE_ENVIO_MS),
  });

export function reportadorDeLaApi(
  errores: ConfigHttp['errores'],
  version: string,
  enviar: (url: string, cuerpo: string) => Promise<unknown> = enviarConFetch,
): ReportadorDeErrores {
  if (!errores) return reportadorNulo;
  return crearReportador({
    ...errores,
    version,
    plataforma: 'node',
    enviar,
    generarId: randomUUID,
  });
}
