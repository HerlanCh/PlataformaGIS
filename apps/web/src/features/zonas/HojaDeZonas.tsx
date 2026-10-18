import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { categoriaDe } from '../../domain/categorias.js';
import { formatearDistancia } from '../../domain/geo.js';
import { useEstado } from '../../estado.js';
import { Estacion } from '../../ui/Estacion.js';
import { Hoja } from '../../ui/Hoja.js';
import { TRAZO } from '../../ui/iconos.js';
import { MAX_ZONAS, useZonas, zonasNoDisponibles } from './usarZonas.js';
import type { Zona } from './usarZonas.js';

interface PropsFila {
  readonly zona: Zona;
  readonly numero: number;
  readonly eliminando: boolean;
  readonly alEliminar: () => void;
}

/** Una zona: su radio, sus líneas como estaciones y eliminar con confirmación en el lugar. */
function FilaDeZona({ zona, numero, eliminando, alEliminar }: PropsFila) {
  const [confirmando, setConfirmando] = useState(false);
  return (
    <li className="zona">
      <div className="zona__texto">
        <span className="zona__nombre">
          Zona {numero} · radio de {formatearDistancia(zona.radioM)}
        </span>
        <span className="zona__lineas">
          {zona.categorias.map((codigo) => {
            const categoria = categoriaDe(codigo);
            return (
              <span key={codigo} className="zona__linea">
                <Estacion color={categoria.color} estado="CONFIRMADO" tamano={18} />
                {categoria.corto}
              </span>
            );
          })}
        </span>
      </div>
      {confirmando ? (
        <div className="zona__confirmar">
          <button
            type="button"
            className="boton-texto boton-texto--chico"
            onClick={() => setConfirmando(false)}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="boton-texto boton-texto--chico boton-texto--tinta"
            disabled={eliminando}
            onClick={alEliminar}
          >
            Sí, eliminar
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="boton-redondo boton-redondo--chico boton-redondo--plano"
          onClick={() => setConfirmando(true)}
        >
          <Trash2 aria-hidden="true" size={20} strokeWidth={TRAZO} />
          <span className="solo-lector">Eliminar la zona {numero}</span>
        </button>
      )}
    </li>
  );
}

function Contenido() {
  const { lista, eliminar } = useZonas();
  const empezarZona = useEstado((s) => s.empezarZona);

  if (zonasNoDisponibles(lista.error)) {
    return <p className="hoja__ayuda">Las zonas no están disponibles por ahora.</p>;
  }
  if (lista.isPending) return <p className="hoja__ayuda">Cargando tus zonas…</p>;
  if (lista.isError) {
    return <p className="hoja__ayuda">No pudimos cargar tus zonas. Revisa tu conexión.</p>;
  }
  const zonas = lista.data;
  const lleno = zonas.length >= MAX_ZONAS;
  return (
    <>
      {zonas.length === 0 ? (
        <p className="hoja__ayuda">
          Aún no tienes zonas. Marca tu casa, tu trabajo o tu ruta de cada día.
        </p>
      ) : (
        <ul className="zonas">
          {zonas.map((zona, i) => (
            <FilaDeZona
              key={zona.id}
              zona={zona}
              numero={zonas.length - i}
              eliminando={eliminar.isPending}
              alEliminar={() => eliminar.mutate(zona.id)}
            />
          ))}
        </ul>
      )}
      <div className="hoja__pie hoja__pie--columna">
        <button type="button" className="boton-primario" disabled={lleno} onClick={empezarZona}>
          <Plus aria-hidden="true" size={22} strokeWidth={TRAZO} />
          Nueva zona
        </button>
        <p className="hoja__nota">
          {lleno
            ? `Llegaste al máximo de ${MAX_ZONAS} zonas. Elimina una para crear otra.`
            : `Puedes tener hasta ${MAX_ZONAS} zonas, de 100 m a 2 km de radio.`}
        </p>
      </div>
    </>
  );
}

/** Zonas suscritas (HU-07): listar, eliminar y crear una nueva dibujándola en el mapa. */
export function HojaDeZonas() {
  const abierta = useEstado((s) => s.zonasAbiertas);
  const cerrar = useEstado((s) => s.cerrarZonas);
  return (
    <Hoja
      abierta={abierta}
      alCerrar={cerrar}
      titulo="Mis zonas"
      ayuda="Recibirás avisos de incidentes nuevos en estas zonas cuando actives las notificaciones."
    >
      <Contenido />
    </Hoja>
  );
}
