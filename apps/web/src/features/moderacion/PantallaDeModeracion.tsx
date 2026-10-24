import { Copy, Flag, MapPin, ThumbsDown } from 'lucide-react';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { categoriaDe } from '../../domain/categorias.js';
import { enlaceAlReporte, horaDe } from '../../domain/reportes.js';
import type { CasoDeModeracion, Decision } from '../../services/moderacion.js';
import { Estacion } from '../../ui/Estacion.js';
import { TRAZO } from '../../ui/iconos.js';
import { Pagina } from '../../ui/Pagina.js';
import { FormularioOficial } from './FormularioOficial.js';
import { MOTIVOS_DE_RECHAZO, textoDeMotivo } from './textos.js';
import { useAcceso, useCola, useDecidir } from './usarModeracion.js';

interface PropsRechazo {
  readonly enCurso: boolean;
  readonly alConfirmar: (motivo: string) => void;
  readonly alCancelar: () => void;
}

/** Rechazar pide un motivo, que queda en la auditoría (HU-12). */
function FormularioDeRechazo({ enCurso, alConfirmar, alCancelar }: PropsRechazo) {
  const [motivo, setMotivo] = useState('');
  const idCampo = useId();
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (motivo.trim()) alConfirmar(motivo);
  };
  return (
    <form className="caso__rechazo" onSubmit={enviar}>
      <label htmlFor={idCampo} className="caso__etiqueta">
        Motivo del rechazo
      </label>
      <div className="caso__sugerencias">
        {MOTIVOS_DE_RECHAZO.map((sugerido) => (
          <button
            key={sugerido}
            type="button"
            className="boton-texto boton-texto--chico"
            aria-pressed={motivo === sugerido}
            onClick={() => setMotivo(sugerido)}
          >
            {sugerido}
          </button>
        ))}
      </div>
      <input
        id={idCampo}
        className="campo"
        value={motivo}
        maxLength={500}
        onChange={(e) => setMotivo(e.target.value)}
      />
      <div className="caso__acciones">
        <button type="button" className="boton-texto" onClick={alCancelar}>
          Cancelar
        </button>
        <button
          type="submit"
          className="boton-texto boton-texto--tinta"
          disabled={!motivo.trim() || enCurso}
        >
          Sí, rechazar
        </button>
      </div>
    </form>
  );
}

interface PropsCaso {
  readonly caso: CasoDeModeracion;
  readonly enCurso: boolean;
  readonly alDecidir: (decision: Decision) => void;
}

/** Un reporte de la cola: por qué está aquí, su detalle privado y las dos decisiones. */
function TarjetaDeCaso({ caso, enCurso, alDecidir }: PropsCaso) {
  const [rechazando, setRechazando] = useState(false);
  const categoria = categoriaDe(caso.codigoCategoria);
  const confirmado = caso.estado === 'CONFIRMADO';
  const idTitulo = useId();
  return (
    <article className="caso" aria-labelledby={idTitulo}>
      <header className="caso__cabecera">
        <Estacion
          color={categoria.color}
          estado={confirmado ? 'CONFIRMADO' : 'ACTIVO'}
          tamano={26}
        />
        <h2 id={idTitulo} className="caso__titulo">
          {categoria.nombre}
        </h2>
        <span className="caso__hora">{horaDe(caso.creadoEn)}</span>
      </header>
      <ul className="caso__motivos" aria-label="Por qué está en la cola">
        {caso.marcado && (
          <li>
            <Flag aria-hidden="true" size={18} strokeWidth={TRAZO} />
            Marcado: {caso.motivos.map(textoDeMotivo).join(' · ')}
          </li>
        )}
        {caso.negaciones > 0 && (
          <li>
            <ThumbsDown aria-hidden="true" size={18} strokeWidth={TRAZO} />
            {caso.negaciones === 1
              ? '1 persona dijo que ya no está'
              : `${caso.negaciones} personas dijeron que ya no está`}
          </li>
        )}
      </ul>
      {caso.descripcion ? (
        <blockquote className="caso__descripcion">{caso.descripcion}</blockquote>
      ) : (
        <p className="caso__sin-descripcion">Sin descripción del autor.</p>
      )}
      <a
        className="boton-texto boton-texto--chico caso__mapa"
        href={enlaceAlReporte(caso.idReporte, caso.publicLocation)}
      >
        <MapPin aria-hidden="true" size={18} strokeWidth={TRAZO} />
        Ver en el mapa
      </a>
      {rechazando ? (
        <FormularioDeRechazo
          enCurso={enCurso}
          alCancelar={() => setRechazando(false)}
          alConfirmar={(motivo) => alDecidir({ tipo: 'RECHAZAR', motivo })}
        />
      ) : (
        <div className="caso__acciones">
          <button
            type="button"
            className="boton-texto"
            disabled={enCurso}
            onClick={() => alDecidir({ tipo: 'MANTENER' })}
          >
            Mantener
          </button>
          <button type="button" className="boton-texto" onClick={() => setRechazando(true)}>
            Rechazar
          </button>
        </div>
      )}
    </article>
  );
}

