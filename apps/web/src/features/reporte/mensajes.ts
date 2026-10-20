import type { TonoDeAviso } from '../../estado.js';
import type { Resultado } from '../../services/cola.js';
import type { ResultadoDeDescripcion } from '../../services/descripcion.js';

export interface Mensaje {
  readonly tono: TonoDeAviso;
  readonly texto: string;
}

const minutos = (segundos: number) => Math.max(1, Math.ceil(segundos / 60));

/** Lo que se le dice a quien reportó, según lo que respondió la API (HU-01 y HU-05). */
export function mensajeDeResultado(resultado: Resultado): Mensaje {
  switch (resultado.tipo) {
    case 'CREADO':
      return { tono: 'exito', texto: 'Reporte enviado. Ya aparece en el mapa.' };
    case 'DUPLICADO':
      return {
        tono: 'exito',
        texto: 'Ya lo habían reportado cerca. Contamos tu aviso como confirmación.',
      };
    case 'PROPIO_EXISTENTE':
      return { tono: 'info', texto: 'Ya tienes un reporte vigente de esto aquí cerca.' };
    case 'PENDIENTE':
      return {
        tono: 'info',
        texto: 'Sin señal: tu reporte se enviará solo cuando vuelva la conexión.',
      };
    case 'RECHAZADO':
      return mensajeDeRechazo(resultado.codigo, resultado.reintentarEnS);
  }
}

function mensajeDeRechazo(codigo: string, reintentarEnS: number | null): Mensaje {
  if (codigo === 'FUERA_DEL_AREA_DE_SERVICIO') {
    return { tono: 'problema', texto: 'Por ahora el servicio funciona solo en La Paz y El Alto.' };
  }
  if (codigo === 'LIMITE_EXCEDIDO') {
    const espera = reintentarEnS === null ? '' : ` en ${minutos(reintentarEnS)} min`;
    return {
      tono: 'problema',
      texto: `Hiciste varios reportes seguidos. Podrás reportar de nuevo${espera}.`,
    };
  }
  return { tono: 'problema', texto: 'No se pudo enviar el reporte. Intenta de nuevo.' };
}

/** Lo que se le dice a quien describió su reporte (HU-10). */
export function mensajeDeDescripcion(resultado: ResultadoDeDescripcion): Mensaje {
  if (resultado.tipo === 'GUARDADA') {
    return { tono: 'exito', texto: 'Detalle guardado. Solo lo leerá el equipo de moderación.' };
  }
  if (resultado.tipo === 'SIN_RED') {
    return { tono: 'problema', texto: 'Sin señal: no se pudo guardar el detalle.' };
  }
  const textos: Record<string, string> = {
    DESCRIPCION_YA_AGREGADA: 'Ese reporte ya tiene un detalle.',
    REPORTE_NO_VIGENTE: 'El reporte ya no está vigente.',
  };
  return {
    tono: 'problema',
    texto: textos[resultado.codigo] ?? 'No se pudo guardar el detalle. Intenta de nuevo.',
  };
}

/** Por qué no se pudo leer la posición del GPS, al reportar o al votar. */
export function mensajeDeUbicacion(
  error: GeolocationPositionError | null,
  accion: 'reportar' | 'votar' = 'reportar',
): Mensaje {
  if (error?.code === 1) {
    const que = accion === 'votar' ? 'el voto' : 'el reporte';
    return {
      tono: 'problema',
      texto: `Activa la ubicación para ${accion}: ${que} usa tu posición.`,
    };
  }
  return {
    tono: 'problema',
    texto: 'No pudimos obtener tu ubicación. Intenta de nuevo en un lugar abierto.',
  };
}
