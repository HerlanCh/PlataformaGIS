import { Check, CircleOff } from 'lucide-react';
import type { ValorDeVoto } from '../../services/votos.js';
import { TRAZO } from '../../ui/iconos.js';

interface PropsPregunta {
  readonly enCurso: boolean;
  readonly responder: (valor: ValorDeVoto) => void;
}

/** «¿Sigue ahí?» con sus dos respuestas, del mismo tamaño para no sugerir ninguna. */
export function BotonesDeVoto({ enCurso, responder }: PropsPregunta) {
  return (
    <div className="pregunta__botones">
      <button
        type="button"
        className="boton-voto"
        disabled={enCurso}
        onClick={() => responder('CONFIRMACION')}
      >
        <Check aria-hidden="true" size={22} strokeWidth={TRAZO} />
        Sigue ahí
      </button>
      <button
        type="button"
        className="boton-voto"
        disabled={enCurso}
        onClick={() => responder('NEGACION')}
      >
        <CircleOff aria-hidden="true" size={22} strokeWidth={TRAZO} />
        Ya no está
      </button>
    </div>
  );
}
