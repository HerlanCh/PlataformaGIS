import { X } from 'lucide-react';
import { useState } from 'react';
import { useEstado } from '../../estado.js';
import { TRAZO } from '../../ui/iconos.js';
import { useFormaDeInstalar } from './instalacion.js';

const CLAVE = 'alerta-lp:oferta-instalar';

function descartada(): boolean {
  try {
    return localStorage.getItem(CLAVE) === 'descartada';
  } catch {
    return false;
  }
}

/** Una línea bajo el título del panel que ofrece instalar la app, hasta que se descarta. */
export function OfertaDeInstalar() {
  const forma = useFormaDeInstalar();
  const abrirInstalar = useEstado((s) => s.abrirInstalar);
  const [oculta, setOculta] = useState(descartada);

  if (oculta || (forma !== 'aviso-del-navegador' && forma !== 'pasos-de-ios')) return null;
  const descartar = () => {
    try {
      localStorage.setItem(CLAVE, 'descartada');
    } catch {
      // Sin almacenamiento, se oculta solo en esta visita.
    }
    setOculta(true);
  };

  return (
    <p className="oferta">
      <span>Instala la app.</span>
      <span className="oferta__acciones">
        <button type="button" className="boton-texto boton-texto--chico" onClick={abrirInstalar}>
          Cómo instalar
        </button>
        <button
          type="button"
          className="boton-redondo boton-redondo--chico boton-redondo--plano"
          onClick={descartar}
        >
          <X aria-hidden="true" size={18} strokeWidth={TRAZO} />
          <span className="solo-lector">No mostrar más</span>
        </button>
      </span>
    </p>
  );
}
