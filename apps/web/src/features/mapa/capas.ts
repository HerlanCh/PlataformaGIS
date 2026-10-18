// Capas del mapa además de las estaciones: el mapa de calor (HU-06), las zonas suscritas y el
// círculo de la zona que se está dibujando (HU-07). Cada una es un hook sobre el mapa de Leaflet.
import L from 'leaflet';
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { useEstado } from '../../estado.js';
import type { Zona } from '../../services/zonas.js';
import { crearCapaDeCalor, puntosDeCalor } from '../calor/capa.js';
import type { CeldaDeCalor } from '../calor/usarMapaDeCalor.js';

type RefMapa = RefObject<L.Map | null>;

const centroDe = (mapa: L.Map) => {
  const c = mapa.getCenter();
  return { latitud: c.lat, longitud: c.lng };
};

/**
 * Con la capa «Historial» activa se esconden las estaciones y se dibuja el calor. `leaflet.heat`
 * se descarga la primera vez que se activa.
 */
export function useCapaDeCalor(
  mapaRef: RefMapa,
  estaciones: RefObject<L.Layer | null>,
  celdas: readonly CeldaDeCalor[] | null,
  activa: boolean,
): void {
  const capaRef = useRef<L.HeatLayer | null>(null);
  // Las celdas pueden llegar antes que `leaflet.heat`: la capa toma las últimas al crearse.
  const celdasRef = useRef(celdas);
  celdasRef.current = celdas;

  useEffect(() => {
    const mapa = mapaRef.current;
    const grupo = estaciones.current;
    if (!mapa || !grupo) return;
    if (!activa) {
      if (!mapa.hasLayer(grupo)) mapa.addLayer(grupo);
      if (capaRef.current) mapa.removeLayer(capaRef.current);
      return;
    }
    mapa.removeLayer(grupo);
    let vigente = true;
    void (async () => {
      capaRef.current ??= await crearCapaDeCalor();
      if (!vigente) return;
      if (!mapa.hasLayer(capaRef.current)) capaRef.current.addTo(mapa);
      capaRef.current.setLatLngs(puntosDeCalor(celdasRef.current ?? []));
    })();
    return () => {
      vigente = false;
    };
  }, [mapaRef, estaciones, activa]);

  useEffect(() => {
    if (activa && celdas) capaRef.current?.setLatLngs(puntosDeCalor(celdas));
  }, [activa, celdas]);
}

/** Las zonas suscritas, como círculos de trazo fino: muestran qué cubre cada una. */
export function useCapaDeZonas(mapaRef: RefMapa, zonas: readonly Zona[]): void {
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;
    const grupo = L.layerGroup(
      zonas.map((zona) =>
        L.circle([zona.centro.latitud, zona.centro.longitud], {
          radius: zona.radioM,
          className: 'zona-suscrita',
          interactive: false,
        }),
      ),
    ).addTo(mapa);
    return () => {
      grupo.remove();
    };
  }, [mapaRef, zonas]);
}

/**
 * Modo de dibujo de una zona: el círculo sigue el centro del mapa mientras se mueve, y el centro
 * se guarda al terminar cada movimiento.
 */
export function useZonaEnEdicion(mapaRef: RefMapa): void {
  const editando = useEstado((s) => s.zonaEnEdicion !== null);
  const radioM = useEstado((s) => s.zonaEnEdicion?.radioM ?? 0);
  const circuloRef = useRef<L.Circle | null>(null);

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !editando) return;
    const { fijarCentroZona } = useEstado.getState();
    const circulo = L.circle(mapa.getCenter(), {
      radius: useEstado.getState().zonaEnEdicion?.radioM ?? 0,
      className: 'zona-nueva',
      interactive: false,
    }).addTo(mapa);
    circuloRef.current = circulo;
    const seguir = () => circulo.setLatLng(mapa.getCenter());
    const fijar = () => fijarCentroZona(centroDe(mapa));
    fijar();
    mapa.on('move', seguir);
    mapa.on('moveend', fijar);
    return () => {
      mapa.off('move', seguir);
      mapa.off('moveend', fijar);
      circulo.remove();
      circuloRef.current = null;
    };
  }, [mapaRef, editando]);

  useEffect(() => {
    circuloRef.current?.setRadius(radioM);
  }, [radioM]);
}

/** Alto aproximado de lo que flota abajo (la tarjeta «¿Sigue ahí?») más un margen. */
const RESERVA_INFERIOR_PX = 240;

/** Desplaza el mapa lo justo para que el punto enfocado quede visible sobre la tarjeta. */
export function useEnfoque(mapaRef: RefMapa): void {
  const enfoque = useEstado((s) => s.enfoque);
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !enfoque) return;
    mapa.panInside([enfoque.latitud, enfoque.longitud], {
      paddingTopLeft: [0, 80],
      paddingBottomRight: [0, RESERVA_INFERIOR_PX],
    });
  }, [mapaRef, enfoque]);
}

/** Lleva el mapa al reporte de un aviso push, cerca, para que entre en la ventana. */
export function useDestino(mapaRef: RefMapa): void {
  const destino = useEstado((s) => s.destino);
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !destino) return;
    mapa.setView([destino.punto.latitud, destino.punto.longitud], 16);
  }, [mapaRef, destino]);
}