function Cola() {
  const cola = useCola(true);
  const decidir = useDecidir();
  if (cola.isPending) return <p className="pagina__ayuda">Cargando la cola…</p>;
  if (cola.isError) {
    return (
      <div className="pagina__bloque">
        <p className="pagina__ayuda">No pudimos cargar la cola. Revisa tu conexión.</p>
        <button type="button" className="boton-texto" onClick={() => void cola.refetch()}>
          Reintentar
        </button>
      </div>
    );
  }
  if (cola.data.length === 0) {
    return <p className="pagina__ayuda">No hay reportes por revisar. Vuelve más tarde.</p>;
  }
  return (
    <>
      <p className="pagina__ayuda">
        {cola.data.length === 1 ? '1 reporte' : `${cola.data.length} reportes`} por revisar. Primero
        lo marcado por el clasificador, después lo más negado.
      </p>
      <div className="pagina__lista">
        {cola.data.map((caso) => (
          <TarjetaDeCaso
            key={caso.idReporte}
            caso={caso}
            enCurso={decidir.isPending && decidir.variables.idReporte === caso.idReporte}
            alDecidir={(decision) => decidir.mutate({ idReporte: caso.idReporte, decision })}
          />
        ))}
      </div>
    </>
  );
}

/** Sin el rol: cómo pedirlo, con el identificador anónimo del dispositivo. */
function SinRol({ idUsuario }: { readonly idUsuario: string | null }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    if (!idUsuario) return;
    await navigator.clipboard?.writeText(idUsuario).catch(() => undefined);
    setCopiado(true);
  };
  return (
    <div className="pagina__bloque">
      <p>Esta pantalla es para el equipo de moderación.</p>
      <p className="pagina__ayuda">
        Si te sumas al equipo, envía este identificador a la administración. Es anónimo: no dice
        quién eres.
      </p>
      {idUsuario && (
        <>
          <code className="pagina__codigo">{idUsuario}</code>
          <button type="button" className="boton-texto" onClick={() => void copiar()}>
            <Copy aria-hidden="true" size={18} strokeWidth={TRAZO} />
            {copiado ? 'Copiado' : 'Copiar identificador'}
          </button>
        </>
      )}
    </div>
  );
}

function Contenido() {
  const acceso = useAcceso();
  if (acceso.isPending) return <p className="pagina__ayuda">Comprobando tu acceso…</p>;
  if (acceso.isError) {
    return <p className="pagina__ayuda">Sin conexión: la moderación necesita señal.</p>;
  }
  if (!acceso.data.esModerador) return <SinRol idUsuario={acceso.data.idUsuario} />;
  return (
    <>
      <FormularioOficial />
      <Cola />
    </>
  );
}

/**
 * `/moderacion` (HU-12 y HU-13): la cola de reportes negados o marcados y la publicación de
 * incidentes oficiales, para el rol MODERADOR.
 */
export function PantallaDeModeracion() {
  return (
    <Pagina titulo="Moderación">
      <Contenido />
    </Pagina>
  );
}
