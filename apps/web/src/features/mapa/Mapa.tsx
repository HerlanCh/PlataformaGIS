import L from 'leaflet';
import 'leaflet.markercluster';
import { LocateFixed } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { categoriaDe } from '../../domain/categorias.js';
import { AREA_DE_SERVICIO, CENTRO_LA_PAZ } from '../../domain/geo.js';
import type { Caja } from '../../domain/geo.js';
import { vigenciaDe } from '../../domain/reportes.js';
import type { ReportePublico } from '../../domain/reportes.js';
import { useEstado } from '../../estado.js';
import { estacionSvg } from '../../ui/Estacion.js';
import { TRAZO } from '../../ui/iconos.js';
import { leerPosicion } from '../reporte/usarReportar.js';

const ZOOM_INICIAL = 15;
/** Espera tras el último movimiento antes de pedir la ventana nueva. */
const ESPERA_MS = 300;

const cajaDe = (mapa: L.Map): Caja => {
  const b = mapa.getBounds();
  return {
    latitudMin: b.getSouth(),
    latitudMax: b.getNorth(),
    longitudMin: b.getWest(),
    longitudMax: b.getEast(),
  };
};

const iconoDe = (reporte: ReportePublico) =>
  L.divIcon({
    className: 'marcador',
    html: estacionSvg(
      categoriaDe(reporte.codigoCategoria).color,
      reporte.estado === 'CONFIRMADO' ? 'CONFIRMADO' : 'ACTIVO',
      28,
    ),
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

/** Un grupo se dibuja como una estación de transbordo: un anillo de tinta con el total. */
const iconoDeGrupo = (grupo: L.MarkerCluster) =>
  L.divIcon({
    className: 'transbordo',
    html: `<span>${grupo.getChildCount()}</span>`,
    iconSize: [38, 38],
  });

const etiquetaDe = (reporte: ReportePublico): string => {
  const categoria = categoriaDe(reporte.codigoCategoria);
  const estado = reporte.estado === 'CONFIRMADO' ? 'confirmado' : 'activo';
  return `${categoria.corto}, ${estado}, vigente hasta ${vigenciaDe(reporte.caducaEn)}`;
};

interface PropsMapa {
  readonly reportes: readonly ReportePublico[];
}

/** Mapa de OpenStreetMap con los reportes de la ventana como estaciones de su línea. */
export function Mapa({ reportes }: PropsMapa) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<L.Map | null>(null);
  const grupoRef = useRef<L.MarkerClusterGroup | null>(null);
  const yoRef = useRef<L.CircleMarker | null>(null);
  const posicion = useEstado((s) => s.posicion);

  useEffect(() => {
    if (!contenedor.current) return;
    const mapa = L.map(contenedor.current, {
      center: [CENTRO_LA_PAZ.latitud, CENTRO_LA_PAZ.longitud],
      zoom: ZOOM_INICIAL,
      minZoom: 11,
      zoomControl: false,
      maxBounds: L.latLngBounds(
        [AREA_DE_SERVICIO.latitudMin - 0.1, AREA_DE_SERVICIO.longitudMin - 0.1],
        [AREA_DE_SERVICIO.latitudMax + 0.1, AREA_DE_SERVICIO.longitudMax + 0.1],
      ),
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      className: 'teselas',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapa);
    L.control
      .zoom({ position: 'topright', zoomInTitle: 'Acercar', zoomOutTitle: 'Alejar' })
      .addTo(mapa);
    mapa.attributionControl.setPrefix('Leaflet');
    const grupo = L.markerClusterGroup({
      iconCreateFunction: iconoDeGrupo,
      showCoverageOnHover: false,
      maxClusterRadius: 48,
    }).addTo(mapa);

    let espera: ReturnType<typeof setTimeout> | undefined;
    const avisarVentana = () => {
      clearTimeout(espera);
      espera = setTimeout(() => useEstado.getState().fijarVentana(cajaDe(mapa)), ESPERA_MS);
    };
    mapa.on('moveend', avisarVentana);
    useEstado.getState().fijarVentana(cajaDe(mapa));

    mapaRef.current = mapa;
    grupoRef.current = grupo;
    return () => {
      clearTimeout(espera);
      mapa.remove();
      mapaRef.current = null;
      grupoRef.current = null;
    };
  }, []);

  useEffect(() => {
    const grupo = grupoRef.current;
    if (!grupo) return;
    grupo.clearLayers();
    grupo.addLayers(
      reportes.map((r) =>
        L.marker([r.publicLocation.latitud, r.publicLocation.longitud], {
          icon: iconoDe(r),
          title: etiquetaDe(r),
          alt: etiquetaDe(r),
          keyboard: true,
        }),
      ),
    );
  }, [reportes]);

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !posicion) return;
    const latLng: L.LatLngTuple = [posicion.latitud, posicion.longitud];
    yoRef.current ??= L.circleMarker(latLng, { radius: 8, className: 'yo' }).addTo(mapa);
    yoRef.current.setLatLng(latLng);
  }, [posicion]);

  const centrarEnMi = async () => {
    try {
      const punto = await leerPosicion();
      useEstado.getState().fijarPosicion(punto);
      mapaRef.current?.flyTo([punto.latitud, punto.longitud], 16, { duration: 0.6 });
    } catch {
      useEstado.getState().avisar('problema', 'No pudimos obtener tu ubicación.');
    }
  };

  return (
    <section className="mapa" aria-label="Mapa de incidentes">
      <div
        ref={contenedor}
        className="mapa__lienzo"
        role="application"
        aria-label="Mapa de incidentes"
      />
      <button
        type="button"
        className="boton-redondo mapa__ubicarme"
        onClick={() => void centrarEnMi()}
      >
        <LocateFixed aria-hidden="true" size={22} strokeWidth={TRAZO} />
        <span className="solo-lector">Centrar en mi ubicación</span>
      </button>
    </section>
  );
}
