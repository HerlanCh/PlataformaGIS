// Texto de un aviso push de reporte en una zona (HU-08). Lo usa el service worker; está aparte
// para probarlo sin service worker.
import { categoriaDe } from '../domain/categorias.js';
import { enlaceAlReporte } from '../domain/reportes.js';

export interface AvisoMostrable {
  readonly titulo: string;
  readonly cuerpo: string;
  /** Un aviso por reporte: si llega repetido, reemplaza al anterior. */
  readonly etiqueta: string;
  /** Abre la app centrada en el reporte, con su detalle. */
  readonly url: string;
}

interface ContenidoDeAviso {
  readonly tipo: 'reporte-en-zona';
  readonly idReporte: string;
  readonly codigoCategoria: string;
  readonly publicLocation: { readonly latitud: number; readonly longitud: number };
}

const esContenido = (dato: unknown): dato is ContenidoDeAviso => {
  const c = dato as Partial<ContenidoDeAviso> | null;
  return (
    c?.tipo === 'reporte-en-zona' &&
    typeof c.idReporte === 'string' &&
    typeof c.codigoCategoria === 'string' &&
    typeof c.publicLocation?.latitud === 'number' &&
    typeof c.publicLocation.longitud === 'number'
  );
};

/** El aviso que se muestra, o `null` si el contenido no es un aviso de reporte. */
export function avisoDeReporte(dato: unknown): AvisoMostrable | null {
  if (!esContenido(dato)) return null;
  const categoria = categoriaDe(dato.codigoCategoria);
  return {
    titulo: `${categoria.corto} en tu zona`,
    cuerpo: `Línea ${categoria.linea}. Toca para verlo en el mapa.`,
    etiqueta: `reporte-${dato.idReporte}`,
    url: enlaceAlReporte(dato.idReporte, dato.publicLocation),
  };
}
