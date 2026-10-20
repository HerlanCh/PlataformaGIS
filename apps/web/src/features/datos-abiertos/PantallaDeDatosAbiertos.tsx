import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { URL_API } from '../../configuracion.js';
import { categoriaDe } from '../../domain/categorias.js';
import { obtenerResumen, porcentaje, urlDelCsv } from '../../services/datos-abiertos.js';
import type { ResumenDatosAbiertos } from '../../services/datos-abiertos.js';
import { Estacion } from '../../ui/Estacion.js';
import { TRAZO } from '../../ui/iconos.js';
import { Pagina } from '../../ui/Pagina.js';

const fecha = (iso: string): string =>
  new Date(iso).toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' });

/** Ancho de una barra respecto de la mayor, en porcentaje. */
const proporcion = (valor: number, maximo: number): string =>
  `${maximo === 0 ? 0 : Math.round((valor / maximo) * 100)}%`;

function PorLinea({ resumen }: { readonly resumen: ResumenDatosAbiertos }) {
  const maximo = Math.max(0, ...resumen.porCategoria.map((c) => c.cantidad));
  return (
    <section className="tablero" aria-labelledby="tablero-lineas">
      <h2 id="tablero-lineas" className="tablero__titulo">
        Incidentes por línea
      </h2>
      <ul className="barras">
        {resumen.porCategoria.map(({ codigoCategoria, cantidad }) => {
          const categoria = categoriaDe(codigoCategoria);
          return (
            <li key={codigoCategoria} className="barras__fila">
              <span className="barras__nombre">
                <Estacion color={categoria.color} estado="CONFIRMADO" tamano={18} />
                {categoria.corto}
              </span>
              <span className="barras__pista" aria-hidden="true">
                <span className="barras__relleno" style={{ width: proporcion(cantidad, maximo) }} />
              </span>
              <span className="barras__cuenta">{cantidad}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PorHora({ resumen }: { readonly resumen: ResumenDatosAbiertos }) {
  const maximo = Math.max(0, ...resumen.porHoraDelDia);
  return (
    <section className="tablero" aria-labelledby="tablero-horas">
      <h2 id="tablero-horas" className="tablero__titulo">
        Por hora del día
      </h2>
      <ol className="columnas">
        {resumen.porHoraDelDia.map((cantidad, hora) => (
          <li key={hora} className="columnas__hora">
            <span className="columnas__barra" style={{ height: proporcion(cantidad, maximo) }} />
            <span className="solo-lector">
              {hora} h: {cantidad} {cantidad === 1 ? 'reporte' : 'reportes'}
            </span>
          </li>
        ))}
      </ol>
      <p className="columnas__eje" aria-hidden="true">
        <span>0 h</span>
        <span>6 h</span>
        <span>12 h</span>
        <span>18 h</span>
        <span>23 h</span>
      </p>
      <p className="pagina__ayuda">Hora de creación del reporte, en la hora de La Paz.</p>
    </section>
  );
}

function Tableros({ resumen }: { readonly resumen: ResumenDatosAbiertos }) {
  if (resumen.total === 0) {
    return <p className="pagina__ayuda">Todavía no hay reportes terminados para publicar.</p>;
  }
  const tasa = porcentaje(resumen.confirmados, resumen.total);
  return (
    <>
      <dl className="cifras">
        <div className="cifras__item">
          <dt>Reportes terminados</dt>
          <dd>{resumen.total}</dd>
        </div>
        <div className="cifras__item">
          <dt>Confirmados por la comunidad</dt>
          <dd>{tasa} %</dd>
        </div>
      </dl>
      {resumen.desde && resumen.hasta && (
        <p className="pagina__ayuda">
          Del {fecha(resumen.desde)} al {fecha(resumen.hasta)}.
        </p>
      )}
      <PorLinea resumen={resumen} />
      <PorHora resumen={resumen} />
    </>
  );
}

function Contenido() {
  const resumen = useQuery({
    queryKey: ['datos-abiertos', 'resumen'],
    queryFn: () => obtenerResumen(URL_API),
  });
  if (resumen.isPending) return <p className="pagina__ayuda">Cargando los datos…</p>;
  if (resumen.isError) {
    return (
      <div className="pagina__bloque">
        <p className="pagina__ayuda">No pudimos cargar los datos. Revisa tu conexión.</p>
        <button type="button" className="boton-texto" onClick={() => void resumen.refetch()}>
          Reintentar
        </button>
      </div>
    );
  }
  const { licencia } = resumen.data;
  return (
    <>
      <Tableros resumen={resumen.data} />
      <section className="tablero" aria-labelledby="tablero-descarga">
        <h2 id="tablero-descarga" className="tablero__titulo">
          Descargar los datos
        </h2>
        <p className="pagina__ayuda">
          Una fila por reporte terminado: línea, celda de 500 m, hora, estado final y si se
          confirmó. Sin datos de personas ni ubicaciones exactas.
        </p>
        <a className="boton-primario tablero__descarga" href={urlDelCsv(URL_API)} download>
          <Download aria-hidden="true" size={22} strokeWidth={TRAZO} />
          Descargar CSV
        </a>
        <p className="tablero__licencia">
          Licencia{' '}
          <a href={licencia.url} rel="license noopener noreferrer" target="_blank">
            {licencia.nombre}
          </a>
          . Puedes usarlos citando: {licencia.atribucion}.
        </p>
      </section>
    </>
  );
}

/** `/datos-abiertos` (HU-11): tableros públicos y la descarga con su licencia abierta. */
export function PantallaDeDatosAbiertos() {
  return (
    <Pagina titulo="Datos abiertos">
      <p className="pagina__intro">
        Lo que la comunidad reportó en La Paz y El Alto, sin datos de personas.
      </p>
      <Contenido />
    </Pagina>
  );
}
