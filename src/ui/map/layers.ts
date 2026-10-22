/**
 * Registro de capas del mapa, en orden de dibujo (de abajo arriba).
 *
 * `active`  → capa con datos reales completos para su propósito; se puede mostrar u ocultar.
 * `partial` → capa con datos reales pero NO exhaustivos (p. ej. solo los aeropuertos
 *             principales de Natural Earth). Se muestra con la etiqueta «Parcial».
 * `planned` → capa reservada para futuras ampliaciones (provincias, puertos, aeropuertos). Se dibuja como grupo
 *             SVG vacío (para fijar su posición en el apilado) y aparece en el
 *             menú de capas como "Próximamente". No contiene datos inventados.
 *
 * Para incorporar una capa nueva (p. ej. carreteras): añadir sus datos
 * verificados, cambiar `status` a 'active' y renderizarla en MapView dentro de
 * su grupo `data-layer`.
 */
export type LayerStatus = 'active' | 'partial' | 'planned';

export interface MapLayerDef {
  id: string;
  label: string;
  status: LayerStatus;
  /** Si el jugador puede ocultarla. */
  toggleable: boolean;
  /** Aclaración visible en el menú (fuente o cobertura). */
  note?: string;
}

export const MAP_LAYERS: MapLayerDef[] = [
  { id: 'territory', label: 'Territorios', status: 'active', toggleable: false },
  { id: 'occupation', label: 'Territorios ocupados', status: 'active', toggleable: true },
  { id: 'borders', label: 'Fronteras', status: 'active', toggleable: false },
  { id: 'hydro', label: 'Ríos y lagos', status: 'active', toggleable: true },
  { id: 'provinces', label: 'Estados y provincias', status: 'active', toggleable: true, note: 'Natural Earth admin-1' },
  { id: 'roads', label: 'Carreteras', status: 'active', toggleable: true, note: 'Más vías al acercar' },
  { id: 'crossings', label: 'Pasos fronterizos', status: 'active', toggleable: true },
  { id: 'ports', label: 'Puertos', status: 'partial', toggleable: true, note: 'Solo los principales' },
  { id: 'airports', label: 'Aeropuertos', status: 'partial', toggleable: true, note: 'Solo los principales' },
  { id: 'bases', label: 'Bases militares', status: 'planned', toggleable: true },
  { id: 'cities', label: 'Ciudades', status: 'active', toggleable: true },
  { id: 'routes', label: 'Órdenes de marcha', status: 'active', toggleable: true },
  { id: 'units', label: 'Batallones', status: 'active', toggleable: true },
  { id: 'battles', label: 'Batallas y ocupaciones', status: 'active', toggleable: true },
  { id: 'labels', label: 'Nombres', status: 'active', toggleable: true },
  { id: 'selection', label: 'Selección', status: 'active', toggleable: false },
];

export type LayerVisibility = Record<string, boolean>;

export function defaultVisibility(): LayerVisibility {
  return Object.fromEntries(MAP_LAYERS.map((l) => [l.id, l.status !== 'planned']));
}
