// Prueba de humo tras cada despliegue (roadmap 12): comprueba de punta a punta que la versión
// desplegada sirve. Orden: /health → registro del usuario de humo → escucha por WebSocket → crear
// un reporte → leerlo por HTTP y recibirlo por el socket → rechazarlo como moderador → ya no está.
// La API excluye los reportes del usuario de humo de avisos, datos abiertos y reputación
// (`composicion/humo.ts`). El cliente HTTP y el socket se inyectan para probar el orden sin red.

/** Punto de la prueba: zona deshabitada al noreste, dentro de los límites de La Paz y El Alto. */
export const PUNTO_DE_HUMO = { latitud: -16.4, longitud: -68.02 } as const;

/** Margen de la ventana alrededor del punto, en grados (unos 550 m). */
const MARGEN = 0.005;

export interface Punto {
  readonly latitud: number;
  readonly longitud: number;
}

export interface Credencial {
  readonly idUsuario: string;
  readonly rol: string;
  readonly token: string;
}

/** Suscripción a una ventana del mapa por tiempo real. */
export interface Escucha {
  /** `true` si el `ReporteCreado` de ese reporte llega antes del plazo. */
  recibio(idReporte: string, plazoMs: number): Promise<boolean>;
  cerrar(): void;
}

export interface ClienteDeHumo {
  salud(): Promise<{ readonly status: string; readonly version: string }>;
  registrar(hashDispositivo: string): Promise<Credencial>;
  escuchar(token: string, bbox: string): Promise<Escucha>;
  crearReporte(
    token: string,
    punto: Punto,
    claveIdempotencia: string,
  ): Promise<{ readonly resultado: string; readonly idReporte: string }>;
  /** IDs de los reportes vigentes de la ventana. */
  listar(bbox: string): Promise<readonly string[]>;
  rechazar(token: string, idReporte: string, motivo: string): Promise<void>;
}

export interface OpcionesDeHumo {
  readonly hashDispositivo: string;
  /** Versión que debe servir `/health` (el commit desplegado); sin ella no se comprueba. */
  readonly versionEsperada?: string | undefined;
  /** Sufijo único de la ejecución, para la clave de idempotencia. */
  readonly marca: string;
  readonly plazoMs?: number;
  readonly intentos?: number;
  /** Desplazamiento de cada intento, para no caer como duplicado de un intento anterior. */
  readonly desvio?: (intento: number) => Punto;
  readonly dormir?: (ms: number) => Promise<void>;
}

export class FalloDeHumo extends Error {
  constructor(
    readonly paso: string,
    detalle: string,
  ) {
    super(`${paso}: ${detalle}`);
    this.name = 'FalloDeHumo';
  }
}

export const ventanaDe = ({ latitud, longitud }: Punto): string =>
  [longitud - MARGEN, latitud - MARGEN, longitud + MARGEN, latitud + MARGEN]
    .map((n) => n.toFixed(5))
    .join(',');

const desvioPorDefecto = (intento: number): Punto => ({
  latitud: 0.001 * intento,
  longitud: -0.001 * intento,
});

const dormirPorDefecto = (ms: number) => new Promise<void>((listo) => setTimeout(listo, ms));

function exigir(condicion: boolean, paso: string, detalle: string): asserts condicion {
  if (!condicion) throw new FalloDeHumo(paso, detalle);
}

async function comprobarSalud(cliente: ClienteDeHumo, versionEsperada?: string) {
  const salud = await cliente.salud();
  exigir(salud.status === 'ok', 'salud', `la API responde ${salud.status}`);
  exigir(
    versionEsperada === undefined || salud.version === versionEsperada,
    'salud',
    `la API sirve ${salud.version}, se esperaba ${versionEsperada}`,
  );
  return salud.version;
}

/** Crea el reporte; si el punto cae junto a otro vigente (duplicado), prueba el siguiente. */
async function crearEnPuntoLibre(
  cliente: ClienteDeHumo,
  token: string,
  opciones: OpcionesDeHumo,
): Promise<string> {
  const intentos = opciones.intentos ?? 3;
  const desvio = opciones.desvio ?? desvioPorDefecto;
  for (let intento = 0; intento < intentos; intento += 1) {
    const { latitud, longitud } = desvio(intento);
    const punto = {
      latitud: PUNTO_DE_HUMO.latitud + latitud,
      longitud: PUNTO_DE_HUMO.longitud + longitud,
    };
    const creado = await cliente.crearReporte(token, punto, `humo-${opciones.marca}-${intento}`);
    if (creado.resultado === 'CREADO') return creado.idReporte;
  }
  throw new FalloDeHumo('crear', `los ${intentos} puntos de prueba tienen un reporte vigente`);
}

/** Espera a que el reporte rechazado salga del mapa: el rechazo se aplica al procesar el evento. */
async function esperarQueDesaparezca(
  cliente: ClienteDeHumo,
  bbox: string,
  idReporte: string,
  opciones: OpcionesDeHumo,
) {
  const plazoMs = opciones.plazoMs ?? 15_000;
  const dormir = opciones.dormir ?? dormirPorDefecto;
  const pausaMs = 500;
  for (let esperado = 0; esperado <= plazoMs; esperado += pausaMs) {
    if (!(await cliente.listar(bbox)).includes(idReporte)) return;
    await dormir(pausaMs);
  }
  throw new FalloDeHumo('rechazar', `el reporte ${idReporte} sigue en el mapa`);
}

/** Ejecuta la prueba y devuelve los pasos superados. Lanza `FalloDeHumo` en el primero que falle. */
export async function ejecutarPruebaDeHumo(
  cliente: ClienteDeHumo,
  opciones: OpcionesDeHumo,
): Promise<string[]> {
  const pasos: string[] = [];
  const version = await comprobarSalud(cliente, opciones.versionEsperada);
  pasos.push(`salud: ok, versión ${version}`);

  const credencial = await cliente.registrar(opciones.hashDispositivo);
  exigir(
    credencial.rol === 'MODERADOR',
    'registro',
    `el usuario de humo ${credencial.idUsuario} no es moderador: ` +
      'asciéndelo con el workflow Administracion y configura HUMO_ID_USUARIO en la API',
  );
  pasos.push(`registro: usuario de humo ${credencial.idUsuario}`);

  const bbox = ventanaDe(PUNTO_DE_HUMO);
  const escucha = await cliente.escuchar(credencial.token, bbox);
  try {
    const idReporte = await crearEnPuntoLibre(cliente, credencial.token, opciones);
    pasos.push(`crear: reporte ${idReporte}`);

    exigir((await cliente.listar(bbox)).includes(idReporte), 'leer', 'GET /v1/reportes no lo trae');
    pasos.push('leer: aparece en GET /v1/reportes');

    const recibido = await escucha.recibio(idReporte, opciones.plazoMs ?? 15_000);
    exigir(recibido, 'tiempo real', 'el ReporteCreado no llegó por WebSocket');
    pasos.push('tiempo real: recibido por WebSocket');

    await cliente.rechazar(credencial.token, idReporte, 'Prueba de humo del despliegue');
    await esperarQueDesaparezca(cliente, bbox, idReporte, opciones);
    pasos.push('rechazar: ya no está en el mapa');
  } finally {
    escucha.cerrar();
  }
  return pasos;
}
