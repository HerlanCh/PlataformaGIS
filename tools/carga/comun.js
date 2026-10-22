// Piezas comunes de los escenarios k6 (`api-basica.js` y `escenario-completo.js`): solicitudes
// etiquetadas por ruta, un punto al azar en la ciudad y el resumen con el p95 de cada ruta.
import http from 'k6/http';
import { Trend } from 'k6/metrics';

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Los votos sobre un reporte propio o repetidos (403, 409) son respuestas esperadas.
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 299 }, 403, 409));

/** Una métrica de duración por ruta, para informar el p95 de cada una. */
export function crearMetricas(rutas) {
  return Object.fromEntries(rutas.map((ruta) => [ruta, new Trend(`duracion_${ruta}`, true)]));
}

// Centro de La Paz y El Alto; cada solicitud cae en un punto al azar cerca de él.
const azar = (min, max) => min + Math.random() * (max - min);
export const puntoAlAzar = () => ({ latitud: azar(-16.55, -16.45), longitud: azar(-68.2, -68.1) });
export const bbox = ({ latitud, longitud }, margen = 0.01) =>
  [longitud - margen, latitud - margen, longitud + margen, latitud + margen]
    .map((n) => n.toFixed(5))
    .join(',');

/** Ventana de los últimos 30 días para el mapa de calor. */
export function ultimos30Dias() {
  const hasta = new Date();
  const desde = new Date(hasta.getTime() - 30 * 86_400_000);
  return `desde=${desde.toISOString()}&hasta=${hasta.toISOString()}`;
}

export function pedir(metricas, ruta, metodo, url, cuerpo, cabeceras) {
  const parametros = {
    // Sin cuerpo no se declara JSON: Fastify rechaza un `application/json` vacío.
    headers: { ...(cuerpo && { 'content-type': 'application/json' }), ...cabeceras },
    // `name` agrupa las URL con ID o parámetros en una sola serie por ruta.
    tags: { ruta, name: ruta },
  };
  const respuesta = http.request(
    metodo,
    `${BASE_URL}${url}`,
    cuerpo && JSON.stringify(cuerpo),
    parametros,
  );
  metricas[ruta].add(respuesta.timings.duration);
  return respuesta;
}

/** Registra un dispositivo nuevo y devuelve su token. */
export function registrarDispositivo(metricas, prefijo) {
  const registro = pedir(metricas, 'dispositivos', 'POST', '/v1/dispositivos', {
    hashDispositivo: `${prefijo}-${__VU}-${Date.now()}-${Math.floor(Math.random() * 1e9)}`,
  });
  return registro.status === 200 ? registro.json('token') : null;
}

/**
 * Resumen en JSON: solicitudes, tasa de fallos y p95 global y por ruta. `archivo` es la ruta dentro
 * del contenedor de Docker; con k6 instalado en la máquina se cambia con SALIDA.
 */
export function resumir(datos, metricas, archivo) {
  const p95 = (metrica) => datos.metrics[metrica]?.values['p(95)'];
  const resumen = {
    fecha: new Date().toISOString(),
    baseUrl: BASE_URL,
    solicitudes: datos.metrics.http_reqs.values.count,
    fallidas: datos.metrics.http_req_failed.values.rate,
    p95Global: p95('http_req_duration'),
    p95PorRuta: Object.fromEntries(Object.keys(metricas).map((r) => [r, p95(`duracion_${r}`)])),
    verificacionesFallidas: Object.fromEntries(
      (datos.root_group?.checks ?? [])
        .filter((c) => c.fails > 0)
        .map((c) => [c.name, `${c.fails} de ${c.passes + c.fails}`]),
    ),
  };
  return {
    stdout: `${JSON.stringify(resumen, null, 2)}\n`,
    [__ENV.SALIDA || archivo]: JSON.stringify(resumen, null, 2),
  };
}
