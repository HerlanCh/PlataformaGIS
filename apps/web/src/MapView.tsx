import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';

/** Centro de La Paz (Plaza Murillo). */
export const CENTRO_LA_PAZ: [number, number] = [-16.4955, -68.1336];
const ZOOM_INICIAL = 13;

export function MapView() {
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contenedor.current) return;

    const mapa = L.map(contenedor.current).setView(CENTRO_LA_PAZ, ZOOM_INICIAL);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapa);

    return () => {
      mapa.remove();
    };
  }, []);

  return (
    <div ref={contenedor} className="mapa" role="application" aria-label="Mapa de incidentes" />
  );
}
