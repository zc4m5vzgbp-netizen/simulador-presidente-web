/**
 * Equipo terrestre de los batallones (MIL Fase 1): plantilla universal,
 * tripulación automática, equipo inactivo sin personal, inventario nacional y
 * reposición automática pausable.
 *
 * El equipo todavía NO interviene en el combate: eso llega en la Fase 2.
 */
import type { CountryId, GameState, Unit } from './types';
import {
  BATTALION_TEMPLATE, CREW_PRIORITY, EQUIPMENT_MODELS, EQUIP_CATEGORIES, PROVISIONAL_FILL, RECRUITMENT,
  nationalModel, type EquipCategory, type EquipmentModel,
} from '../data/military';

export { BATTALION_TEMPLATE, EQUIP_CATEGORIES, EQUIPMENT_MODELS, RECRUITMENT, type EquipCategory, type EquipmentModel };

export function modelOf(id: string): EquipmentModel {
  const m = EQUIPMENT_MODELS[id];
  if (!m) throw new Error(`Modelo de equipo desconocido: ${id}`);
  return m;
}

/** Cantidad de equipo de una categoría en el batallón. */
export function categoryCount(u: Unit, cat: EquipCategory): number {
  let n = 0;
  for (const [id, q] of Object.entries(u.equipment)) if (modelOf(id).category === cat) n += q;
  return n;
}

export interface CategoryStatus {
  total: number;
  /** Con tripulación: operativo. */
  active: number;
  max: number;
}

export interface CrewReport {
  byCategory: Record<EquipCategory, CategoryStatus>;
  /** Efectivos asignados como tripulación. */
  crew: number;
  /** Resto: infantería. */
  infantry: number;
  /** Tripulación que haría falta para todo el equipo. */
  crewNeeded: number;
}

/**
 * Tripulación automática (MIL-027 B): los efectivos tripulan el equipo por orden
 * de prioridad; lo que no tiene tripulación queda inactivo (MIL-028 B); el
 * resto de efectivos es infantería.
 */
export function crewReport(u: Unit): CrewReport {
  let available = u.men;
  let crew = 0, crewNeeded = 0;
  const byCategory = {} as Record<EquipCategory, CategoryStatus>;
  for (const cat of EQUIP_CATEGORIES) byCategory[cat] = { total: 0, active: 0, max: BATTALION_TEMPLATE.slots[cat] };
  const entries = Object.entries(u.equipment).map(([id, q]) => ({ m: modelOf(id), q }));
  for (const cat of CREW_PRIORITY) {
    for (const { m, q } of entries.filter((e) => e.m.category === cat).sort((a, b) => a.m.id.localeCompare(b.m.id))) {
      const active = Math.min(q, Math.floor(available / m.crew));
      available -= active * m.crew;
      crew += active * m.crew;
      crewNeeded += q * m.crew;
      byCategory[cat].total += q;
      byCategory[cat].active += active;
    }
  }
  return { byCategory, crew, infantry: available, crewNeeded };
}

/** Huecos libres de la plantilla para una categoría. */
export function freeSlots(u: Unit, cat: EquipCategory): number {
  return Math.max(0, BATTALION_TEMPLATE.slots[cat] - categoryCount(u, cat));
}

function addEquipment(u: Unit, modelId: string, qty: number): void {
  if (qty <= 0) return;
  u.equipment[modelId] = (u.equipment[modelId] ?? 0) + qty;
}

/**
 * Pasa equipo del inventario nacional al batallón hasta completar la plantilla.
 * Devuelve las unidades asignadas. Nunca supera los máximos ni crea equipo.
 */
export function fillFromInventory(state: GameState, u: Unit): number {
  const inv = state.countries[u.owner].inventory;
  let moved = 0;
  for (const cat of EQUIP_CATEGORIES) {
    let free = freeSlots(u, cat);
    if (!free) continue;
    for (const id of Object.keys(inv).sort()) {
      if (!free) break;
      if (modelOf(id).category !== cat || inv[id] <= 0) continue;
      const q = Math.min(free, inv[id]);
      inv[id] -= q;
      addEquipment(u, id, q);
      free -= q;
      moved += q;
    }
  }
  return moved;
}

/** Devuelve al inventario nacional todo el equipo del batallón (desmovilización). */
export function returnToInventory(state: GameState, u: Unit): void {
  const inv = state.countries[u.owner].inventory;
  for (const [id, q] of Object.entries(u.equipment)) inv[id] = (inv[id] ?? 0) + q;
  u.equipment = {};
}

/** Dotación inicial provisional de un batallón (partida nueva y migración de guardados v1). */
export function initialEquipment(c: CountryId): Record<string, number> {
  const fill = PROVISIONAL_FILL[c];
  const eq: Record<string, number> = {};
  for (const cat of EQUIP_CATEGORIES) {
    const q = Math.round(BATTALION_TEMPLATE.slots[cat] * fill[cat]);
    if (q > 0) eq[nationalModel(c, cat).id] = q;
  }
  return eq;
}

/** Reserva nacional inicial provisional: fracción de lo asignado a `battalions` batallones. */
export function initialInventory(c: CountryId, battalions: number): Record<string, number> {
  const fill = PROVISIONAL_FILL[c];
  const inv: Record<string, number> = {};
  for (const [id, q] of Object.entries(initialEquipment(c))) inv[id] = Math.round(q * battalions * fill.reserve);
  // Con pocos batallones el redondeo dejaría reservas a cero: al menos lo de un batallón × reserva.
  for (const cat of EQUIP_CATEGORIES) {
    const id = nationalModel(c, cat).id;
    if (fill[cat] > 0 && !inv[id]) inv[id] = Math.max(1, Math.round(BATTALION_TEMPLATE.slots[cat] * fill[cat] * fill.reserve));
  }
  return inv;
}

/** Totales de equipo de un país: en batallones y en reserva, por modelo. */
export function nationalEquipment(state: GameState, c: CountryId): { model: EquipmentModel; assigned: number; reserve: number }[] {
  const assigned: Record<string, number> = {};
  for (const u of Object.values(state.units)) {
    if (u.owner !== c) continue;
    for (const [id, q] of Object.entries(u.equipment)) assigned[id] = (assigned[id] ?? 0) + q;
  }
  const inv = state.countries[c].inventory;
  const ids = new Set([...Object.keys(assigned), ...Object.keys(inv)]);
  return [...ids].map((id) => ({ model: modelOf(id), assigned: assigned[id] ?? 0, reserve: inv[id] ?? 0 }))
    .sort((a, b) => EQUIP_CATEGORIES.indexOf(a.model.category) - EQUIP_CATEGORIES.indexOf(b.model.category) || a.model.id.localeCompare(b.model.id));
}

/** Totales de varios batallones (panel de multiselección, MIL-145). */
export function unitsTotals(units: Unit[]) {
  const byCategory = {} as Record<EquipCategory, { total: number; active: number }>;
  for (const cat of EQUIP_CATEGORIES) byCategory[cat] = { total: 0, active: 0 };
  let men = 0, infantry = 0, pending = 0;
  for (const u of units) {
    const r = crewReport(u);
    men += u.men;
    infantry += r.infantry;
    pending += u.recruitPending;
    for (const cat of EQUIP_CATEGORIES) {
      byCategory[cat].total += r.byCategory[cat].total;
      byCategory[cat].active += r.byCategory[cat].active;
    }
  }
  return { men, infantry, pending, byCategory };
}
