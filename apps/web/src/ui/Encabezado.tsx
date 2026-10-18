import { CATEGORIAS } from '../domain/categorias.js';
import { useEstado } from '../estado.js';
import type { EstadoDeConexion } from '../services/tiempo-real.js';

const TEXTO_DE_CONEXION: Record<EstadoDeConexion, string> = {
  'en-vivo': 'En vivo',
  conectando: 'Conectando…',
  'sin-conexion': 'Sin conexión',
};

/** Cabecera: el nombre, el estado del tiempo real y la franja de la red, que es la leyenda. */
export function Encabezado() {
  const conexion = useEstado((s) => s.conexion);
  return (
    <header className="encabezado">
      <div className="encabezado__fila">
        <div>
          <h1 className="encabezado__nombre">Alerta LP</h1>
          <p className="encabezado__lugar">La Paz · El Alto</p>
        </div>
        <p className="conexion" data-estado={conexion} role="status" aria-live="polite">
          <span className="conexion__punto" aria-hidden="true" />
          {TEXTO_DE_CONEXION[conexion]}
        </p>
      </div>
      <ul className="red" aria-label="Líneas de la red: un color por tipo de incidente">
        {CATEGORIAS.map((c) => (
          <li key={c.codigo} className="red__linea" style={{ background: c.color }}>
            <span className="solo-lector">
              Línea {c.linea}: {c.nombre}
            </span>
          </li>
        ))}
      </ul>
    </header>
  );
}
