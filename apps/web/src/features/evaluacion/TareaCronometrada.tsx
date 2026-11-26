import { Play, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { categoriaDe } from '../../domain/categorias.js';
import type { ReportePublico } from '../../domain/reportes.js';
import type { Sesion, Tarea, TareaEnCurso } from '../../services/evaluacion.js';
import { TRAZO } from '../../ui/iconos.js';
import { Segmentado } from '../../ui/Segmentado.js';
import { Mapa } from '../mapa/Mapa.js';
import { minutosYSegundos } from './textos.js';
import { CLAVES, useOperacion, useSesiones } from './usarEvaluacion.js';

const SIN_CALOR = { celdas: null, cargando: false, fallo: false } as const;
type Eleccion = 'azar' | 1 | 2 | 3 | 4;

/** Perfil v5, 6.3: las secuencias se asignan al azar; elegir una a mano queda para repetir un caso. */
const SECUENCIAS: readonly { valor: Eleccion; nombre: string }[] = [
  { valor: 'azar', nombre: 'Al azar' },
  ...[1, 2, 3, 4].map((n) => ({ valor: n as Eleccion, nombre: String(n) })),
];

/** Los puntos de la instantánea como estaciones del mismo mapa, sin vigencia que mostrar. */
const aReportes = (tarea: TareaEnCurso): ReportePublico[] =>
  tarea.puntos.map((p) => ({
    id: p.idPunto,
    codigoCategoria: p.codigoCategoria,
    estado: p.estado ?? 'ACTIVO',
    publicLocation: p.publicLocation,
    creadoEn: tarea.iniciadaEn,
    caducaEn: tarea.iniciadaEn,
    fuenteOficial: p.fuenteOficial,
  }));

const etiquetaDePunto = (r: ReportePublico) => categoriaDe(r.codigoCategoria).corto;

interface PropsEnCurso {
  readonly tarea: TareaEnCurso;
  readonly alTerminar: (marcas: { idPunto: string; msDesdeInicio: number }[]) => void;
  readonly terminando: boolean;
}

/**
 * La tarea en pantalla completa: el mapa de la instantánea, la cuenta atrás y lo marcado. Tocar un
 * punto lo marca; tocarlo otra vez lo desmarca. Al agotarse el tiempo se entrega sola.
 */
export function TareaEnPantalla({ tarea, alTerminar, terminando }: PropsEnCurso) {
  const inicio = useRef(performance.now());
  const [marcas, setMarcas] = useState<ReadonlyMap<string, number>>(new Map());
  const [restante, setRestante] = useState(tarea.duracionMaximaMs);
  const entregada = useRef(false);
  const reportes = useMemo(() => aReportes(tarea), [tarea]);
  const marcados = useMemo(() => new Set(marcas.keys()), [marcas]);

  const entregar = useCallback(
    (actuales: ReadonlyMap<string, number>) => {
      if (entregada.current) return;
      entregada.current = true;
      alTerminar([...actuales].map(([idPunto, msDesdeInicio]) => ({ idPunto, msDesdeInicio })));
    },
    [alTerminar],
  );
  const marcasRef = useRef(marcas);
  marcasRef.current = marcas;

  useEffect(() => {
    const reloj = setInterval(() => {
      const quedan = tarea.duracionMaximaMs - (performance.now() - inicio.current);
      setRestante(quedan);
      if (quedan <= 0) entregar(marcasRef.current);
    }, 250);
    return () => clearInterval(reloj);
  }, [tarea.duracionMaximaMs, entregar]);

  const alTocar = useCallback((id: string) => {
    setMarcas((previas) => {
      const nuevas = new Map(previas);
      if (nuevas.has(id)) nuevas.delete(id);
      else nuevas.set(id, Math.round(performance.now() - inicio.current));
      return nuevas;
    });
  }, []);

  const evaluacion = useMemo(
    () => ({ caja: tarea.caja, alTocar, marcados, etiquetar: etiquetaDePunto }),
    [tarea.caja, alTocar, marcados],
  );

  return (
    <div className="tarea">
      <div className="tarea__barra" role="status">
        <span className="tarea__titulo">Tarea {tarea.orden} de 2</span>
        <span className="tarea__tiempo" aria-label="Tiempo restante">
          {minutosYSegundos(restante)}
        </span>
        <span className="tarea__cuenta">
          {marcas.size === 1 ? '1 marcado' : `${marcas.size} marcados`}
        </span>
        <button
          type="button"
          className="boton-texto boton-texto--tinta"
          disabled={terminando}
          onClick={() => entregar(marcas)}
        >
          Terminar
        </button>
      </div>
      <Mapa reportes={reportes} calor={SIN_CALOR} zonas={[]} evaluacion={evaluacion} />
    </div>
  );
}

function estadoDe(t: Tarea): string {
  if (t.terminadaEn) return t.agotada ? 'terminada (tiempo agotado)' : 'terminada';
  return t.iniciadaEn ? 'en curso' : 'pendiente';
}

interface PropsSesion {
  readonly sesion: Sesion;
  readonly alEmpezar: (idTarea: string) => void;
  readonly empezando: boolean;
}

function FilaDeSesion({ sesion, alEmpezar, empezando }: PropsSesion) {
  const siguiente = sesion.tareas.find((t) => !t.iniciadaEn);
  // La tarea 2 solo empieza cuando la 1 terminó.
  const anteriorTerminada = siguiente?.orden === 1 || Boolean(sesion.tareas[0]?.terminadaEn);
  return (
    <li className="evaluacion__fila">
      <strong>
        {sesion.codigoParticipante} · secuencia {sesion.secuencia}
      </strong>
      {sesion.tareas.map((t) => (
        <span key={t.id}>
          Tarea {t.orden}: {estadoDe(t)}
          {t.terminadaEn && ` · ${t.marcas.length} marcados`}
        </span>
      ))}
      {siguiente && anteriorTerminada && (
        <button
          type="button"
          className="boton-texto boton-texto--chico"
          disabled={empezando}
          onClick={() => alEmpezar(siguiente.id)}
        >
          <Play aria-hidden="true" size={18} strokeWidth={TRAZO} />
          Empezar tarea {siguiente.orden}
        </button>
      )}
    </li>
  );
}

function FormularioDeSesion() {
  const [codigo, setCodigo] = useState('');
  const [secuencia, setSecuencia] = useState<Eleccion>('azar');
  const idCodigo = useId();
  const crear = useOperacion(
    (api, e: { codigo: string; secuencia: Eleccion }) =>
      api.crearSesion(e.codigo, e.secuencia === 'azar' ? null : e.secuencia),
    { exito: 'Sesión abierta.', error: 'No pudimos abrir la sesión.' },
    [CLAVES.sesiones],
  );
  const valido = /^P\d{2,3}$/i.test(codigo.trim());
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (valido)
      crear.mutate(
        { codigo: codigo.trim().toUpperCase(), secuencia },
        { onSuccess: () => setCodigo('') },
      );
  };
  return (
    <form className="evaluacion__formulario" onSubmit={enviar}>
      <h2 className="evaluacion__subtitulo">Nueva sesión</h2>
      <label htmlFor={idCodigo} className="caso__etiqueta">
        Código del participante (P y dos o tres dígitos, nunca un nombre)
      </label>
      <input
        id={idCodigo}
        className="campo"
        value={codigo}
        placeholder="P07"
        maxLength={4}
        onChange={(e) => setCodigo(e.target.value)}
      />
      <Segmentado
        etiqueta="Secuencia"
        opciones={SECUENCIAS}
        valor={secuencia}
        alCambiar={setSecuencia}
      />
      <button
        type="submit"
        className="boton-texto boton-texto--tinta"
        disabled={!valido || crear.isPending}
      >
        <UserPlus aria-hidden="true" size={18} strokeWidth={TRAZO} />
        Abrir sesión
      </button>
    </form>
  );
}

