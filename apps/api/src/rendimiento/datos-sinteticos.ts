/** Datos sintéticos reproducibles para medir las consultas espaciales (Fase 4). */

/** Generador pseudoaleatorio con semilla (mulberry32): la misma semilla da la misma carga. */
export function generadorAleatorio(semilla: number): () => number {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Área de servicio con un margen interior: la celda pública de un punto sensible no se sale. */
export const AREA_DE_CARGA = {
  latitudMin: -16.66,
  latitudMax: -16.39,
  longitudMin: -68.32,
  longitudMax: -68.01,
} as const;

/** Zonas de mayor actividad: los reportes reales se concentran, no se reparten por igual. */
export const FOCOS: readonly (readonly [latitud: number, longitud: number])[] = [
  [-16.4955, -68.1336], // Plaza Murillo
  [-16.5, -68.15], // San Pedro
  [-16.5103, -68.1242], // Miraflores
  [-16.54, -68.08], // Calacoto
  [-16.5047, -68.1632], // La Ceja de El Alto
  [-16.52, -68.21], // Villa Adela
  [-16.48, -68.19], // Río Seco
  [-16.4721, -68.1493], // Achachicala
];

/** TTL y peso de cada categoría del MVP en la carga (los bloqueos y accidentes dominan). */
export const CATEGORIAS_DE_CARGA: readonly {
  codigo: string;
  ttlMinutos: number;
  peso: number;
}[] = [
  { codigo: 'bloqueo', ttlMinutos: 360, peso: 0.3 },
  { codigo: 'accidente', ttlMinutos: 180, peso: 0.3 },
  { codigo: 'robo', ttlMinutos: 120, peso: 0.2 },
  { codigo: 'infraestructura', ttlMinutos: 1440, peso: 0.12 },
  { codigo: 'jauria', ttlMinutos: 120, peso: 0.08 },
];

/** Reparto de estados: la mayoría de los reportes de una base con historia ya terminó su ciclo. */
const ESTADOS_DE_CARGA: readonly { estado: EstadoSintetico; peso: number }[] = [
  { estado: 'ACTIVO', peso: 0.14 },
  { estado: 'CONFIRMADO', peso: 0.05 },
  { estado: 'VENCIDO', peso: 0.01 },
  { estado: 'CADUCADO', peso: 0.55 },
  { estado: 'RESUELTO', peso: 0.2 },
  { estado: 'RECHAZADO', peso: 0.05 },
];

/** `VENCIDO`: sigue `ACTIVO` en la base pero su caducidad ya pasó (lo que busca `buscarCaducados`). */
type EstadoSintetico = 'ACTIVO' | 'CONFIRMADO' | 'VENCIDO' | 'CADUCADO' | 'RESUELTO' | 'RECHAZADO';

export interface ReporteSintetico {
  readonly codigoCategoria: string;
  readonly estado: 'ACTIVO' | 'CONFIRMADO' | 'CADUCADO' | 'RESUELTO' | 'RECHAZADO';
  readonly ttlMinutos: number;
  readonly extensiones: number;
  readonly motivoRechazo: 'MODERACION' | null;
  readonly latitud: number;
  readonly longitud: number;
  readonly creadoEn: Date;
  readonly caducaEn: Date;
}

export interface ZonaSintetica {
  readonly latitud: number;
  readonly longitud: number;
  readonly radioM: number;
  readonly categorias: readonly string[];
}

const MS_POR_MINUTO = 60_000;
const DIAS_DE_HISTORIA = 180;
const DISPERSION_DEL_FOCO = 0.012;

const acotar = (valor: number, minimo: number, maximo: number): number =>
  Math.min(maximo, Math.max(minimo, valor));

function elegir<T extends { peso: number }>(opciones: readonly T[], azar: () => number): T {
  let restante = azar();
  for (const opcion of opciones) {
    restante -= opcion.peso;
    if (restante < 0) return opcion;
  }
  return opciones.at(-1)!;
}

/** El 70 % de los puntos se agrupa alrededor de un foco; el resto se reparte por toda el área. */
export function puntoSintetico(azar: () => number): { latitud: number; longitud: number } {
  const { latitudMin, latitudMax, longitudMin, longitudMax } = AREA_DE_CARGA;
  if (azar() >= 0.7) {
    return {
      latitud: latitudMin + azar() * (latitudMax - latitudMin),
      longitud: longitudMin + azar() * (longitudMax - longitudMin),
    };
  }
  const [latitud, longitud] = FOCOS[Math.floor(azar() * FOCOS.length)]!;
  // La suma de dos uniformes da más densidad cerca del centro del foco.
  const desvio = () => (azar() + azar() - 1) * DISPERSION_DEL_FOCO;
  return {
    latitud: acotar(latitud + desvio(), latitudMin, latitudMax),
    longitud: acotar(longitud + desvio(), longitudMin, longitudMax),
  };
}

function fechas(
  estado: EstadoSintetico,
  ttlMinutos: number,
  ahora: Date,
  azar: () => number,
): { creadoEn: Date; caducaEn: Date } {
  const ttlMs = ttlMinutos * MS_POR_MINUTO;
  let antiguedadMs: number;
  if (estado === 'ACTIVO' || estado === 'CONFIRMADO') {
    // Vigente: creado hace menos de un TTL, así su caducidad todavía no llegó.
    antiguedadMs = azar() * ttlMs * 0.95;
  } else if (estado === 'VENCIDO') {
    antiguedadMs = ttlMs + (1 + azar() * 60) * MS_POR_MINUTO;
  } else {
    antiguedadMs = ttlMs + azar() * DIAS_DE_HISTORIA * 24 * 60 * MS_POR_MINUTO;
  }
  const creadoEn = new Date(ahora.getTime() - antiguedadMs);
  return { creadoEn, caducaEn: new Date(creadoEn.getTime() + ttlMs) };
}

export function reporteSintetico(ahora: Date, azar: () => number): ReporteSintetico {
  const categoria = elegir(CATEGORIAS_DE_CARGA, azar);
  const { estado } = elegir(ESTADOS_DE_CARGA, azar);
  const { creadoEn, caducaEn } = fechas(estado, categoria.ttlMinutos, ahora, azar);
  // Como en el dominio: al confirmarse, el reporte gana una extensión del 50 % de su TTL.
  const confirmado = estado === 'CONFIRMADO';
  const extensionMs = confirmado ? (categoria.ttlMinutos * MS_POR_MINUTO) / 2 : 0;
  return {
    codigoCategoria: categoria.codigo,
    estado: estado === 'VENCIDO' ? 'ACTIVO' : estado,
    ttlMinutos: categoria.ttlMinutos,
    extensiones: confirmado ? 1 : 0,
    motivoRechazo: estado === 'RECHAZADO' ? 'MODERACION' : null,
    ...puntoSintetico(azar),
    creadoEn,
    caducaEn: new Date(caducaEn.getTime() + extensionMs),
  };
}

export function zonaSintetica(azar: () => number): ZonaSintetica {
  const primera = Math.floor(azar() * CATEGORIAS_DE_CARGA.length);
  const cuantas = 1 + Math.floor(azar() * 3);
  const categorias = Array.from(
    { length: cuantas },
    (_, i) => CATEGORIAS_DE_CARGA[(primera + i) % CATEGORIAS_DE_CARGA.length]!.codigo,
  );
  return {
    ...puntoSintetico(azar),
    radioM: 100 + Math.floor(azar() * 1901),
    categorias,
  };
}

/** UUID determinista: un prefijo que identifica la carga sintética y un número de serie. */
export const idSintetico = (prefijo: 'e' | 'f', n: number): string =>
  `${prefijo.repeat(8)}-${prefijo.repeat(4)}-4${prefijo.repeat(3)}-8${prefijo.repeat(3)}-${String(n).padStart(12, '0')}`;
