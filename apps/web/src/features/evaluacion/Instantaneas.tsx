import { useQuery } from '@tanstack/react-query';
import { Camera, KeyRound } from 'lucide-react';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { categoriaDe } from '../../domain/categorias.js';
import { CENTRO_LA_PAZ, formatearCoordenadas, leerCoordenadas } from '../../domain/geo.js';
import type { Caja, Punto } from '../../domain/geo.js';
import { useEstado } from '../../estado.js';
import type { ResumenDeInstantanea } from '../../services/evaluacion.js';
import { TRAZO } from '../../ui/iconos.js';
import { Segmentado } from '../../ui/Segmentado.js';
import { gruposDeLaZona, HORAS_DE_BUSQUEDA } from './clave.js';
import { aLocal, horaCorta } from './textos.js';
import { CLAVES, useInstantaneas, useOperacion, usarCliente } from './usarEvaluacion.js';

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

interface PropsEditor {
  readonly instantanea: ResumenDeInstantanea;
  readonly alCerrar: () => void;
}

/**
 * Los evaluadores eligen, entre los incidentes etiquetados en la zona, los que estaban activos en
 * el instante: la respuesta correcta de la tarea (perfil v5, 6.3).
 */
function EditorDeClave({ instantanea, alCerrar }: PropsEditor) {
  const api = usarCliente();
  const hasta = new Date(Date.parse(instantanea.instante) + 1).toISOString();
  const desde = new Date(
    Date.parse(instantanea.instante) - HORAS_DE_BUSQUEDA * 3_600_000,
  ).toISOString();
  const consulta = useQuery({
    queryKey: ['evaluacion', 'etiquetado', 'CONSENSO', { desde, hasta }],
    queryFn: () => api.paraEtiquetar('CONSENSO', { desde, hasta }),
  });
  const [elegidos, setElegidos] = useState<ReadonlySet<string>>(new Set(instantanea.clave));
  const fijar = useOperacion(
    (cliente, grupos: string[]) => cliente.fijarClave(instantanea.id, grupos),
    { exito: `Clave de ${instantanea.nombre} fijada.`, error: 'No pudimos fijar la clave.' },
    [CLAVES.instantaneas],
  );
  const grupos = consulta.data ? gruposDeLaZona(consulta.data, instantanea.caja) : [];
  const alternar = (grupo: string) => {
    const nuevos = new Set(elegidos);
    if (nuevos.has(grupo)) nuevos.delete(grupo);
    else nuevos.add(grupo);
    setElegidos(nuevos);
  };
  return (
    <fieldset className="evaluacion__formulario">
      <legend className="caso__etiqueta">Incidentes activos en {instantanea.nombre}</legend>
      {consulta.isPending && <p className="pagina__ayuda">Cargando el etiquetado…</p>}
      {consulta.data && grupos.length === 0 && (
        <p className="pagina__ayuda">
          No hay envíos etiquetados en esta zona: primero hay que etiquetar.
        </p>
      )}
      {grupos.map((g) => (
        <label key={g.grupo} className="evaluacion__opcion">
          <input
            type="checkbox"
            checked={elegidos.has(g.grupo)}
            onChange={() => alternar(g.grupo)}
          />
          Incidente {g.grupo} · {categoriaDe(g.categoria).corto} · {g.envios}{' '}
          {g.envios === 1 ? 'envío' : 'envíos'}
        </label>
      ))}
      <div className="caso__acciones">
        <button type="button" className="boton-texto" onClick={alCerrar}>
          Cancelar
        </button>
        <button
          type="button"
          className="boton-texto boton-texto--tinta"
          disabled={fijar.isPending}
          onClick={() => fijar.mutate([...elegidos], { onSuccess: alCerrar })}
        >
          Fijar clave ({elegidos.size})
        </button>
      </div>
    </fieldset>
  );
}

function FilaDeInstantanea({ instantanea }: { readonly instantanea: ResumenDeInstantanea }) {
  const [editando, setEditando] = useState(false);
  const { clave } = instantanea;
  return (
    <li className="evaluacion__fila">
      <strong>{instantanea.nombre}</strong>
      <span>{horaCorta(instantanea.instante)}</span>
      <span>
        {instantanea.puntosProcesada} en la vista procesada · {instantanea.puntosBase} en la base
      </span>
      <span>
        {clave.length === 0
          ? 'Sin clave todavía.'
          : `Clave: ${clave.length} incidentes (${clave.join(', ')}).`}
      </span>
      {editando ? (
        <EditorDeClave instantanea={instantanea} alCerrar={() => setEditando(false)} />
      ) : (
        <button
          type="button"
          className="boton-texto boton-texto--chico"
          onClick={() => setEditando(true)}
        >
          <KeyRound aria-hidden="true" size={18} strokeWidth={TRAZO} />
          {clave.length === 0 ? 'Fijar clave' : 'Cambiar clave'}
        </button>
      )}
    </li>
  );
}

/** Las instantáneas congeladas, con su clave y los avisos del perfil sobre E1 y E2. */
export function Instantaneas() {
  const lista = useInstantaneas();
  const instantaneas = lista.data?.instantaneas;
  return (
    <>
      <FormularioDeInstantanea />
      <h2 className="evaluacion__subtitulo">Congeladas</h2>
      {lista.isPending && <p className="pagina__ayuda">Cargando…</p>}
      {lista.isError && <p className="pagina__ayuda">No pudimos cargar las instantáneas.</p>}
      {instantaneas?.length === 0 && (
        <p className="pagina__ayuda">Aún no hay instantáneas. Las tareas necesitan E1 y E2.</p>
      )}
      {lista.data && lista.data.avisos.length > 0 && (
        <ul className="evaluacion__avisos" aria-label="Criterios del perfil para E1 y E2">
          {lista.data.avisos.map((aviso) => (
            <li key={aviso}>{aviso}</li>
          ))}
        </ul>
      )}
      <ul className="evaluacion__lista">
        {instantaneas?.map((i) => (
          <FilaDeInstantanea key={i.id} instantanea={i} />
        ))}
      </ul>
    </>
  );
}
