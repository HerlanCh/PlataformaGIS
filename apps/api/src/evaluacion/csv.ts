// Lectura de CSV para el análisis del piloto: un salto de línea, una coma o comillas dobladas
// dentro de un campo entre comillas no rompen el registro (RFC 4180, como lo exporta una hoja de
// cálculo o `pnpm piloto:exportar`).

/** Registros del texto: un salto de línea dentro de comillas no corta el registro. */
function registros(texto: string): string[] {
  const resultado: string[] = [];
  let pendiente: string | null = null;
  let comillas = 0;
  for (const linea of texto.split(/\r?\n/)) {
    pendiente = pendiente === null ? linea : `${pendiente}\n${linea}`;
    comillas += linea.split('"').length - 1;
    if (comillas % 2 === 0) {
      resultado.push(pendiente);
      pendiente = null;
      comillas = 0;
    }
  }
  if (pendiente !== null) resultado.push(pendiente);
  return resultado;
}

/** Campos de un registro. */
function campos(registro: string): string[] {
  const valores: string[] = [];
  let campo = '';
  let entreComillas = false;
  for (let i = 0; i < registro.length; i += 1) {
    const c = registro[i]!;
    if (c === '"' && entreComillas && registro[i + 1] === '"') {
      campo += '"';
      i += 1;
    } else if (c === '"') entreComillas = !entreComillas;
    else if (c === ',' && !entreComillas) {
      valores.push(campo);
      campo = '';
    } else campo += c;
  }
  valores.push(campo);
  return valores;
}

/** CSV con encabezado a una lista de objetos; los campos ausentes quedan vacíos. */
export function leerCsv(texto: string): Record<string, string>[] {
  const [encabezado = [], ...datos] = registros(texto)
    .filter((r) => r.trim() !== '')
    .map(campos);
  return datos.map((f) =>
    Object.fromEntries(encabezado.map((nombre, j) => [nombre.trim(), (f[j] ?? '').trim()])),
  );
}

/** Filas a CSV con encabezado; un campo con coma, comillas o salto de línea va entre comillas. */
export function escribirCsv(
  columnas: readonly string[],
  filas: readonly Record<string, string | number | boolean | null>[],
): string {
  const campo = (valor: string | number | boolean | null | undefined): string => {
    const texto = valor === null || valor === undefined ? '' : String(valor);
    return /[",\r\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
  };
  const lineas = filas.map((f) => columnas.map((c) => campo(f[c])).join(','));
  return `${[columnas.join(','), ...lineas].join('\n')}\n`;
}
