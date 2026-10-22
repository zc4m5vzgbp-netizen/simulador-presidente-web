/**
 * Registro de capas del mapa, en orden de dibujo (de abajo arriba).
 *
 * `active`  → capa con datos reales del juego; se puede mostrar u ocultar.
 * `planned` → capa reservada para futuras ampliaciones. Se dibuja como grupo
 *             SVG vacío (para fijar su posición en el apilado) y aparece en el
 *             menú de capas como "Próximamente". No contiene datos inventados.
 *
 * Para incorporar una capa nueva (p. ej. carreteras): añadir sus datos
 * verificados, cambiar `status` a 'active' y renderizarla en MapView dentro de
 * su grupo `data-layer`.
 */
export type LayerStatus = 'active' | 'planned';

export interface MapLayerDef {
  id: string;
  label: string;
  status: LayerStatus;
  /** Si el jugador puede ocultarla. */
  toggleable: boolean;
}

export const MAP_LAYERS: MapLayerDef[] = [
  { id: 'territory', label: 'Territorios', status: 'active', toggleable: false },
  { id: 'occupation', label: 'Territorios ocupados', status: 'active', toggleable: true },
  { id: 'borders', label: 'Fronteras', status: 'active', toggleable: false },
  { id: 'roads', label: 'Carreteras', status: 'planned', toggleable: true },
  { id: 'crossings', label: 'Pasos fronterizos', status: 'planned', toggleable: true },
  { id: 'cities', label: 'Ciudades', status: 'planned', toggleable: true },
  { id: 'ports', label: 'Puertos', status: 'planned', toggleable: true },
  { id: 'airports', label: 'Aeropuertos', status: 'planned', toggleable: true },
  { id: 'routes', label: 'Órdenes de marcha', status: 'active', toggleable: true },
  { id: 'units', label: 'Batallones', status: 'active', toggleable: true },
  { id: 'battles', label: 'Batallas y ocupaciones', status: 'active', toggleable: true },
  { id: 'labels', label: 'Nombres', status: 'active', toggleable: true },
  { id: 'selection', label: 'Selección', status: 'active', toggleable: false },
];

export type LayerVisibility = Record<string, boolean>;

export function defaultVisibility(): LayerVisibility {
  return Object.fromEntries(MAP_LAYERS.map((l) => [l.id, l.status === 'active']));
}
