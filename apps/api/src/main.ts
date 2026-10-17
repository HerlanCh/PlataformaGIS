import {
  CaducarReportes,
  RepositorioReportesPostgis,
  UnidadDeTrabajoReportePg,
} from '@gis/module-reports';
import {
  BusDeEventosConSalida,
  cargarConfig,
  cargarInterruptores,
  crearDb,
  crearPool,
  crearRegistro,
  DespachadorDeSalida,
} from '@gis/platform';
import { crearApagado } from './apagado.js';
import { construirApp } from './app.js';
import { componerCasosDeUso, generadorUuid, relojDelSistema } from './composicion/casos-de-uso.js';
import { LimitadorDeFrecuenciaEnProceso } from './composicion/limitador.js';
import { suscribirManejadores } from './composicion/manejadores.js';
import { ProgramadorDeTareas } from './composicion/programador.js';
import { cargarConfigHttp } from './http/config-http.js';
import { ServicioDeTokens } from './http/tokens.js';
import { modulos } from './modules.generated.js';
import { adjuntarTiempoReal } from './tiempo-real/servidor.js';

const config = cargarConfig();
const configHttp = cargarConfigHttp();
const interruptores = cargarInterruptores();
const registro = crearRegistro(config.nivelDeLog);
const pool = crearPool(config.urlBaseDeDatos, (error) => {
  registro.error({ err: error }, 'error en una conexión inactiva de la base de datos');
});
const db = crearDb(pool);
const bus = new BusDeEventosConSalida(db);
const tokens = new ServicioDeTokens(configHttp.jwt, relojDelSistema);

const app = await construirApp({
  config,
  interruptores,
  registro,
  db: pool,
  bus,
  modulos,
  api: {
    casos: componerCasosDeUso({
      db,
      interruptores,
      limitador: new LimitadorDeFrecuenciaEnProceso(relojDelSistema),
    }),
    tokens,
    limitePorMinuto: configHttp.limitePorMinuto,
  },
});
const tiempoReal = adjuntarTiempoReal(app.server, { origenCors: config.origenCors, tokens });

suscribirManejadores({
  bus,
  db,
  interruptores,
  registro,
  tiempoReal,
  reloj: relojDelSistema,
  ids: generadorUuid,
});
const despachador = new DespachadorDeSalida(db, bus, {
  registro,
  intervaloMs: configHttp.despachoIntervaloMs,
});

const caducar = new CaducarReportes({
  reportes: new RepositorioReportesPostgis(db),
  unidadDeTrabajo: new UnidadDeTrabajoReportePg(db),
  reloj: relojDelSistema,
  ids: generadorUuid,
});
const programador = new ProgramadorDeTareas(registro);
programador.programar({
  nombre: 'caducar-reportes',
  intervaloMs: configHttp.caducidadIntervaloS * 1000,
  ejecutar: () => caducar.ejecutar(),
});

const apagar = crearApagado({
  registro,
  recursos: [
    { nombre: 'tareas', cerrar: () => programador.detener() },
    { nombre: 'despachador', cerrar: () => despachador.detener() },
    { nombre: 'websocket', cerrar: () => tiempoReal.close() },
    { nombre: 'http', cerrar: () => app.close() },
    { nombre: 'base de datos', cerrar: () => pool.end() },
  ],
});
process.once('SIGTERM', () => void apagar('SIGTERM'));
process.once('SIGINT', () => void apagar('SIGINT'));

await app.listen({ port: config.puerto, host: '0.0.0.0' });
despachador.iniciar();
