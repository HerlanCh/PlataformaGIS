import { CarFront, Construction, Dog, ShieldAlert, TrafficCone } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CodigoCategoria } from '../domain/categorias.js';

/** Pictograma de cada categoría: un solo trazo y grosor en toda la app. */
export const ICONO_DE_CATEGORIA: Record<CodigoCategoria, LucideIcon> = {
  bloqueo: Construction,
  accidente: CarFront,
  robo: ShieldAlert,
  infraestructura: TrafficCone,
  jauria: Dog,
};

export const TRAZO = 2;
