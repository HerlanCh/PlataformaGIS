import L from 'leaflet';
import 'leaflet.markercluster';
import { LocateFixed } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { categoriaDe } from '../../domain/categorias.js';
import { nombreDeFuente } from '../../domain/fuentes.js';
import { AREA_DE_SERVICIO, CENTRO_LA_PAZ, ZOOM_INICIAL } from '../../domain/geo.js';
import type { Caja } from '../../domain/geo.js';
import { vigenciaDe } from '../../domain/reportes.js';
import type { ReportePublico } from '../../domain/reportes.js';
import { useEstado } from '../../estado.js';
import type { Zona } from '../../services/zonas.js';
import { estacionSvg } from '../../ui/Estacion.js';
import { TRAZO } from '../../ui/iconos.js';
import { BarraDeCalor, HerramientasDelMapa } from '../calor/ControlesDeCalor.js';
import type { CeldaDeCalor } from '../calor/usarMapaDeCalor.js';
import { leerPosicion } from '../reporte/usarReportar.js';
import {
  useCapaDeCalor,
  useCapaDeZonas,
  useDestino,
  useEnfoque,
  useZonaEnEdicion,
} from './capas.js';

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

const iconoDe = (reporte: ReportePublico, marcado = false) =>
  L.divIcon({
    // Un incidente de fuente oficial lleva un marco de tinta (HU-13); uno marcado en la tarea de
    // evaluación, un anillo (ADR-007).
    className: [
      'marcador',
      reporte.fuenteOficial ? 'marcador--oficial' : '',
      marcado ? 'marcador--marcado' : '',
    ]
      .filter(Boolean)
      .join(' '),
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
  const fuente = reporte.fuenteOficial
    ? `, fuente oficial: ${nombreDeFuente(reporte.fuenteOficial)}`
    : '';
  return `${categoria.corto}, ${estado}${fuente}, vigente hasta ${vigenciaDe(reporte.caducaEn)}`;
};

/** Estado de la consulta del mapa de calor, para la barra del historial. */
export interface Calor {
  readonly celdas: readonly CeldaDeCalor[] | null;
  readonly cargando: boolean;
  readonly fallo: boolean;
}

/**
 * Modo de evaluación (ADR-007): el mismo mapa, con la zona de una instantánea fija, sin sus
 * herramientas y con el toque de cada punto en manos de quien lo usa.
 */
export interface ModoDeEvaluacion {
  readonly caja: Caja;
  readonly alTocar: (id: string) => void;
  readonly marcados?: ReadonlySet<string>;
  /** Texto accesible de cada punto; en la vista base no hay vigencia que anunciar. */
  readonly etiquetar?: (reporte: ReportePublico) => string;
}

interface PropsMapa {
  readonly reportes: readonly ReportePublico[];
  readonly calor: Calor;
  readonly zonas: readonly Zona[];
  readonly evaluacion?: ModoDeEvaluacion;
  /** Lo que flota sobre el mapa además de sus controles. */
  readonly children?: ReactNode;
}

interface PropsControles {
  readonly mapaRef: RefObject<L.Map | null>;
  readonly calor: Calor;
  readonly conCalor: boolean;
  readonly editandoZona: boolean;
}

/** Lo que el mapa normal tiene encima y el de evaluación no: herramientas, historial y ubicarse. */
function ControlesDelMapa({ mapaRef, calor, conCalor, editandoZona }: PropsControles) {
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
    <>
      {!editandoZona && <HerramientasDelMapa />}
      {editandoZona && <span className="mira" aria-hidden="true" />}
      {conCalor && (
        <BarraDeCalor
          cantidad={calor.celdas?.length ?? null}
          cargando={calor.cargando}
          fallo={calor.fallo}
        />
      )}
      <button
        type="button"
        className="boton-redondo mapa__ubicarme"
        onClick={() => void centrarEnMi()}
      >
        <LocateFixed aria-hidden="true" size={22} strokeWidth={TRAZO} />
        <span className="solo-lector">Centrar en mi ubicación</span>
      </button>
    </>
  );
}

