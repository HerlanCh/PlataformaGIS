// Carga básica de la API (Fase 6, RNF-09: p95 < 300 ms). Se ejecuta con k6 en Docker:
//   docker run --rm -v "$PWD/tools/carga:/carga" -e BASE_URL=https://plataforma-gis-api.onrender.com \
//     grafana/k6:2.3.0 run /carga/api-basica.js
// Cada usuario virtual registra su dispositivo, mira el mapa, pide el mapa de calor, crea reportes
// (dentro del límite de 5 cada 10 minutos) y vota uno ajeno.
import { check, sleep } from 'k6';
import http from 'k6/http';
import { Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const MAX_REPORTES_POR_USUARIO = 5;

export const options = {
  scenarios: {
    basico: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 4 },
        { duration: '2m', target: 4 },
        { duration: '15s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<300'],
  },
};

// Los votos sobre un reporte propio o repetidos (403, 409) son respuestas esperadas.
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 299 }, 403, 409));

const porRuta = {};
for (const ruta of ['dispositivos', 'crear', 'listar', 'mapa', 'votar']) {
  porRuta[ruta] = new Trend(`duracion_${ruta}`, true);
}

// Centro de La Paz y El Alto; cada solicitud cae en un punto al azar cerca de él.
const azar = (min, max) => min + Math.random() * (max - min);
const puntoAlAzar = () => ({ latitud: azar(-16.55, -16.45), longitud: azar(-68.2, -68.1) });
const bbox = ({ latitud, longitud }) =>
  [longitud - 0.01, latitud - 0.01, longitud + 0.01, latitud + 0.01]
    .map((n) => n.toFixed(5))
    .join(',');

function pedir(ruta, metodo, url, cuerpo, cabeceras) {
  const parametros = {
    headers: { 'content-type': 'application/json', ...cabeceras },
    tags: { ruta },
  };
  const respuesta = http.request(
    metodo,
    `${BASE_URL}${url}`,
    cuerpo && JSON.stringify(cuerpo),
    parametros,
  );
  porRuta[ruta].add(respuesta.timings.duration);
  return respuesta;
}

let token = null;
let reportesCreados = 0;

export default function () {
  if (token === null) {
    const registro = pedir('dispositivos', 'POST', '/v1/dispositivos', {
      hashDispositivo: `k6-${__VU}-${Date.now()}-${Math.floor(Math.random() * 1e9)}`,
    });
    check(registro, { 'registro 200': (r) => r.status === 200 });
    token = registro.json('token');
  }
  const auth = { authorization: `Bearer ${token}` };
  const punto = puntoAlAzar();

  const lista = pedir('listar', 'GET', `/v1/reportes?bbox=${bbox(punto)}`);
  check(lista, { 'listar 200': (r) => r.status === 200 });

  const hasta = new Date();
  const desde = new Date(hasta.getTime() - 30 * 86_400_000);
  const mapa = pedir(
    'mapa',
    'GET',
    `/v1/mapa-calor?bbox=${bbox(punto)}&desde=${desde.toISOString()}&hasta=${hasta.toISOString()}`,
  );
  check(mapa, { 'mapa 200': (r) => r.status === 200 });

  if (reportesCreados < MAX_REPORTES_POR_USUARIO) {
    reportesCreados += 1;
    const creado = pedir(
      'crear',
      'POST',
      '/v1/reportes',
      { codigoCategoria: 'bloqueo', ...punto },
      { ...auth, 'idempotency-key': `k6-${__VU}-${__ITER}-${Date.now()}` },
    );
    check(creado, { 'crear 200/201': (r) => r.status === 200 || r.status === 201 });
  }

  const reportes = lista.status === 200 ? lista.json('reportes') : [];
  if (reportes.length > 0) {
    const objetivo = reportes[Math.floor(Math.random() * reportes.length)];
    const voto = pedir(
      'votar',
      'POST',
      `/v1/reportes/${objetivo.id}/confirmar`,
      objetivo.publicLocation,
      auth,
    );
    check(voto, { 'votar 200/403/409': (r) => [200, 403, 409].includes(r.status) });
  }

  // Con 4 usuarios y 4 s entre iteraciones se queda bajo el límite de 300 solicitudes por minuto
  // por IP: k6 sale de una sola IP.
  sleep(4);
}

export function handleSummary(datos) {
  const p95 = (metrica) => datos.metrics[metrica]?.values['p(95)'];
  const resumen = {
    fecha: new Date().toISOString(),
    baseUrl: BASE_URL,
    solicitudes: datos.metrics.http_reqs.values.count,
    fallidas: datos.metrics.http_req_failed.values.rate,
    p95Global: p95('http_req_duration'),
    p95PorRuta: Object.fromEntries(Object.keys(porRuta).map((r) => [r, p95(`duracion_${r}`)])),
  };
  return {
    stdout: `${JSON.stringify(resumen, null, 2)}\n`,
    '/carga/resultado.json': JSON.stringify(resumen, null, 2),
  };
}
