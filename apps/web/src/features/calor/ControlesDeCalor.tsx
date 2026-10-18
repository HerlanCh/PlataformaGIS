import { SlidersHorizontal } from 'lucide-react';
import { hayFiltros } from '../../domain/filtros.js';
import { useEstado } from '../../estado.js';
import type { Capa, DiasDeCalor } from '../../estado.js';
import { TRAZO } from '../../ui/iconos.js';
import { Segmentado } from '../../ui/Segmentado.js';

const CAPAS: readonly { readonly valor: Capa; readonly nombre: string }[] = [
  { valor: 'incidentes', nombre: 'Ahora' },
  { valor: 'calor', nombre: 'Historial' },
];

const RANGOS: readonly { readonly valor: DiasDeCalor; readonly nombre: string }[] = [
  { valor: 7, nombre: '7 días' },
  { valor: 30, nombre: '30 días' },
  { valor: 90, nombre: '90 días' },
];

/**
 * Herramientas sobre el mapa: lo que pasa ahora (estaciones) o el historial (mapa de calor), y los
 * filtros, que afectan a las dos capas.
 */
export function HerramientasDelMapa() {
  const capa = useEstado((s) => s.capa);
  const disponible = useEstado((s) => s.calorDisponible);
  const fijarCapa = useEstado((s) => s.fijarCapa);
  const abrirFiltros = useEstado((s) => s.abrirFiltros);
  const filtrando = useEstado((s) => hayFiltros(s.filtros));
  return (
    <div className="mapa__herramientas">
      {disponible && (
        <Segmentado
          etiqueta="Qué muestra el mapa"
          opciones={CAPAS}
          valor={capa}
          alCambiar={fijarCapa}
        />
      )}
      <button
        type="button"
        className="boton-redondo"
        data-activo={filtrando || undefined}
        onClick={abrirFiltros}
      >
        <SlidersHorizontal aria-hidden="true" size={22} strokeWidth={TRAZO} />
        <span className="solo-lector">{filtrando ? 'Filtros (activos)' : 'Filtrar'}</span>
      </button>
    </div>
  );
}

interface PropsBarra {
  readonly cantidad: number | null;
  readonly cargando: boolean;
  readonly fallo: boolean;
}

/** Estado de la consulta del mapa de calor, dicho en una frase. */
function estadoDelCalor({ cantidad, cargando, fallo }: PropsBarra): string {
  if (fallo) return 'No pudimos cargar el historial de esta zona.';
  if (cantidad === null || (cargando && cantidad === 0)) return 'Cargando el historial…';
  if (cantidad === 0) return 'No hay zonas con 3 o más reportes aquí en ese periodo.';
  return 'Más oscuro, más reportes. Solo zonas con 3 o más.';
}

/** Barra del mapa de calor (HU-06): el periodo y cómo leerlo. */
export function BarraDeCalor(props: PropsBarra) {
  const dias = useEstado((s) => s.diasDeCalor);
  const fijarDias = useEstado((s) => s.fijarDiasDeCalor);
  return (
    <div className="barra-calor">
      <Segmentado etiqueta="Periodo" opciones={RANGOS} valor={dias} alCambiar={fijarDias} />
      <p className="barra-calor__ayuda" role="status">
        {estadoDelCalor(props)}
      </p>
    </div>
  );
}
