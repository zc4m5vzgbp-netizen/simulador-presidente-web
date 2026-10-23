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

/** Cantidad de equipo de una categoría en el batallón: operativo + dañado (ambos ocupan hueco en la plantilla). */
export function categoryCount(u: Unit, cat: EquipCategory): number {
  let n = 0;
  for (const [id, q] of Object.entries(u.equipment)) if (modelOf(id).category === cat) n += q;
  for (const [id, q] of Object.entries(u.damaged)) if (modelOf(id).category === cat) n += q;
  return n;
}

export interface CategoryStatus {
  /** Operativos + dañados. */
  total: number;
  /** Operativos CON tripulación: los únicos que combaten. */
  active: number;
  /** Dañados: no combaten hasta repararse. */
  damaged: number;
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
  for (const cat of EQUIP_CATEGORIES) byCategory[cat] = { total: 0, active: 0, damaged: 0, max: BATTALION_TEMPLATE.slots[cat] };
  for (const [id, q] of Object.entries(u.damaged)) {
    const cat = modelOf(id).category;
    byCategory[cat].damaged += q;
    byCategory[cat].total += q;
  }
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

/** Vehículos activos (operativos y tripulados) por modelo, para el combate. */
export function activeByModel(u: Unit): { model: EquipmentModel; active: number }[] {
  let available = u.men;
  const out: { model: EquipmentModel; active: number }[] = [];
  const entries = Object.entries(u.equipment).map(([id, q]) => ({ m: modelOf(id), q }));
  for (const cat of CREW_PRIORITY) {
    for (const { m, q } of entries.filter((e) => e.m.category === cat).sort((a, b) => a.m.id.localeCompare(b.m.id))) {
      const active = Math.min(q, Math.floor(available / m.crew));
      available -= active * m.crew;
      if (active > 0) out.push({ model: m, active });
    }
  }
  return out;
}

/** Vehículos operativos (con o sin tripulación) del batallón. */
export function operationalVehicles(u: Unit): number {
  return Object.values(u.equipment).reduce((a, b) => a + b, 0);
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

/** Devuelve a la reserva nacional el equipo del batallón: el operativo a la reserva y el dañado a reparar. */
export function returnToInventory(state: GameState, u: Unit): void {
  const c = state.countries[u.owner];
  for (const [id, q] of Object.entries(u.equipment)) c.inventory[id] = (c.inventory[id] ?? 0) + q;
  for (const [id, q] of Object.entries(u.damaged)) c.inventoryDamaged[id] = (c.inventoryDamaged[id] ?? 0) + q;
  u.equipment = {};
  u.damaged = {};
}

/** El batallón pierde todo su equipo (destruido, rendido o abandonado fuera del territorio propio). */
export function loseAllEquipment(state: GameState, u: Unit): void {
  const lost = state.countries[u.owner].equipmentLost;
  for (const bag of [u.equipment, u.damaged]) for (const [id, q] of Object.entries(bag)) lost[id] = (lost[id] ?? 0) + q;
  u.equipment = {};
  u.damaged = {};
}

/**
 * Contabilidad por modelo: reserva + reserva dañada + en batallones (operativo y dañado) + perdido.
 * Sin fabricación ni compra (Fase 3), este total es constante durante toda la partida.
 */
export function equipmentLedger(state: GameState, c: CountryId): Record<string, number> {
  const t: Record<string, number> = {};
  const add = (bag: Record<string, number>) => { for (const [id, q] of Object.entries(bag)) t[id] = (t[id] ?? 0) + q; };
  const country = state.countries[c];
  add(country.inventory); add(country.inventoryDamaged); add(country.equipmentLost);
  for (const u of Object.values(state.units)) if (u.owner === c) { add(u.equipment); add(u.damaged); }
  for (const id of Object.keys(t)) if (!t[id]) delete t[id];
  return t;
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
export function nationalEquipment(state: GameState, c: CountryId): { model: EquipmentModel; assigned: number; reserve: number; damaged: number; lost: number }[] {
  const assigned: Record<string, number> = {}, damaged: Record<string, number> = {};
  for (const u of Object.values(state.units)) {
    if (u.owner !== c) continue;
    for (const [id, q] of Object.entries(u.equipment)) assigned[id] = (assigned[id] ?? 0) + q;
    for (const [id, q] of Object.entries(u.damaged)) damaged[id] = (damaged[id] ?? 0) + q;
  }
  const { inventory: inv, inventoryDamaged: invD, equipmentLost: lost } = state.countries[c];
  const ids = new Set([...Object.keys(assigned), ...Object.keys(inv), ...Object.keys(damaged), ...Object.keys(invD), ...Object.keys(lost)]);
  return [...ids].map((id) => ({
    model: modelOf(id),
    assigned: assigned[id] ?? 0,
    reserve: inv[id] ?? 0,
    damaged: (damaged[id] ?? 0) + (invD[id] ?? 0),
    lost: lost[id] ?? 0,
  }))
    .sort((a, b) => EQUIP_CATEGORIES.indexOf(a.model.category) - EQUIP_CATEGORIES.indexOf(b.model.category) || a.model.id.localeCompare(b.model.id));
}

/** Totales de varios batallones (panel de multiselección, MIL-145). */
export function unitsTotals(units: Unit[]) {
  const byCategory = {} as Record<EquipCategory, { total: number; active: number; damaged: number }>;
  for (const cat of EQUIP_CATEGORIES) byCategory[cat] = { total: 0, active: 0, damaged: 0 };
  let men = 0, infantry = 0, pending = 0;
  for (const u of units) {
    const r = crewReport(u);
    men += u.men;
    infantry += r.infantry;
    pending += u.recruitPending;
    for (const cat of EQUIP_CATEGORIES) {
      byCategory[cat].total += r.byCategory[cat].total;
      byCategory[cat].active += r.byCategory[cat].active;
      byCategory[cat].damaged += r.byCategory[cat].damaged;
    }
  }
  return { men, infantry, pending, byCategory };
}
