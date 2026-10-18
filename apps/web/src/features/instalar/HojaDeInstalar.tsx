import { Download, House, Share, SquarePlus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEstado } from '../../estado.js';
import { Hoja } from '../../ui/Hoja.js';
import { TRAZO } from '../../ui/iconos.js';
import { instalarConElNavegador, useFormaDeInstalar } from './instalacion.js';

const PASOS_DE_IOS: readonly { readonly icono: LucideIcon; readonly texto: string }[] = [
  { icono: Share, texto: 'Toca «Compartir» en la barra de Safari.' },
  { icono: SquarePlus, texto: 'Elige «Agregar a inicio» y confirma con «Agregar».' },
  { icono: House, texto: 'Abre Alerta LP desde tu pantalla de inicio.' },
];

function PasosDeIos() {
  return (
    <>
      <ol className="pasos">
        {PASOS_DE_IOS.map(({ icono: Icono, texto }, i) => (
          <li key={texto} className="paso">
            <span className="paso__icono" aria-hidden="true">
              <Icono size={24} strokeWidth={TRAZO} />
            </span>
            <span>
              <span className="paso__numero">Paso {i + 1}. </span>
              {texto}
            </span>
          </li>
        ))}
      </ol>
      <p className="hoja__nota">
        Instalada, la app también puede recibir avisos de tus zonas (iOS 16.4 o superior).
      </p>
    </>
  );
}

function ConElNavegador() {
  const cerrar = useEstado((s) => s.cerrarInstalar);
  const instalar = async () => {
    if (await instalarConElNavegador()) {
      useEstado.getState().avisar('exito', 'Alerta LP quedó instalada.');
      cerrar();
    }
  };
  return (
    <div className="hoja__pie hoja__pie--columna">
      <button type="button" className="boton-primario" onClick={() => void instalar()}>
        <Download aria-hidden="true" size={22} strokeWidth={TRAZO} />
        Instalar app
      </button>
      <p className="hoja__nota">Se abre sin barra del navegador y funciona sin señal.</p>
    </div>
  );
}

/** Ayuda para instalar la PWA: el aviso del navegador o, en iPhone, los pasos en Safari. */
export function HojaDeInstalar() {
  const abierta = useEstado((s) => s.instalarAbierta);
  const cerrar = useEstado((s) => s.cerrarInstalar);
  const forma = useFormaDeInstalar();

  return (
    <Hoja
      abierta={abierta}
      alCerrar={cerrar}
      titulo="Instalar Alerta LP"
      ayuda="Tenla a mano en tu pantalla de inicio, como cualquier app."
    >
      {forma === 'pasos-de-ios' && <PasosDeIos />}
      {forma === 'aviso-del-navegador' && <ConElNavegador />}
      {forma === 'instalada' && (
        <p className="detalle__nota">Alerta LP ya está instalada en este dispositivo.</p>
      )}
      {forma === 'no-disponible' && (
        <p className="detalle__nota">
          Abre esta página en Chrome (Android) o Safari (iPhone), o usa «Instalar app» en el menú de
          tu navegador.
        </p>
      )}
    </Hoja>
  );
}
