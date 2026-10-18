import { useEffect } from 'react';
import { categoriaDe } from '../../domain/categorias.js';
import { distanciaM, formatearDistancia } from '../../domain/geo.js';
import type { Punto } from '../../domain/geo.js';
import { horaDe, vigenciaDe } from '../../domain/reportes.js';
import type { ReportePublico } from '../../domain/reportes.js';
import { useEstado } from '../../estado.js';
import { useOrigen } from '../cerca/usarOrigen.js';
import type { Recuerdo } from '../../services/memoria.js';
import type { ValorDeVoto } from '../../services/votos.js';
import { Estacion } from '../../ui/Estacion.js';
import { Hoja } from '../../ui/Hoja.js';
import { BotonesDeVoto } from './BotonesDeVoto.js';
import { useMemoria, useVotar } from './usarVotar.js';

/** Por qué no se ofrece votar, o `null` si se puede. */
export function motivoSinVoto(recuerdo: Recuerdo | undefined): string | null {
  if (recuerdo?.propio) return 'Lo reportaste tú. Otras personas que pasen cerca lo confirmarán.';
  if (recuerdo?.voto === 'CONFIRMACION') return 'Ya votaste: sigue ahí.';
  if (recuerdo?.voto === 'NEGACION') return 'Ya votaste: ya no está.';
  return null;
}

interface PropsFicha {
  readonly reporte: ReportePublico;
  readonly desde: Punto;
  readonly conGps: boolean;
}

function Ficha({ reporte, desde, conGps }: PropsFicha) {
  const categoria = categoriaDe(reporte.codigoCategoria);
  const confirmado = reporte.estado === 'CONFIRMADO';
  return (
    <dl className="ficha">
      <div className="ficha__fila">
        <dt>Estado</dt>
        <dd>
          <Estacion
            color={categoria.color}
            estado={confirmado ? 'CONFIRMADO' : 'ACTIVO'}
            tamano={22}
          />
          {confirmado ? 'Confirmado por la comunidad' : 'Sin confirmar'}
        </dd>
      </div>
      <div className="ficha__fila">
        <dt>Distancia</dt>
        <dd>
          a {formatearDistancia(distanciaM(desde, reporte.publicLocation))}
          {conGps ? ' de ti' : ' del centro del mapa'}
        </dd>
      </div>
      <div className="ficha__fila">
        <dt>Reportado</dt>
        <dd>a las {horaDe(reporte.creadoEn)}</dd>
      </div>
      <div className="ficha__fila">
        <dt>Se muestra hasta</dt>
        <dd>{vigenciaDe(reporte.caducaEn)}</dd>
      </div>
    </dl>
  );
}

interface PropsDetalle {
  /** Reportes vigentes de la ventana: el detalle se actualiza con los eventos en vivo. */
  readonly reportes: readonly ReportePublico[];
}

/**
 * Detalle de un reporte (HU-03): su línea, su estado y su vigencia, y la pregunta «¿Sigue ahí?».
 * Si el reporte deja de estar en el mapa mientras se mira, la hoja se cierra con un aviso.
 */
export function HojaDeDetalle({ reportes }: PropsDetalle) {
  const idDetalle = useEstado((s) => s.detalle);
  const cerrar = useEstado((s) => s.cerrarDetalle);
  const { desde, conGps } = useOrigen();
  const memoria = useMemoria();
  const { votar, enCurso } = useVotar();
  const reporte = reportes.find((r) => r.id === idDetalle);

  useEffect(() => {
    if (idDetalle && !reporte) {
      cerrar();
      useEstado.getState().avisar('info', 'Este incidente ya no está en el mapa.');
    }
  }, [idDetalle, reporte, cerrar]);

  if (!reporte) return <Hoja abierta={false} alCerrar={cerrar} titulo="" />;

  const categoria = categoriaDe(reporte.codigoCategoria);
  const motivo = motivoSinVoto(memoria.get(reporte.id));
  const responder = async (valor: ValorDeVoto) => {
    if (await votar(reporte.id, valor)) cerrar();
  };

  return (
    <Hoja abierta alCerrar={cerrar} titulo={categoria.nombre} ayuda={`Línea ${categoria.linea}`}>
      <Ficha reporte={reporte} desde={desde} conGps={conGps} />
      {motivo ? (
        <p className="detalle__nota">{motivo}</p>
      ) : (
        <section className="pregunta" aria-labelledby="titulo-pregunta">
          <h3 id="titulo-pregunta" className="pregunta__titulo">
            ¿Sigue ahí?
          </h3>
          <p className="pregunta__ayuda">Responde solo si lo ves, a menos de 1 km.</p>
          <BotonesDeVoto enCurso={enCurso} responder={(v) => void responder(v)} />
        </section>
      )}
    </Hoja>
  );
}
