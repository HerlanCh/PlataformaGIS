import { CATEGORIAS } from '../../domain/categorias.js';
import { useEstado } from '../../estado.js';
import { Estacion } from '../../ui/Estacion.js';
import { Hoja } from '../../ui/Hoja.js';
import { ICONO_DE_CATEGORIA, TRAZO } from '../../ui/iconos.js';

interface PropsHoja {
  /** Segundo toque: la categoría elegida. */
  readonly alElegir: (codigo: string) => void;
}

/**
 * Hoja de categorías (HU-01): las cinco líneas de la red como botones grandes. Tocar una envía el
 * reporte con la ubicación del GPS; no hay nada más que escribir.
 */
export function HojaDeCategorias({ alElegir }: PropsHoja) {
  const abierta = useEstado((s) => s.hojaAbierta);
  const cerrar = useEstado((s) => s.cerrarHoja);

  return (
    <Hoja
      abierta={abierta}
      alCerrar={cerrar}
      titulo="¿Qué está pasando?"
      ayuda="Se envía con tu ubicación actual."
    >
      <ul className="lineas">
        {CATEGORIAS.map((categoria) => {
          const Icono = ICONO_DE_CATEGORIA[categoria.codigo];
          return (
            <li key={categoria.codigo}>
              <button
                type="button"
                className="linea"
                style={{ '--linea': categoria.color } as React.CSSProperties}
                onClick={() => alElegir(categoria.codigo)}
              >
                <Estacion color={categoria.color} estado="CONFIRMADO" tamano={30} />
                <span className="linea__texto">
                  <span className="linea__nombre">{categoria.nombre}</span>
                  <span className="linea__detalle">
                    Línea {categoria.linea} · se muestra {categoria.horas} h
                  </span>
                </span>
                <Icono className="linea__icono" aria-hidden="true" size={26} strokeWidth={TRAZO} />
              </button>
            </li>
          );
        })}
      </ul>
    </Hoja>
  );
}
