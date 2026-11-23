import { Camera } from 'lucide-react';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { CENTRO_LA_PAZ, formatearCoordenadas, leerCoordenadas } from '../../domain/geo.js';
import type { Caja, Punto } from '../../domain/geo.js';
import { useEstado } from '../../estado.js';
import { TRAZO } from '../../ui/iconos.js';
import { Segmentado } from '../../ui/Segmentado.js';
import { aLocal, horaCorta } from './textos.js';
import { CLAVES, useInstantaneas, useOperacion } from './usarEvaluacion.js';

const METROS_POR_GRADO = 111_320;

/** Zona cuadrada de `radioM` metros alrededor del punto. */
export function cajaAlrededor(punto: Punto, radioM: number): Caja {
  const dLat = radioM / METROS_POR_GRADO;
  const dLon = radioM / (METROS_POR_GRADO * Math.cos((punto.latitud * Math.PI) / 180));
  return {
    latitudMin: punto.latitud - dLat,
    latitudMax: punto.latitud + dLat,
    longitudMin: punto.longitud - dLon,
    longitudMax: punto.longitud + dLon,
  };
}

const RADIOS = [
  { valor: 500, nombre: '500 m' },
  { valor: 1000, nombre: '1 km' },
  { valor: 2000, nombre: '2 km' },
] as const;

const centroDe = (caja: Caja | null): Punto =>
  caja
    ? {
        latitud: (caja.latitudMin + caja.latitudMax) / 2,
        longitud: (caja.longitudMin + caja.longitudMax) / 2,
      }
    : CENTRO_LA_PAZ;

/** Congela las dos vistas de una zona en un instante (escenarios E1 y E2 del protocolo). */
function FormularioDeInstantanea() {
  const ventana = useEstado((s) => s.ventana);
  const [nombre, setNombre] = useState('E1');
  const [instante, setInstante] = useState(() => aLocal(new Date()));
  const [coordenadas, setCoordenadas] = useState(() => formatearCoordenadas(centroDe(ventana)));
  const [radio, setRadio] = useState<number>(1000);
  const ids = { nombre: useId(), instante: useId(), centro: useId() };
  const congelar = useOperacion(
    (api, { nombre: n, instante: i, caja }: { nombre: string; instante: string; caja: Caja }) =>
      api.congelar(n, i, caja),
    { exito: 'Instantánea congelada.', error: 'No pudimos congelar la instantánea.' },
    [CLAVES.instantaneas],
  );
  const centro = leerCoordenadas(coordenadas);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (!centro || !nombre.trim()) return;
    congelar.mutate({
      nombre: nombre.trim(),
      instante: new Date(instante).toISOString(),
      caja: cajaAlrededor(centro, radio),
    });
  };

  return (
    <form className="evaluacion__formulario" onSubmit={enviar}>
      <h2 className="evaluacion__subtitulo">Congelar una instantánea</h2>
      <label htmlFor={ids.nombre} className="caso__etiqueta">
        Nombre
      </label>
      <input
        id={ids.nombre}
        className="campo"
        value={nombre}
        maxLength={40}
        onChange={(e) => setNombre(e.target.value)}
      />
      <label htmlFor={ids.instante} className="caso__etiqueta">
        Instante
      </label>
      <input
        id={ids.instante}
        className="campo"
        type="datetime-local"
        value={instante}
        onChange={(e) => setInstante(e.target.value)}
      />
      <label htmlFor={ids.centro} className="caso__etiqueta">
        Centro de la zona (latitud, longitud)
      </label>
      <input
        id={ids.centro}
        className="campo"
        value={coordenadas}
        aria-invalid={!centro}
        onChange={(e) => setCoordenadas(e.target.value)}
      />
      <Segmentado
        etiqueta="Radio de la zona"
        opciones={RADIOS}
        valor={radio}
        alCambiar={setRadio}
      />
      <button
        type="submit"
        className="boton-texto boton-texto--tinta"
        disabled={!centro || !nombre.trim() || congelar.isPending}
      >
        <Camera aria-hidden="true" size={18} strokeWidth={TRAZO} />
        Congelar
      </button>
    </form>
  );
}

/** Las instantáneas congeladas, con cuántos puntos tiene cada vista. */
export function Instantaneas() {
  const lista = useInstantaneas();
  return (
    <>
      <FormularioDeInstantanea />
      <h2 className="evaluacion__subtitulo">Congeladas</h2>
      {lista.isPending && <p className="pagina__ayuda">Cargando…</p>}
      {lista.isError && <p className="pagina__ayuda">No pudimos cargar las instantáneas.</p>}
      {lista.data?.length === 0 && (
        <p className="pagina__ayuda">Aún no hay instantáneas. Las tareas necesitan E1 y E2.</p>
      )}
      <ul className="evaluacion__lista">
        {lista.data?.map((i) => (
          <li key={i.id} className="evaluacion__fila">
            <strong>{i.nombre}</strong>
            <span>{horaCorta(i.instante)}</span>
            <span>
              {i.puntosProcesada} en la vista procesada · {i.puntosBase} en la base
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
