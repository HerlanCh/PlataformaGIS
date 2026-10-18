import { CloudOff, LocateFixed, RotateCw } from 'lucide-react';
import { categoriaDe } from '../../domain/categorias.js';
import { distanciaM, formatearDistancia } from '../../domain/geo.js';
import type { Punto } from '../../domain/geo.js';
import { vigenciaDe } from '../../domain/reportes.js';
import type { ReportePublico } from '../../domain/reportes.js';
import { useEstado } from '../../estado.js';
import { Estacion } from '../../ui/Estacion.js';
import { TRAZO } from '../../ui/iconos.js';
import { leerPosicion } from '../reporte/usarReportar.js';

/** Estaciones que caben en el diagrama de un teléfono (390 × 844) sin cortar una fila. */
const MAXIMO = 4;

interface Fila {
  readonly reporte: ReportePublico;
  readonly metros: number;
}

/** Los más cercanos al origen, del más cercano al más lejano. */
export function cercanos(reportes: readonly ReportePublico[], desde: Punto): Fila[] {
  return reportes
    .map((reporte) => ({ reporte, metros: distanciaM(desde, reporte.publicLocation) }))
    .sort((a, b) => a.metros - b.metros);
}

/** De dónde se miden las distancias: la posición del GPS o, sin ella, el centro del mapa. */
export type Origen = 'gps' | 'mapa';

interface PropsPanel {
  readonly reportes: readonly ReportePublico[];
  readonly desde: Punto;
  readonly origen: Origen;
  readonly cargando: boolean;
  readonly fallo: boolean;
  readonly reintentar: () => void;
}

async function usarMiUbicacion(): Promise<void> {
  const { fijarPosicion, avisar } = useEstado.getState();
  try {
    fijarPosicion(await leerPosicion());
  } catch {
    avisar('problema', 'No pudimos obtener tu ubicación.');
  }
}

/** Una estación del diagrama: su tramo de color, el estado, la distancia y hasta cuándo se muestra. */
function FilaEstacion({ fila, conGps }: { readonly fila: Fila; readonly conGps: boolean }) {
  const { reporte, metros } = fila;
  const categoria = categoriaDe(reporte.codigoCategoria);
  const confirmado = reporte.estado === 'CONFIRMADO';
  return (
    <li className="diagrama__fila" style={{ '--linea': categoria.color } as React.CSSProperties}>
      <span className="diagrama__tramo" aria-hidden="true">
        <Estacion color={categoria.color} estado={confirmado ? 'CONFIRMADO' : 'ACTIVO'} />
      </span>
      <span className="diagrama__texto">
        <span className="diagrama__nombre">{categoria.corto}</span>
        <span className="diagrama__estado">{confirmado ? 'Confirmado' : 'Sin confirmar'}</span>
      </span>
      <span className="diagrama__datos">
        <span className="diagrama__distancia">
          a {formatearDistancia(metros)}
          {conGps ? '' : ' del centro'}
        </span>
        <span className="diagrama__vence">hasta {vigenciaDe(reporte.caducaEn)}</span>
      </span>
    </li>
  );
}

interface PropsDiagrama {
  readonly filas: readonly Fila[];
  readonly resto: number;
  readonly conGps: boolean;
  readonly cargando: boolean;
  readonly fallo: boolean;
  readonly reintentar: () => void;
}

/** El diagrama de la línea, o el estado que toque: error, carga o zona tranquila. */
function Diagrama({ filas, resto, conGps, cargando, fallo, reintentar }: PropsDiagrama) {
  if (filas.length === 0 && fallo) {
    return (
      <div className="panel__vacio">
        <p>No pudimos cargar los incidentes de esta zona.</p>
        <button type="button" className="boton-texto" onClick={reintentar}>
          <RotateCw aria-hidden="true" size={18} strokeWidth={TRAZO} /> Reintentar
        </button>
      </div>
    );
  }
  if (filas.length === 0 && cargando) {
    return (
      <ol className="diagrama" aria-busy="true" aria-label="Cargando incidentes">
        {[0, 1, 2].map((i) => (
          <li key={i} className="diagrama__fila diagrama__fila--cargando" />
        ))}
      </ol>
    );
  }
  if (filas.length === 0) {
    return (
      <p className="panel__vacio">Todo tranquilo en esta zona. Si ves un incidente, repórtalo.</p>
    );
  }
  return (
    <ol className="diagrama">
      {filas.map((fila) => (
        <FilaEstacion key={fila.reporte.id} fila={fila} conGps={conGps} />
      ))}
      {resto > 0 && (
        <li className="diagrama__mas">
          y {resto} {resto === 1 ? 'incidente más' : 'incidentes más'} en el mapa
        </li>
      )}
    </ol>
  );
}

function Pendientes({ cantidad }: { readonly cantidad: number }) {
  if (cantidad === 0) return null;
  return (
    <p className="pendientes" role="status">
      <CloudOff aria-hidden="true" size={18} strokeWidth={TRAZO} />
      {cantidad === 1 ? '1 reporte pendiente de envío' : `${cantidad} reportes pendientes de envío`}
    </p>
  );
}

/**
 * «Cerca de ti» dibujado como el diagrama de una línea: cada fila es una estación sobre el tramo de
 * su color, con la distancia y la vigencia alineadas a la derecha. Sin GPS no promete cercanía:
 * se titula «En esta zona» y mide desde el centro del mapa. Debajo, el botón de reportar con el
 * mismo peso que la lista.
 */
export function PanelCerca({ reportes, desde, origen, cargando, fallo, reintentar }: PropsPanel) {
  const abrirHoja = useEstado((s) => s.abrirHoja);
  const pendientes = useEstado((s) => s.pendientes);
  const todas = cercanos(reportes, desde);
  const filas = todas.slice(0, MAXIMO);
  const resto = todas.length - filas.length;
  const conGps = origen === 'gps';

  return (
    <section className="panel" aria-labelledby="titulo-cerca">
      <div className="panel__cabecera">
        <h2 id="titulo-cerca" className="panel__titulo">
          {conGps ? 'Cerca de ti' : 'En esta zona'}
        </h2>
        {!conGps && (
          <button
            type="button"
            className="boton-texto boton-texto--chico"
            onClick={() => void usarMiUbicacion()}
          >
            <LocateFixed aria-hidden="true" size={18} strokeWidth={TRAZO} /> Usar mi ubicación
          </button>
        )}
      </div>

      <Diagrama
        filas={filas}
        resto={resto}
        conGps={conGps}
        cargando={cargando}
        fallo={fallo}
        reintentar={reintentar}
      />

      <div className="panel__accion">
        <Pendientes cantidad={pendientes} />
        <button type="button" className="boton-reportar" onClick={abrirHoja}>
          {/* Reportar es agregar una estación a la red. */}
          <Estacion color="var(--linea-amarilla)" estado="ACTIVO" tamano={26} />
          Reportar
        </button>
      </div>
    </section>
  );
}