/**
 * La tarea cronometrada en el dispositivo del investigador: abrir la sesión de un participante y
 * aplicar sus dos tareas, en el orden de su secuencia.
 */
export function TareaCronometrada() {
  const sesiones = useSesiones();
  const [enCurso, setEnCurso] = useState<TareaEnCurso | null>(null);
  const empezar = useOperacion((api, idTarea: string) => api.iniciarTarea(idTarea), {
    error: 'No pudimos empezar la tarea.',
  });
  const terminar = useOperacion(
    (api, e: { idTarea: string; marcas: { idPunto: string; msDesdeInicio: number }[] }) =>
      api.terminarTarea(e.idTarea, e.marcas),
    { exito: 'Tarea guardada.', error: 'No pudimos guardar la tarea. Revisa la conexión.' },
    [CLAVES.sesiones],
  );

  if (enCurso) {
    return (
      <TareaEnPantalla
        tarea={enCurso}
        terminando={terminar.isPending}
        alTerminar={(marcas) =>
          terminar.mutate(
            { idTarea: enCurso.idTarea, marcas },
            { onSuccess: () => setEnCurso(null) },
          )
        }
      />
    );
  }
  return (
    <>
      <p className="pagina__ayuda evaluacion__indicacion">
        Indicación al participante: «Toca cada incidente vigente distinto que veas en el mapa. Si un
        mismo incidente aparece varias veces, márcalo una sola vez. Tienes 3 minutos».
      </p>
      <FormularioDeSesion />
      <h2 className="evaluacion__subtitulo">Sesiones</h2>
      {sesiones.isPending && <p className="pagina__ayuda">Cargando…</p>}
      {sesiones.isError && <p className="pagina__ayuda">No pudimos cargar las sesiones.</p>}
      <ul className="evaluacion__lista">
        {sesiones.data?.map((s) => (
          <FilaDeSesion
            key={s.id}
            sesion={s}
            empezando={empezar.isPending}
            alEmpezar={(idTarea) => empezar.mutate(idTarea, { onSuccess: setEnCurso })}
          />
        ))}
      </ul>
    </>
  );
}
