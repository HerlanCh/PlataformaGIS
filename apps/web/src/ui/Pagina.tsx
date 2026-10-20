import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Avisos } from './Avisos.js';
import { TRAZO } from './iconos.js';

/** Marco de las pantallas aparte del mapa: volver, el título y una columna desplazable. */
export function Pagina({
  titulo,
  children,
}: {
  readonly titulo: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="pagina">
      <header className="pagina__cabecera">
        <a className="boton-texto boton-texto--chico" href="/">
          <ArrowLeft aria-hidden="true" size={18} strokeWidth={TRAZO} />
          Volver al mapa
        </a>
        <h1 className="pagina__titulo">{titulo}</h1>
      </header>
      <main className="pagina__cuerpo">{children}</main>
      <Avisos />
    </div>
  );
}
