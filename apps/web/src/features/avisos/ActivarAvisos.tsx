import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff } from 'lucide-react';
import { useState } from 'react';
import { URL_API } from '../../configuracion.js';
import { useEstado } from '../../estado.js';
import {
  activarAvisos,
  AvisosNoDisponibles,
  desactivarAvisos,
  estadoDeAvisos,
} from '../../services/push.js';
import type { EstadoDeAvisos } from '../../services/push.js';
import { TRAZO } from '../../ui/iconos.js';

const CLAVE = ['avisos'] as const;

const EXPLICACION: Record<Exclude<EstadoDeAvisos, 'activos' | 'inactivos'>, string> = {
  'no-compatible': 'Este navegador no puede recibir avisos.',
  'requiere-instalar': 'En iPhone, los avisos llegan a la app instalada en tu pantalla de inicio.',
  bloqueados:
    'Bloqueaste los avisos de este sitio. Puedes permitirlos en la configuración del navegador.',
};

/** Activar o desactivar los avisos de las zonas en este dispositivo (HU-08). */
export function ActivarAvisos() {
  const consulta = useQueryClient();
  const abrirInstalar = useEstado((s) => s.abrirInstalar);
  const { data: estado } = useQuery({ queryKey: CLAVE, queryFn: estadoDeAvisos });
  const [enCurso, setEnCurso] = useState(false);

  const cambiar = async (accion: typeof activarAvisos) => {
    const { avisar } = useEstado.getState();
    setEnCurso(true);
    try {
      const nuevo = await accion(URL_API);
      consulta.setQueryData(CLAVE, nuevo);
      if (nuevo === 'activos') avisar('exito', 'Listo: te avisaremos de incidentes en tus zonas.');
    } catch (error) {
      avisar(
        'problema',
        error instanceof AvisosNoDisponibles
          ? 'Los avisos no están disponibles por ahora.'
          : 'No pudimos cambiar los avisos. Revisa tu conexión e intenta de nuevo.',
      );
    } finally {
      setEnCurso(false);
    }
  };

  if (!estado) return null;
  if (estado === 'activos') {
    return (
      <div className="avisos-push" data-estado="activos">
        <p className="avisos-push__texto">
          <Bell aria-hidden="true" size={20} strokeWidth={TRAZO} />
          Avisos activados en este dispositivo.
        </p>
        <button
          type="button"
          className="boton-texto boton-texto--chico"
          disabled={enCurso}
          onClick={() => void cambiar(desactivarAvisos)}
        >
          Desactivar
        </button>
      </div>
    );
  }
  if (estado === 'inactivos') {
    return (
      <button
        type="button"
        className="boton-texto boton-texto--ancho"
        disabled={enCurso}
        onClick={() => void cambiar(activarAvisos)}
      >
        <Bell aria-hidden="true" size={20} strokeWidth={TRAZO} />
        Activar avisos en este dispositivo
      </button>
    );
  }
  return (
    <div className="avisos-push">
      <p className="avisos-push__texto">
        <BellOff aria-hidden="true" size={20} strokeWidth={TRAZO} />
        {EXPLICACION[estado]}
      </p>
      {estado === 'requiere-instalar' && (
        <button type="button" className="boton-texto boton-texto--chico" onClick={abrirInstalar}>
          Cómo instalar
        </button>
      )}
    </div>
  );
}
