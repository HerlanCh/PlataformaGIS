// Proyección UTM zona 19 Sur (EPSG:32719) sobre WGS84, con las series de Krüger hasta n^3.
// Da una cuadrícula en metros para toda el área de servicio sin depender de la base de datos.
// Precisión submilimétrica dentro de la zona; contrastada con PostGIS en las pruebas.

const A = 6_378_137; // semieje mayor de WGS84
const F = 1 / 298.257223563; // achatamiento
const K0 = 0.9996;
const ESTE_FALSO = 500_000;
const NORTE_FALSO = 10_000_000; // hemisferio sur
const MERIDIANO_CENTRAL = (-69 * Math.PI) / 180;

const N = F / (2 - F);
const N2 = N * N;
const N3 = N2 * N;
const RADIO = (A / (1 + N)) * (1 + N2 / 4 + (N2 * N2) / 64) * K0;
const EXC = (2 * Math.sqrt(N)) / (1 + N);

const ALFA = [N / 2 - (2 * N2) / 3 + (5 * N3) / 16, (13 * N2) / 48 - (3 * N3) / 5, (61 * N3) / 240];
const BETA = [N / 2 - (2 * N2) / 3 + (37 * N3) / 96, N2 / 48 + N3 / 15, (17 * N3) / 480];
const DELTA = [2 * N - (2 * N2) / 3 - 2 * N3, (7 * N2) / 3 - (8 * N3) / 5, (56 * N3) / 15];

export interface UtmPoint {
  readonly easting: number;
  readonly northing: number;
}

export interface LatLon {
  readonly latitude: number;
  readonly longitude: number;
}

const aRadianes = (grados: number): number => (grados * Math.PI) / 180;
const aGrados = (radianes: number): number => (radianes * 180) / Math.PI;

/** Suma de una serie de Krüger: cada término es c[j] * f(2j*xi) * g(2j*eta). */
function serie(
  coeficientes: readonly number[],
  xi: number,
  eta: number,
  f: (x: number) => number,
  g: (x: number) => number,
): number {
  return coeficientes.reduce(
    (suma, c, i) => suma + c * f(2 * (i + 1) * xi) * g(2 * (i + 1) * eta),
    0,
  );
}

export function toUtm19s({ latitude, longitude }: LatLon): UtmPoint {
  const senoLat = Math.sin(aRadianes(latitude));
  const dLon = aRadianes(longitude) - MERIDIANO_CENTRAL;
  const t = Math.sinh(Math.atanh(senoLat) - EXC * Math.atanh(EXC * senoLat));
  const xi = Math.atan2(t, Math.cos(dLon));
  const eta = Math.atanh(Math.sin(dLon) / Math.sqrt(1 + t * t));

  return {
    easting: ESTE_FALSO + RADIO * (eta + serie(ALFA, xi, eta, Math.cos, Math.sinh)),
    northing: NORTE_FALSO + RADIO * (xi + serie(ALFA, xi, eta, Math.sin, Math.cosh)),
  };
}

export function fromUtm19s({ easting, northing }: UtmPoint): LatLon {
  const xi = (northing - NORTE_FALSO) / RADIO;
  const eta = (easting - ESTE_FALSO) / RADIO;
  const xiP = xi - serie(BETA, xi, eta, Math.sin, Math.cosh);
  const etaP = eta - serie(BETA, xi, eta, Math.cos, Math.sinh);
  const chi = Math.asin(Math.sin(xiP) / Math.cosh(etaP));
  const latitud = chi + DELTA.reduce((suma, d, i) => suma + d * Math.sin(2 * (i + 1) * chi), 0);

  return {
    latitude: aGrados(latitud),
    longitude: aGrados(MERIDIANO_CENTRAL + Math.atan2(Math.sinh(etaP), Math.cos(xiP))),
  };
}
