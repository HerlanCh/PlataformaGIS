import { useQuery } from '@tanstack/react-query';
import { Save, Scale } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { categoriaDe } from '../../domain/categorias.js';
import { formatearCoordenadas } from '../../domain/geo.js';
import type {
  Acuerdo,
  EnviosParaEtiquetar,
  Evaluador,
  Periodo,
} from '../../services/evaluacion.js';
import { Estacion } from '../../ui/Estacion.js';
import { TRAZO } from '../../ui/iconos.js';
import { Segmentado } from '../../ui/Segmentado.js';
import { hoyEnBolivia, horaCorta, periodoDeDias } from './textos.js';
import { useOperacion, usarCliente } from './usarEvaluacion.js';

const EVALUADORES = [
  { valor: 'A', nombre: 'Evaluador A' },
  { valor: 'B', nombre: 'Evaluador B' },
  { valor: 'CONSENSO', nombre: 'Consenso' },
] as const satisfies readonly { valor: Evaluador; nombre: string }[];

/** Días de Bolivia del periodo, con hoy por defecto. */
export function CamposDePeriodo({ alCambiar }: { readonly alCambiar: (periodo: Periodo) => void }) {
  const [desde, setDesde] = useState(hoyEnBolivia);
  const [hasta, setHasta] = useState(hoyEnBolivia);
  const ids = { desde: useId(), hasta: useId() };
  useEffect(() => {
    if (desde && hasta && desde <= hasta) alCambiar(periodoDeDias(desde, hasta));
  }, [desde, hasta, alCambiar]);
  return (
    <div className="evaluacion__periodo">
      <label htmlFor={ids.desde} className="caso__etiqueta">
        Desde
      </label>
      <input
        id={ids.desde}
        className="campo"
        type="date"
        value={desde}
        onChange={(e) => setDesde(e.target.value)}
      />
      <label htmlFor={ids.hasta} className="caso__etiqueta">
        Hasta
      </label>
      <input
        id={ids.hasta}
        className="campo"
        type="date"
        value={hasta}
        onChange={(e) => setHasta(e.target.value)}
      />
    </div>
  );
}

function EstadoDeCarga({
  cargando,
  fallo,
  vacio,
}: {
  readonly cargando: boolean;
  readonly fallo: boolean;
  readonly vacio: boolean;
}) {
  if (cargando) return <p className="pagina__ayuda">Cargando…</p>;
  if (fallo) return <p className="pagina__ayuda">No pudimos cargar los envíos.</p>;
  return vacio ? <p className="pagina__ayuda">No hay envíos en esos días.</p> : null;
}

/** Lo que el evaluador escribió y aún no guardó, frente a lo guardado. */
function cambiosDe(
  datos: EnviosParaEtiquetar,
  evaluador: Evaluador,
  borrador: ReadonlyMap<string, string>,
): { idEnvio: string; grupo: string | null }[] {
  const guardadas = new Map(
    datos.etiquetas.filter((e) => e.evaluador === evaluador).map((e) => [e.idEnvio, e.grupo]),
  );
  return [...borrador]
    .map(([idEnvio, grupo]) => ({ idEnvio, grupo: grupo.trim() || null }))
    .filter(({ idEnvio, grupo }) => (guardadas.get(idEnvio) ?? null) !== grupo);
}

function PanelDeAcuerdo({ periodo }: { readonly periodo: Periodo }) {
  const medir = useOperacion((api, p: Periodo) => api.acuerdo(p), {
    error: 'No pudimos medir el acuerdo.',
  });
  const acuerdo: Acuerdo | undefined = medir.data;
  return (
    <section className="evaluacion__formulario" aria-label="Acuerdo entre evaluadores">
      <button
        type="button"
        className="boton-texto"
        disabled={medir.isPending}
        onClick={() => medir.mutate(periodo)}
      >
        <Scale aria-hidden="true" size={18} strokeWidth={TRAZO} />
        Medir acuerdo entre A y B
      </button>
      {acuerdo && (
        <p className="pagina__ayuda" role="status">
          {acuerdo.kappa === null
            ? 'Aún no hay pares etiquetados por ambos evaluadores.'
            : `Kappa ${acuerdo.kappa.toFixed(2)} (mínimo ${acuerdo.kappaMinimo}) sobre ${acuerdo.paresEvaluados} de ${acuerdo.paresCandidatos} pares. ` +
              `${acuerdo.desacuerdos.length} desacuerdos para resolver por consenso.`}
        </p>
      )}
    </section>
  );
}

interface PropsFila {
  readonly envio: EnviosParaEtiquetar['envios'][number];
  readonly valor: string;
  /** En el consenso, lo que pusieron A y B. */
  readonly pista: string | null;
  readonly idGrupos: string;
  readonly alCambiar: (grupo: string) => void;
}

