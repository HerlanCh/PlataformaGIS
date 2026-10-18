import type { ResultadoDeVoto, ValorDeVoto } from '../../services/votos.js';
import type { Mensaje } from '../reporte/mensajes.js';

const minutos = (segundos: number) => Math.max(1, Math.ceil(segundos / 60));

const RECHAZOS: Record<string, string> = {
  YA_VOTO: 'Ya habías votado por este incidente.',
  AUTOR_NO_PUEDE_VOTAR: 'Lo reportaste tú: otras personas lo confirmarán.',
  DEMASIADO_LEJOS_PARA_VOTAR: 'Acércate a menos de 1 km del incidente para votar.',
  REPORTE_NO_ACTIVO: 'Este incidente ya no está activo.',
  REPORTE_NO_ENCONTRADO: 'Este incidente ya no está activo.',
};

/** Lo que se le dice a quien votó «¿Sigue ahí?» (HU-03). */
export function mensajeDeVoto(resultado: ResultadoDeVoto, valor: ValorDeVoto): Mensaje {
  switch (resultado.tipo) {
    case 'REGISTRADO':
      return {
        tono: 'exito',
        texto:
          valor === 'CONFIRMACION'
            ? 'Gracias. Confirmaste que sigue ahí.'
            : 'Gracias. Avisaste que ya no está.',
      };
    case 'SIN_RED':
      return { tono: 'problema', texto: 'Sin conexión: vuelve a intentarlo cuando tengas señal.' };
    case 'RECHAZADO': {
      if (resultado.codigo === 'LIMITE_EXCEDIDO') {
        const espera =
          resultado.reintentarEnS === null ? '' : ` en ${minutos(resultado.reintentarEnS)} min`;
        return {
          tono: 'problema',
          texto: `Votaste muchas veces seguidas. Podrás votar de nuevo${espera}.`,
        };
      }
      const texto = RECHAZOS[resultado.codigo];
      return texto
        ? { tono: 'info', texto }
        : { tono: 'problema', texto: 'No se pudo registrar tu voto. Intenta de nuevo.' };
    }
  }
}
