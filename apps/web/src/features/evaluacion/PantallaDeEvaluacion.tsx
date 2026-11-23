import { useState } from 'react';
import { Pagina } from '../../ui/Pagina.js';
import { Segmentado } from '../../ui/Segmentado.js';
import { useAcceso } from '../moderacion/usarModeracion.js';
import { Etiquetado } from './Etiquetado.js';
import { Instantaneas } from './Instantaneas.js';
import { TareaCronometrada } from './TareaCronometrada.js';
import { Verificacion } from './Verificacion.js';

type Herramienta = 'instantaneas' | 'tarea' | 'etiquetado' | 'verificacion';

const HERRAMIENTAS = [
  { valor: 'instantaneas', nombre: 'Congelar' },
  { valor: 'tarea', nombre: 'Tarea' },
  { valor: 'etiquetado', nombre: 'Etiquetar' },
  { valor: 'verificacion', nombre: 'Verificar' },
] as const satisfies readonly { valor: Herramienta; nombre: string }[];

const PANTALLAS: Readonly<Record<Herramienta, () => React.JSX.Element>> = {
  instantaneas: Instantaneas,
  tarea: TareaCronometrada,
  etiquetado: Etiquetado,
  verificacion: Verificacion,
};

function Herramientas() {
  const [herramienta, setHerramienta] = useState<Herramienta>('instantaneas');
  const Activa = PANTALLAS[herramienta];
  return (
    <>
      <Segmentado
        etiqueta="Herramienta"
        opciones={HERRAMIENTAS}
        valor={herramienta}
        alCambiar={setHerramienta}
      />
      <Activa />
    </>
  );
}

function Contenido() {
  const acceso = useAcceso();
  if (acceso.isPending) return <p className="pagina__ayuda">Comprobando tu acceso…</p>;
  if (acceso.isError) {
    return <p className="pagina__ayuda">Sin conexión: la evaluación necesita señal.</p>;
  }
  if (!acceso.data.esModerador) {
    return (
      <p className="pagina__ayuda">
        Esta pantalla es para el equipo de investigación del piloto, con rol de moderación.
      </p>
    );
  }
  return <Herramientas />;
}

/**
 * `/evaluacion` (ADR-007, HU-14): instantáneas, tarea cronometrada, etiquetado y verificación. Se
 * usa en el dispositivo del investigador y se descarga solo al abrirla.
 */
export function PantallaDeEvaluacion() {
  return (
    <Pagina titulo="Evaluación">
      <Contenido />
    </Pagina>
  );
}