function FilaDeEnvio({ envio, valor, pista, idGrupos, alCambiar }: PropsFila) {
  const categoria = categoriaDe(envio.codigoCategoria);
  const hora = horaCorta(envio.recibidoEn);
  return (
    <li className="evaluacion__fila evaluacion__fila--envio">
      <Estacion color={categoria.color} estado="ACTIVO" tamano={22} />
      <span>
        <strong>{categoria.corto}</strong> · {hora} · {formatearCoordenadas(envio.publicLocation)}
        {pista && <span className="pagina__ayuda"> ({pista})</span>}
      </span>
      <input
        className="campo evaluacion__grupo"
        aria-label={`Grupo del envío de las ${hora}`}
        list={idGrupos}
        maxLength={40}
        value={valor}
        onChange={(ev) => alCambiar(ev.target.value)}
      />
    </li>
  );
}

/**
 * Etiquetado ciego (ADR-007): cada evaluador agrupa los envíos del periodo en incidentes, sin ver
 * el reporte que les asignó la plataforma ni las etiquetas del otro. El consenso ve las de ambos.
 */
export function Etiquetado() {
  const [evaluador, setEvaluador] = useState<Evaluador>('A');
  const [periodo, setPeriodo] = useState<Periodo | null>(null);
  const [borrador, setBorrador] = useState<ReadonlyMap<string, string>>(new Map());
  const api = usarCliente();
  const consulta = useQuery({
    queryKey: ['evaluacion', 'etiquetado', evaluador, periodo],
    queryFn: () => api.paraEtiquetar(evaluador, periodo!),
    enabled: periodo !== null,
  });
  const guardar = useOperacion(
    (cliente, asignaciones: { idEnvio: string; grupo: string | null }[]) =>
      cliente.etiquetar(evaluador, asignaciones),
    { exito: 'Etiquetas guardadas.', error: 'No pudimos guardar las etiquetas.' },
    [['evaluacion', 'etiquetado']],
  );
  const idGrupos = useId();
  useEffect(() => setBorrador(new Map()), [evaluador, periodo]);

  const datos = consulta.data;
  const propias = useMemo(
    () =>
      new Map(
        datos?.etiquetas.filter((e) => e.evaluador === evaluador).map((e) => [e.idEnvio, e.grupo]),
      ),
    [datos, evaluador],
  );
  const grupos = useMemo(
    () => [...new Set([...propias.values(), ...borrador.values()])].filter(Boolean),
    [propias, borrador],
  );
  const cambios = datos ? cambiosDe(datos, evaluador, borrador) : [];
  const pista = (idEnvio: string): string | null => {
    if (evaluador !== 'CONSENSO') return null;
    const otras = (datos?.etiquetas ?? []).filter(
      (e) => e.idEnvio === idEnvio && e.evaluador !== 'CONSENSO',
    );
    return otras.map((e) => `${e.evaluador}: ${e.grupo}`).join(' · ') || null;
  };

  return (
    <>
      <Segmentado
        etiqueta="Quién etiqueta"
        opciones={EVALUADORES}
        valor={evaluador}
        alCambiar={setEvaluador}
      />
      <CamposDePeriodo alCambiar={setPeriodo} />
      <p className="pagina__ayuda">
        Escribe el mismo grupo (por ejemplo, 1, 2, 3) en los envíos que son el mismo incidente real.
      </p>
      <EstadoDeCarga
        cargando={consulta.isPending && periodo !== null}
        fallo={consulta.isError}
        vacio={datos?.envios.length === 0}
      />
      <datalist id={idGrupos}>
        {grupos.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
      <ul className="evaluacion__lista">
        {datos?.envios.map((e) => (
          <FilaDeEnvio
            key={e.idEnvio}
            envio={e}
            valor={borrador.get(e.idEnvio) ?? propias.get(e.idEnvio) ?? ''}
            pista={pista(e.idEnvio)}
            idGrupos={idGrupos}
            alCambiar={(grupo) => setBorrador(new Map(borrador).set(e.idEnvio, grupo))}
          />
        ))}
      </ul>
      {datos && datos.envios.length > 0 && (
        <button
          type="button"
          className="boton-texto boton-texto--tinta"
          disabled={cambios.length === 0 || guardar.isPending}
          onClick={() => guardar.mutate(cambios, { onSuccess: () => setBorrador(new Map()) })}
        >
          <Save aria-hidden="true" size={18} strokeWidth={TRAZO} />
          Guardar {cambios.length > 0 ? `(${cambios.length})` : ''}
        </button>
      )}
      {periodo && <PanelDeAcuerdo periodo={periodo} />}
    </>
  );
}
