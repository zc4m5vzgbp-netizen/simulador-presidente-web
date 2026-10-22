import type { CountryId, GameState } from '../engine/types';

/** Lo que el jugador tiene seleccionado en el mapa. */
export type Selection =
  | { kind: 'none' }
  | { kind: 'region'; regionId: string }
  | { kind: 'country'; country: CountryId }
  | { kind: 'units'; regionId: string; owner: CountryId; unitIds: string[] }
  | { kind: 'city'; cityId: string }
  | { kind: 'crossing'; crossingId: string }
  /** Estado/provincia real (Atlas), con la región del juego donde se tocó. */
  | { kind: 'state'; stateId: string; regionId: string }
  /** Instalación cartográfica (aeropuerto, puerto; preparada para bases). */
  | { kind: 'facility'; facilityId: string };

export const NO_SELECTION: Selection = { kind: 'none' };

/** Elimina de la selección batallones que ya no existen. */
export function cleanSelection(state: GameState, sel: Selection): Selection {
  if (sel.kind !== 'units') return sel;
  const ids = sel.unitIds.filter((id) => state.units[id]);
  if (!ids.length) return { kind: 'region', regionId: sel.regionId };
  return ids.length === sel.unitIds.length ? sel : { ...sel, unitIds: ids };
}

export function selectedUnitIds(sel: Selection): string[] {
  return sel.kind === 'units' ? sel.unitIds : [];
}
