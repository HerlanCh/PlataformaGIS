import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { CATEGORIAS } from '../../domain/categorias.js';
import { useEstado } from '../../estado.js';
import { Estacion } from '../../ui/Estacion.js';
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
  const dialogo = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (abierta && !d.open) d.showModal?.();
    if (!abierta && d.open) d.close();
  }, [abierta]);

  return (
    <dialog
      ref={dialogo}
      className="hoja"
      aria-labelledby="titulo-hoja"
      onClose={cerrar}
      onClick={(e) => {
        // Un toque fuera de la hoja (sobre el fondo) la cierra.
        if (e.target === e.currentTarget) cerrar();
      }}
    >
      <div className="hoja__contenido">
        <div className="hoja__cabecera">
          <h2 id="titulo-hoja" className="hoja__titulo">
            ¿Qué está pasando?
          </h2>
          <button type="button" className="boton-redondo" onClick={cerrar}>
            <X aria-hidden="true" size={22} strokeWidth={TRAZO} />
            <span className="solo-lector">Cerrar</span>
          </button>
        </div>
        <p className="hoja__ayuda">Se envía con tu ubicación actual.</p>
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
                  <Icono
                    className="linea__icono"
                    aria-hidden="true"
                    size={26}
                    strokeWidth={TRAZO}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </dialog>
  );
}
