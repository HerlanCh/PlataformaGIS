import { Eye, EyeOff } from 'lucide-react';
import { CATEGORIAS } from '../../domain/categorias.js';
import { ANTIGUEDADES, hayFiltros } from '../../domain/filtros.js';
import { useEstado } from '../../estado.js';
import { Estacion } from '../../ui/Estacion.js';
import { Hoja } from '../../ui/Hoja.js';
import { TRAZO } from '../../ui/iconos.js';
import { Segmentado } from '../../ui/Segmentado.js';

/**
 * Filtros del mapa: desde hace cuánto y qué líneas se ven. Cada línea se enciende o se apaga como
 * en un tablero de la red; una línea apagada también se atenúa en la franja del encabezado.
 */
export function HojaDeFiltros() {
  const abierta = useEstado((s) => s.filtrosAbiertos);
  const cerrar = useEstado((s) => s.cerrarFiltros);
  const filtros = useEstado((s) => s.filtros);
  const alternarLinea = useEstado((s) => s.alternarLinea);
  const fijarAntiguedad = useEstado((s) => s.fijarAntiguedad);
  const quitarFiltros = useEstado((s) => s.quitarFiltros);

  return (
    <Hoja abierta={abierta} alCerrar={cerrar} titulo="Filtrar el mapa">
      <Segmentado
        etiqueta="Reportados en"
        opciones={ANTIGUEDADES}
        valor={filtros.antiguedad}
        alCambiar={fijarAntiguedad}
      />
      <p className="hoja__seccion">Líneas</p>
      <ul className="lineas">
        {CATEGORIAS.map((categoria) => {
          const visible = !filtros.ocultas.includes(categoria.codigo);
          const Ojo = visible ? Eye : EyeOff;
          return (
            <li key={categoria.codigo}>
              <button
                type="button"
                className="linea linea--interruptor"
                aria-pressed={visible}
                onClick={() => alternarLinea(categoria.codigo)}
              >
                <Estacion color={categoria.color} estado="CONFIRMADO" tamano={30} />
                <span className="linea__texto">
                  <span className="linea__nombre">{categoria.nombre}</span>
                  <span className="linea__detalle">
                    Línea {categoria.linea} · {visible ? 'se ve en el mapa' : 'oculta'}
                  </span>
                </span>
                <Ojo className="linea__icono" aria-hidden="true" size={24} strokeWidth={TRAZO} />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="hoja__pie">
        {hayFiltros(filtros) && (
          <button type="button" className="boton-texto" onClick={quitarFiltros}>
            Quitar filtros
          </button>
        )}
        <button type="button" className="boton-primario" onClick={cerrar}>
          Listo
        </button>
      </div>
    </Hoja>
  );
}
