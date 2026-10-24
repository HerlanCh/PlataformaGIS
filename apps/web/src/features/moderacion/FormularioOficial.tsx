import { Landmark } from 'lucide-react';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { CATEGORIAS } from '../../domain/categorias.js';
import type { CodigoCategoria } from '../../domain/categorias.js';
import { FUENTES_OFICIALES } from '../../domain/fuentes.js';
import type { FuenteOficial } from '../../domain/fuentes.js';
import { CENTRO_LA_PAZ, formatearCoordenadas, leerCoordenadas } from '../../domain/geo.js';
import type { Caja, Punto } from '../../domain/geo.js';
import { useEstado } from '../../estado.js';
import { TRAZO } from '../../ui/iconos.js';
import { usePublicarOficial } from './usarModeracion.js';

const centroDe = (caja: Caja | null): Punto =>
  caja
    ? {
        latitud: (caja.latitudMin + caja.latitudMax) / 2,
        longitud: (caja.longitudMin + caja.longitudMax) / 2,
      }
    : CENTRO_LA_PAZ;

const nuevaClave = () => crypto.randomUUID();

interface PropsCampos {
  /** Se pliega al publicar o al cancelar. */
  readonly alCerrar: () => void;
}

/**
 * Los campos del incidente. El punto empieza en el centro del último mapa que se vio: se puede
 * ubicar el incidente en el mapa y volver, o pegar coordenadas de OpenStreetMap.
 */
function Campos({ alCerrar }: PropsCampos) {
  const ventana = useEstado((s) => s.ventana);
  const [categoria, setCategoria] = useState<CodigoCategoria>('bloqueo');
  const [fuente, setFuente] = useState<FuenteOficial>('TRANSITO');
  const [coordenadas, setCoordenadas] = useState(() => formatearCoordenadas(centroDe(ventana)));
  // Una clave por incidente: reintentar tras un fallo de red no lo publica dos veces.
  const [clave, setClave] = useState(nuevaClave);
  const publicar = usePublicarOficial();
  const ids = { categoria: useId(), fuente: useId(), punto: useId(), ayuda: useId() };
  const punto = leerCoordenadas(coordenadas);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!punto) return;
    publicar.mutate(
      { incidente: { codigoCategoria: categoria, fuenteOficial: fuente, ...punto }, clave },
      {
        onSuccess: () => {
          setClave(nuevaClave());
          alCerrar();
        },
      },
    );
  };

  return (
    <form className="oficial__campos" onSubmit={enviar}>
      <label htmlFor={ids.categoria} className="caso__etiqueta">
        Categoría
      </label>
      <select
        id={ids.categoria}
        className="campo"
        value={categoria}
        onChange={(e) => setCategoria(e.target.value as CodigoCategoria)}
      >
        {CATEGORIAS.map((c) => (
          <option key={c.codigo} value={c.codigo}>
            {c.nombre}
          </option>
        ))}
      </select>
      <label htmlFor={ids.fuente} className="caso__etiqueta">
        Fuente
      </label>
      <select
        id={ids.fuente}
        className="campo"
        value={fuente}
        onChange={(e) => setFuente(e.target.value as FuenteOficial)}
      >
        {FUENTES_OFICIALES.map((f) => (
          <option key={f.codigo} value={f.codigo}>
            {f.nombre}
          </option>
        ))}
      </select>
      <label htmlFor={ids.punto} className="caso__etiqueta">
        Ubicación (latitud, longitud)
      </label>
      <input
        id={ids.punto}
        className="campo"
        inputMode="decimal"
        value={coordenadas}
        aria-describedby={ids.ayuda}
        aria-invalid={!punto}
        onChange={(e) => setCoordenadas(e.target.value)}
      />
      <p id={ids.ayuda} className="oficial__ayuda">
        {punto
          ? 'Es el centro del último mapa que viste. Puedes pegar coordenadas de OpenStreetMap.'
          : 'Escribe dos números, como -16.49550, -68.13360, dentro de La Paz o El Alto.'}
      </p>
      <div className="caso__acciones">
        <button type="button" className="boton-texto" onClick={alCerrar}>
          Cancelar
        </button>
        <button
          type="submit"
          className="boton-texto boton-texto--tinta"
          disabled={!punto || publicar.isPending}
        >
          {publicar.isPending ? 'Publicando…' : 'Publicar'}
        </button>
      </div>
    </form>
  );
}

/**
 * HU-13: el moderador publica lo que anunció Tránsito, la ABC o Mi Teleférico. Va plegado para no
 * tapar la cola, que es el trabajo de todos los días.
 */
export function FormularioOficial() {
  const [abierto, setAbierto] = useState(false);
  return (
    <section className="oficial" aria-label="Incidente de fuente oficial">
      {abierto ? (
        <Campos alCerrar={() => setAbierto(false)} />
      ) : (
        <button type="button" className="boton-texto" onClick={() => setAbierto(true)}>
          <Landmark aria-hidden="true" size={18} strokeWidth={TRAZO} />
          Publicar incidente oficial
        </button>
      )}
    </section>
  );
}
