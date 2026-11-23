import { useQuery } from '@tanstack/react-query';
import { Check, Shuffle } from 'lucide-react';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { categoriaDe } from '../../domain/categorias.js';
import { formatearCoordenadas } from '../../domain/geo.js';
import type {
  NuevaVerificacion,
  Periodo,
  Sorteo,
  Verificacion as VerificacionGuardada,
} from '../../services/evaluacion.js';
import { Estacion } from '../../ui/Estacion.js';
import { TRAZO } from '../../ui/iconos.js';
import { Segmentado } from '../../ui/Segmentado.js';
import { CamposDePeriodo } from './Etiquetado.js';
import { horaCorta } from './textos.js';
import { CLAVES, useOperacion, usarCliente } from './usarEvaluacion.js';

type Verificable = Sorteo['confirmados'][number];
type Resultado = NuevaVerificacion['resultado'];
type Fuente = NuevaVerificacion['fuente'];

const RESULTADOS = [
  { valor: 'REAL', nombre: 'Real' },
  { valor: 'FALSO', nombre: 'Falso' },
  { valor: 'NO_VERIFICABLE', nombre: 'No se pudo' },
] as const satisfies readonly { valor: Resultado; nombre: string }[];

const FUENTES = [
  { valor: 'CAMPO', nombre: 'En campo' },
  { valor: 'SECUNDARIA', nombre: 'Fuente secundaria' },
] as const satisfies readonly { valor: Fuente; nombre: string }[];

const NOMBRE_DE_RESULTADO: Readonly<Record<Resultado, string>> = {
  REAL: 'real',
  FALSO: 'falso',
  NO_VERIFICABLE: 'no verificable',
};

function EstadoGuardado({ guardada }: { readonly guardada: VerificacionGuardada }) {
  const fin = guardada.finEn ? `, terminó ${horaCorta(guardada.finEn)}` : '';
  return (
    <span className="pagina__ayuda">
      Registrado como {NOMBRE_DE_RESULTADO[guardada.resultado]}
      {fin}.
    </span>
  );
}

/** Solo lo real tiene hora de fin, y solo si se escribió. */
const finDe = (resultado: Resultado, fin: string): string | null =>
  resultado === 'REAL' && fin ? new Date(fin).toISOString() : null;

interface PropsFicha {
  readonly reporte: Verificable;
  readonly guardada: VerificacionGuardada | undefined;
}

/** Una alerta sorteada: dónde y cuándo, y lo que se comprobó de ella. */
function FichaDeVerificacion({ reporte, guardada }: PropsFicha) {
  const [resultado, setResultado] = useState<Resultado>(guardada?.resultado ?? 'REAL');
  const [fuente, setFuente] = useState<Fuente>(guardada?.fuente ?? 'CAMPO');
  const [fin, setFin] = useState('');
  const [detalle, setDetalle] = useState(guardada?.detalleFuente ?? '');
  const ids = { fin: useId(), detalle: useId() };
  const verificar = useOperacion(
    (api, v: NuevaVerificacion) => api.verificar(reporte.idReporte, v),
    { exito: 'Verificación guardada.', error: 'No pudimos guardar la verificación.' },
    [CLAVES.verificaciones],
  );
  const categoria = categoriaDe(reporte.codigoCategoria);
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    verificar.mutate({
      resultado,
      fuente,
      finEn: finDe(resultado, fin),
      detalleFuente: detalle.trim() || null,
    });
  };
  return (
    <li className="evaluacion__fila">
      <span>
        <Estacion
          color={categoria.color}
          estado={reporte.confirmado ? 'CONFIRMADO' : 'ACTIVO'}
          tamano={22}
        />{' '}
        <strong>{categoria.corto}</strong> · {horaCorta(reporte.creadoEn)} ·{' '}
        {formatearCoordenadas(reporte.publicLocation)}
      </span>
      {guardada && <EstadoGuardado guardada={guardada} />}
      <form className="evaluacion__formulario" onSubmit={enviar}>
        <Segmentado
          etiqueta="¿Qué fue?"
          opciones={RESULTADOS}
          valor={resultado}
          alCambiar={setResultado}
        />
        {resultado === 'REAL' && (
          <>
            <label htmlFor={ids.fin} className="caso__etiqueta">
              Cuándo dejó de ser cierto (si se sabe)
            </label>
            <input
              id={ids.fin}
              className="campo"
              type="datetime-local"
              value={fin}
              onChange={(e) => setFin(e.target.value)}
            />
          </>
        )}
        <Segmentado
          etiqueta="Cómo se comprobó"
          opciones={FUENTES}
          valor={fuente}
          alCambiar={setFuente}
        />
        <label htmlFor={ids.detalle} className="caso__etiqueta">
          Fuente (breve; nunca nombres ni datos de personas)
        </label>
        <input
          id={ids.detalle}
          className="campo"
          maxLength={200}
          value={detalle}
          onChange={(e) => setDetalle(e.target.value)}
        />
        <button
          type="submit"
          className="boton-texto boton-texto--chico"
          disabled={verificar.isPending}
        >
          <Check aria-hidden="true" size={18} strokeWidth={TRAZO} />
          Guardar
        </button>
      </form>
    </li>
  );
}

function Grupo({
  titulo,
  reportes,
  guardadas,
}: {
  readonly titulo: string;
  readonly reportes: readonly Verificable[];
  readonly guardadas: ReadonlyMap<string, VerificacionGuardada>;
}) {
  return (
    <>
      <h2 className="evaluacion__subtitulo">
        {titulo} ({reportes.length})
      </h2>
      <ul className="evaluacion__lista">
        {reportes.map((r) => (
          <FichaDeVerificacion
            key={r.idReporte}
            reporte={r}
            guardada={guardadas.get(r.idReporte)}
          />
        ))}
      </ul>
    </>
  );
}

/**
 * Verificación (ADR-007): cada semana se sortean por categoría 5 alertas confirmadas y 5 reportes
 * no confirmados, y se registra si fueron reales, cuándo terminaron y cómo se comprobó.
 */
export function Verificacion() {
  const [periodo, setPeriodo] = useState<Periodo | null>(null);
  const api = usarCliente();
  const guardadas = useQuery({
    queryKey: CLAVES.verificaciones,
    queryFn: () => api.verificaciones(),
  });
  const sortear = useOperacion((cliente, p: Periodo) => cliente.sorteo(p), {
    error: 'No pudimos hacer el sorteo.',
  });
  const porReporte = new Map((guardadas.data ?? []).map((v) => [v.idReporte, v]));
  return (
    <>
      <CamposDePeriodo alCambiar={setPeriodo} />
      <button
        type="button"
        className="boton-texto"
        disabled={!periodo || sortear.isPending}
        onClick={() => periodo && sortear.mutate(periodo)}
      >
        <Shuffle aria-hidden="true" size={18} strokeWidth={TRAZO} />
        Sortear alertas de esos días
      </button>
      {sortear.data && (
        <>
          <Grupo
            titulo="Alertas confirmadas"
            reportes={sortear.data.confirmados}
            guardadas={porReporte}
          />
          <Grupo
            titulo="Reportes no confirmados"
            reportes={sortear.data.noConfirmados}
            guardadas={porReporte}
          />
        </>
      )}
      <p className="pagina__ayuda">
        {guardadas.data?.length ?? 0} reportes verificados en total. La meta del protocolo es 40.
      </p>
    </>
  );
}
