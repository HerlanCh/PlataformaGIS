/** Estado visible de una estación: anillo abierto = activo, relleno = confirmado. */
export type EstadoDeEstacion = 'ACTIVO' | 'CONFIRMADO';

/**
 * Estación de la red, el signo de un reporte sobre su línea de color, como SVG en texto: la usan
 * tanto React como los marcadores de Leaflet. El contorno de tinta exterior le da contraste sobre
 * cualquier fondo (WCAG 1.4.11), también a la línea amarilla.
 */
export function estacionSvg(color: string, estado: EstadoDeEstacion, tamano = 26): string {
  const r = tamano / 2;
  const centro = estado === 'CONFIRMADO' ? color : 'var(--fondo)';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tamano}" height="${tamano}" viewBox="0 0 ${tamano} ${tamano}" aria-hidden="true"><circle cx="${r}" cy="${r}" r="${r - 1.25}" fill="var(--tinta)"/><circle cx="${r}" cy="${r}" r="${r - 3.5}" fill="${color}"/><circle cx="${r}" cy="${r}" r="${r - 8}" fill="${centro}"/></svg>`;
}

interface PropsEstacion {
  readonly color: string;
  readonly estado: EstadoDeEstacion;
  readonly tamano?: number;
}

export function Estacion({ color, estado, tamano = 26 }: PropsEstacion) {
  return (
    <span
      className="estacion"
      // Marcado propio y sin datos del usuario: no hay riesgo de inyección.
      dangerouslySetInnerHTML={{ __html: estacionSvg(color, estado, tamano) }}
    />
  );
}
