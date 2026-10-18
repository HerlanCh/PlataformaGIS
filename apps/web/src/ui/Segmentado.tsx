import { useId } from 'react';

interface Opcion<T extends string | number> {
  readonly valor: T;
  readonly nombre: string;
}

interface PropsSegmentado<T extends string | number> {
  readonly etiqueta: string;
  readonly opciones: readonly Opcion<T>[];
  readonly valor: T;
  readonly alCambiar: (valor: T) => void;
}

/**
 * Selector de una opción entre pocas, como los botones de un tablero: radios nativos (teclado y
 * lectores de pantalla sin trabajo extra) dibujados como un riel de segmentos.
 */
export function Segmentado<T extends string | number>({
  etiqueta,
  opciones,
  valor,
  alCambiar,
}: PropsSegmentado<T>) {
  const nombre = useId();
  return (
    <fieldset className="segmentado">
      <legend className="segmentado__etiqueta">{etiqueta}</legend>
      <div className="segmentado__riel">
        {opciones.map((opcion) => (
          <label key={opcion.valor} className="segmentado__opcion">
            <input
              type="radio"
              name={nombre}
              checked={opcion.valor === valor}
              onChange={() => alCambiar(opcion.valor)}
            />
            <span>{opcion.nombre}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
