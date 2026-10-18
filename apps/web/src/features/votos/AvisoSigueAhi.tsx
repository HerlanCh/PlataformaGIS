import { useEffect } from 'react';
import { categoriaDe } from '../../domain/categorias.js';
import { distanciaM, formatearDistancia } from '../../domain/geo.js';
import type { ReportePublico } from '../../domain/reportes.js';
import { useEstado } from '../../estado.js';
import type { ValorDeVoto } from '../../services/votos.js';
import { Estacion } from '../../ui/Estacion.js';
import { BotonesDeVoto } from './HojaDeDetalle.js';
import { useSigueAhi } from './usarSigueAhi.js';
import { useVotar } from './usarVotar.js';

/**
 * Tarjeta «¿Sigue ahí?» que aparece sola cuando la persona pasa a menos de 150 m de un incidente.
 * No bloquea nada: se puede contestar, decir «No sé» o seguir usando el mapa.
 */
export function AvisoSigueAhi({ reportes }: { readonly reportes: readonly ReportePublico[] }) {
  const { reporte, descartar } = useSigueAhi(reportes);
  const posicion = useEstado((s) => s.posicion);
  const { votar, enCurso } = useVotar();
  const enfocar = useEstado((s) => s.enfocar);

  // La estación por la que se pregunta queda a la vista, por encima de la tarjeta.
  useEffect(() => {
    if (!reporte) return;
    enfocar(reporte.publicLocation);
    return () => enfocar(null);
  }, [reporte, enfocar]);

  if (!reporte) return null;
  const categoria = categoriaDe(reporte.codigoCategoria);
  const metros = posicion ? distanciaM(posicion, reporte.publicLocation) : null;
  const responder = async (valor: ValorDeVoto) => {
    await votar(reporte.id, valor);
    descartar();
  };

  return (
    <section className="sigue-ahi" aria-labelledby="titulo-sigue-ahi" aria-live="polite">
      <div className="sigue-ahi__cabecera">
        <Estacion
          color={categoria.color}
          estado={reporte.estado === 'CONFIRMADO' ? 'CONFIRMADO' : 'ACTIVO'}
          tamano={26}
        />
        <h2 id="titulo-sigue-ahi" className="sigue-ahi__titulo">
          {`¿Sigue ahí ${categoria.articulo} ${categoria.corto.toLowerCase()}${
            metros === null ? '' : ` a ${formatearDistancia(metros).replace(' ', '\u00a0')}`
          }?`}
        </h2>
      </div>
      <BotonesDeVoto enCurso={enCurso} responder={(v) => void responder(v)} />
      <button type="button" className="sigue-ahi__no-se" onClick={descartar}>
        No sé
      </button>
    </section>
  );
}
