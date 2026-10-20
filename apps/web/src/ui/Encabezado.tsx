import { BarChart3, BellRing, ShieldCheck } from 'lucide-react';
import { CATEGORIAS } from '../domain/categorias.js';
import { useEstado } from '../estado.js';
import type { EstadoDeConexion } from '../services/tiempo-real.js';
import { TRAZO } from './iconos.js';

const TEXTO_DE_CONEXION: Record<EstadoDeConexion, string> = {
  'en-vivo': 'En vivo',
  conectando: 'Conectando…',
  'sin-conexion': 'Sin conexión',
};

/**
 * Cabecera: el nombre, el estado del tiempo real, las zonas suscritas y la franja de la red, que
 * es la leyenda. Una línea apagada por los filtros se ve atenuada en la franja.
 */
export function Encabezado() {
  const conexion = useEstado((s) => s.conexion);
  const ocultas = useEstado((s) => s.filtros.ocultas);
  const abrirZonas = useEstado((s) => s.abrirZonas);
  const esModerador = useEstado((s) => s.esModerador);
  return (
    <header className="encabezado">
      <div className="encabezado__fila">
        <div>
          <h1 className="encabezado__nombre">Alerta LP</h1>
          <p className="encabezado__lugar">La Paz · El Alto</p>
        </div>
        <div className="encabezado__acciones">
          <p className="conexion" data-estado={conexion} role="status" aria-live="polite">
            <span className="conexion__punto" aria-hidden="true" />
            {TEXTO_DE_CONEXION[conexion]}
          </p>
          <button
            type="button"
            className="boton-redondo boton-redondo--chico boton-redondo--plano"
            onClick={abrirZonas}
          >
            <BellRing aria-hidden="true" size={20} strokeWidth={TRAZO} />
            <span className="solo-lector">Mis zonas</span>
          </button>
          <a
            className="boton-redondo boton-redondo--chico boton-redondo--plano"
            href="/datos-abiertos"
          >
            <BarChart3 aria-hidden="true" size={20} strokeWidth={TRAZO} />
            <span className="solo-lector">Datos abiertos</span>
          </a>
          {esModerador && (
            <a
              className="boton-redondo boton-redondo--chico boton-redondo--plano"
              href="/moderacion"
            >
              <ShieldCheck aria-hidden="true" size={20} strokeWidth={TRAZO} />
              <span className="solo-lector">Moderación</span>
            </a>
          )}
        </div>
      </div>
      <ul className="red" aria-label="Líneas de la red: un color por tipo de incidente">
        {CATEGORIAS.map((c) => {
          const oculta = ocultas.includes(c.codigo);
          return (
            <li
              key={c.codigo}
              className="red__linea"
              data-oculta={oculta || undefined}
              style={{ '--linea': c.color } as React.CSSProperties}
            >
              <span className="solo-lector">
                Línea {c.linea}: {c.nombre}
                {oculta ? ' (oculta por los filtros)' : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </header>
  );
}
