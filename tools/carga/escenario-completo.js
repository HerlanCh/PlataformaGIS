// Escenario completo de la API (Fase 11, prueba 1; RNF-09: p95 < 300 ms; RNF-08: errores < 1 %).
// Recorre todas las funciones públicas: registro, ventana del mapa, mapa de calor, crear y votar
// reportes, zonas suscritas (alta, lista y baja) y el resumen de datos abiertos. Con k6 en Docker:
//   docker run --rm -v "$PWD/tools/carga:/carga" -e BASE_URL=<url> [-e VUS=4 -e PAUSA_S=4] \
//     grafana/k6:2.3.0 run /carga/escenario-completo.js
// En staging se usan 4 usuarios y 7 s de pausa (unas 8 solicitudes por iteración) para quedar bajo
// el límite de 300 solicitudes por minuto por IP: k6 sale de una sola IP. En local se sube VUS con
// LIMITE_POR_MINUTO alto en la API.
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

const VUS = Number(__ENV.VUS || 4);
const PAUSA_S = Number(__ENV.PAUSA_S || 4);
const DURACION = __ENV.DURACION || '2m';
// Límites de la API por usuario cada 10 minutos: 5 reportes y 30 votos. La corrida dura menos.
const MAX_REPORTES_POR_USUARIO = 5;
const MAX_VOTOS_POR_USUARIO = 30;

const RUTAS = [
  'dispositivos',
  'listar',
  'mapa',
  'crear',
  'votar',
  'zona_crear',
  'zona_listar',
  'zona_eliminar',
  'datos_abiertos',
];
const metricas = crearMetricas(RUTAS);

// Cada ruta tiene su propio umbral, salvo el registro: se hace una vez por usuario y su p95 sale de
// pocas muestras (se informa igual).
const umbralesPorRuta = Object.fromEntries(
  RUTAS.filter((ruta) => ruta !== 'dispositivos').map((ruta) => [
    `duracion_${ruta}`,
    ['p(95)<300'],
  ]),
);

export const options = {
  scenarios: {
    completo: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: VUS },
        { duration: DURACION, target: VUS },
        { duration: '15s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<300'],
    ...umbralesPorRuta,
  },
};

let token = null;
let reportesCreados = 0;
let votos = 0;
let idZona = null;

function reportarYVotar(auth, punto, reportes) {
  if (reportesCreados < MAX_REPORTES_POR_USUARIO) {
    reportesCreados += 1;
    const creado = pedir(
      metricas,
      'crear',
      'POST',
      '/v1/reportes',
      { codigoCategoria: 'bloqueo', ...punto },
      { ...auth, 'idempotency-key': `k6c-${__VU}-${__ITER}-${Date.now()}` },
    );
    check(creado, { 'crear 200/201': (r) => r.status === 200 || r.status === 201 });
  }
  if (reportes.length === 0 || votos >= MAX_VOTOS_POR_USUARIO) return;
  votos += 1;
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

/** Alterna alta, lista y baja de una zona suscrita del usuario. */
function gestionarZona(auth, punto) {
  if (idZona === null) {
    const zona = pedir(
      metricas,
      'zona_crear',
      'POST',
      '/v1/suscripciones',
      { ...punto, radioM: 500, categorias: ['bloqueo', 'accidente'] },
      auth,
    );
    check(zona, { 'zona 201': (r) => r.status === 201 });
    idZona = zona.status === 201 ? zona.json('id') : null;
    return;
  }
  const zonas = pedir(metricas, 'zona_listar', 'GET', '/v1/suscripciones', null, auth);
  check(zonas, { 'zonas 200': (r) => r.status === 200 });
  if (__ITER % 2 === 0) {
    const baja = pedir(
      metricas,
      'zona_eliminar',
      'DELETE',
      `/v1/suscripciones/${idZona}`,
      null,
      auth,
    );
    check(baja, { 'zona eliminada 204': (r) => r.status === 204 });
    idZona = null;
  }
}

export default function () {
  token ??= registrarDispositivo(metricas, 'k6c');
  const auth = { authorization: `Bearer ${token}` };
  const punto = puntoAlAzar();

  const lista = pedir(metricas, 'listar', 'GET', `/v1/reportes?bbox=${bbox(punto)}`);
  check(lista, { 'listar 200': (r) => r.status === 200 });

  const mapa = pedir(
    metricas,
    'mapa',
    'GET',
    `/v1/mapa-calor?bbox=${bbox(punto, 0.03)}&${ultimos30Dias()}`,
  );
  check(mapa, { 'mapa 200': (r) => r.status === 200 });

  reportarYVotar(auth, punto, lista.status === 200 ? lista.json('reportes') : []);
  gestionarZona(auth, punto);

  const abiertos = pedir(metricas, 'datos_abiertos', 'GET', '/v1/datos-abiertos/resumen');
  check(abiertos, { 'datos abiertos 200': (r) => r.status === 200 });

  sleep(PAUSA_S);
}

export function handleSummary(datos) {
  return resumir(datos, metricas, '/carga/resultado-completo.json');
}