/** Sin modo de evaluación, el mapa sigue la ventana visible; con él, encuadra su zona y no la sigue. */
function encuadrar(mapa: L.Map, evaluacion: ModoDeEvaluacion | undefined): () => void {
  if (evaluacion) {
    const { latitudMin, longitudMin, latitudMax, longitudMax } = evaluacion.caja;
    mapa.fitBounds([
      [latitudMin, longitudMin],
      [latitudMax, longitudMax],
    ]);
    return () => undefined;
  }
  let espera: ReturnType<typeof setTimeout> | undefined;
  const avisarVentana = () => {
    clearTimeout(espera);
    espera = setTimeout(() => useEstado.getState().fijarVentana(cajaDe(mapa)), ESPERA_MS);
  };
  mapa.on('moveend', avisarVentana);
  useEstado.getState().fijarVentana(cajaDe(mapa));
  return () => clearTimeout(espera);
}

/** Mapa de OpenStreetMap con los reportes de la ventana como estaciones de su línea. */
export function Mapa({ reportes, calor, zonas, evaluacion, children }: PropsMapa) {
  const contenedor = useRef<HTMLDivElement>(null);
  const evaluacionRef = useRef(evaluacion);
  evaluacionRef.current = evaluacion;
  const marcadoresRef = useRef(new Map<string, { marcador: L.Marker; reporte: ReportePublico }>());
  const mapaRef = useRef<L.Map | null>(null);
  const grupoRef = useRef<L.MarkerClusterGroup | null>(null);
  const yoRef = useRef<L.CircleMarker | null>(null);
  const posicion = useEstado((s) => s.posicion);
  const conCalor = useEstado((s) => s.capa === 'calor');
  const editandoZona = useEstado((s) => s.zonaEnEdicion !== null);

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
    // La cabecera no tiene lugar en el teléfono: privacidad y términos van con los créditos del mapa.
    mapa.attributionControl.setPrefix('<a href="/privacidad">Privacidad y términos</a> | Leaflet');
    const grupo = L.markerClusterGroup({
      iconCreateFunction: iconoDeGrupo,
      showCoverageOnHover: false,
      maxClusterRadius: 48,
    }).addTo(mapa);

    const dejarDeSeguir = encuadrar(mapa, evaluacionRef.current);

    mapaRef.current = mapa;
    grupoRef.current = grupo;
    return () => {
      dejarDeSeguir();
      mapa.remove();
      mapaRef.current = null;
      grupoRef.current = null;
    };
  }, []);

  useEffect(() => {
    const grupo = grupoRef.current;
    if (!grupo) return;
    grupo.clearLayers();
    const marcadores = marcadoresRef.current;
    marcadores.clear();
    const etiquetar = evaluacionRef.current?.etiquetar ?? etiquetaDe;
    const tocar = (id: string) => {
      const modo = evaluacionRef.current;
      if (modo) modo.alTocar(id);
      else useEstado.getState().abrirDetalle(id);
    };
    for (const r of reportes) {
      const marcador = L.marker([r.publicLocation.latitud, r.publicLocation.longitud], {
        icon: iconoDe(r, evaluacionRef.current?.marcados?.has(r.id)),
        title: etiquetar(r),
        alt: etiquetar(r),
        keyboard: true,
      }).on('click', () => tocar(r.id));
      marcadores.set(r.id, { marcador, reporte: r });
    }
    grupo.addLayers([...marcadores.values()].map((m) => m.marcador));
  }, [reportes]);

  // Marcar en la tarea cambia solo el icono: el grupo no se rearma ni se cierra el abanico.
  const marcados = evaluacion?.marcados;
  useEffect(() => {
    for (const [id, { marcador, reporte }] of marcadoresRef.current) {
      marcador.setIcon(iconoDe(reporte, marcados?.has(id)));
    }
  }, [marcados]);

  useCapaDeCalor(mapaRef, grupoRef, calor.celdas, conCalor && !evaluacion);
  useCapaDeZonas(mapaRef, zonas);
  useZonaEnEdicion(mapaRef);
  useEnfoque(mapaRef);
  useDestino(mapaRef);

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !posicion) return;
    const latLng: L.LatLngTuple = [posicion.latitud, posicion.longitud];
    yoRef.current ??= L.circleMarker(latLng, { radius: 8, className: 'yo' }).addTo(mapa);
    yoRef.current.setLatLng(latLng);
  }, [posicion]);

  return (
    <section className="mapa" aria-label="Mapa de incidentes">
      <div
        ref={contenedor}
        className="mapa__lienzo"
        role="application"
        aria-label="Mapa de incidentes"
      />
      {!evaluacion && (
        <ControlesDelMapa
          mapaRef={mapaRef}
          calor={calor}
          conCalor={conCalor}
          editandoZona={editandoZona}
        />
      )}
      {children}
    </section>
  );
}
