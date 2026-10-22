// Carga básica de la API (Fase 6, RNF-09: p95 < 300 ms). Se ejecuta con k6 en Docker:
//   docker run --rm -v "$PWD/tools/carga:/carga" -e BASE_URL=https://plataforma-gis-api.onrender.com \
//     grafana/k6:2.3.0 run /carga/api-basica.js
// Cada usuario virtual registra su dispositivo, mira el mapa, pide el mapa de calor, crea reportes
// (dentro del límite de 5 cada 10 minutos) y vota uno ajeno.
import { check, sleep } from 'k6';
import {
  bbox,
  crearMetricas,
  pedir,
  puntoAlAzar,
  registrarDispositivo,
  resumir,
  ultimos30Dias,
} from './comun.js';

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

const metricas = crearMetricas(['dispositivos', 'crear', 'listar', 'mapa', 'votar']);

let token = null;
let reportesCreados = 0;

export default function () {
  token ??= registrarDispositivo(metricas, 'k6');
  const auth = { authorization: `Bearer ${token}` };
  const punto = puntoAlAzar();

  const lista = pedir(metricas, 'listar', 'GET', `/v1/reportes?bbox=${bbox(punto)}`);
  check(lista, { 'listar 200': (r) => r.status === 200 });

  const mapa = pedir(
    metricas,
    'mapa',
    'GET',
    `/v1/mapa-calor?bbox=${bbox(punto)}&${ultimos30Dias()}`,
  );
  check(mapa, { 'mapa 200': (r) => r.status === 200 });

  if (reportesCreados < MAX_REPORTES_POR_USUARIO) {
    reportesCreados += 1;
    const creado = pedir(
      metricas,
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
      metricas,
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
  return resumir(datos, metricas, '/carga/resultado.json');
}
