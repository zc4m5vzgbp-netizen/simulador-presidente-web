/**
 * Combate terrestre (MIL Fase 2): potencia, daño, pérdidas materiales,
 * suministros y reparación.
 *
 * Potencia de un batallón = (infantería + vehículos operativos tripulados × su
 * potencia de fuego × peso de su categoría × factor de combustible)
 *   × factor de munición × mantenimiento (presupuesto) × tecnología.
 *
 * NO intervienen (decisiones F2-001 A, F2-002 A, MIL-133 A, MIL-134 A, MIL-039 A):
 * terreno, fortificaciones, bonificación por defender o controlar la región,
 * moral, organización, experiencia ni la calidad del país.
 * Todos los coeficientes son PROVISIONALES (src/data/military.ts).
 */
import type { CountryId, GameState, Unit } from './types';
import { clamp, rand } from './core';
import { COMBAT, REPAIR, SUPPLY } from '../data/military';
import { activeByModel, modelOf, operationalVehicles, type EquipCategory } from './equipment';
import { sameSide } from './war';

/** Mantenimiento: depende del abastecimiento presupuestario del país (MIL-078 B). */
export function maintenanceFactor(state: GameState, c: CountryId): number {
  return COMBAT.maintenanceMin + (1 - COMBAT.maintenanceMin) * clamp(state.countries[c].supplyRatio, 0, 1);
}

/** Penalización por escasez de munición (afecta a toda la potencia). */
export function ammoFactor(u: Unit): number {
  return u.ammo >= SUPPLY.shortage ? 1 : SUPPLY.ammoFloor + (1 - SUPPLY.ammoFloor) * (u.ammo / SUPPLY.shortage);
}

/** Penalización por escasez de combustible (afecta a los vehículos). */
export function fuelFactor(u: Unit): number {
  return u.fuel >= SUPPLY.shortage ? 1 : SUPPLY.fuelFloor + (1 - SUPPLY.fuelFloor) * (u.fuel / SUPPLY.shortage);
}

/** Velocidad de marcha según el combustible: sin combustible se avanza a pie, más despacio. */
export function marchSpeedFactor(u: Unit): number {
  return u.fuel >= SUPPLY.shortage ? 1 : SUPPLY.fuelSpeedFloor + (1 - SUPPLY.fuelSpeedFloor) * (u.fuel / SUPPLY.shortage);
}

export interface PowerBreakdown {
  infantry: number;
  vehicles: number;
  fuel: number;
  ammo: number;
  maintenance: number;
  technology: number;
  total: number;
}

/** Potencia de combate desglosada (para la ficha y las pruebas). */
export function powerBreakdown(state: GameState, u: Unit): PowerBreakdown {
  const active = activeByModel(u);
  const crew = active.reduce((s, a) => s + a.active * a.model.crew, 0);
  const infantry = Math.max(0, u.men - crew) * COMBAT.infantryPower;
  const vehicles = active.reduce((s, a) => s + a.active * a.model.stats.firepower * COMBAT.categoryWeight[a.model.category], 0);
  const fuel = fuelFactor(u), ammo = ammoFactor(u), maintenance = maintenanceFactor(state, u.owner), technology = COMBAT.technology;
  return { infantry, vehicles, fuel, ammo, maintenance, technology, total: (infantry + vehicles * fuel) * ammo * maintenance * technology };
}

export function combatPower(state: GameState, u: Unit): number {
  return powerBreakdown(state, u).total;
}

export interface HitResult {
  men: number;
  damaged: Partial<Record<EquipCategory, number>>;
  destroyed: Partial<Record<EquipCategory, number>>;
}

/**
 * Aplica `dmg` puntos de daño a un batallón: bajas humanas (reducidas por el
 * blindaje de sus vehículos) y, por separado, impactos sobre vehículos
 * operativos que quedan dañados o destruidos (MIL-037 B, 137 B).
 * Nunca crea equipo: los destruidos pasan a `equipmentLost` del país.
 */
export function applyDamage(state: GameState, u: Unit, dmg: number): HitResult {
  const res: HitResult = { men: 0, damaged: {}, destroyed: {} };
  const armour = activeByModel(u).reduce((s, a) => s + a.active * a.model.stats.protection, 0);
  const shield = Math.min(COMBAT.maxShield, armour / COMBAT.shieldDivisor);
  res.men = Math.min(u.men, Math.round(dmg * (1 - shield)));
  u.men -= res.men;

  if (operationalVehicles(u) > 0) {
    const expected = dmg * COMBAT.vehicleHitsPerDamage;
    let hits = Math.floor(expected) + (rand(state) < expected - Math.floor(expected) ? 1 : 0);
    const lost = state.countries[u.owner].equipmentLost;
    while (hits-- > 0) {
      const pool = Object.entries(u.equipment).filter(([, q]) => q > 0).sort(([a], [b]) => a.localeCompare(b));
      const total = pool.reduce((s, [, q]) => s + q, 0);
      if (!total) break;
      let pick = rand(state) * total, id = pool[0][0];
      for (const [mid, q] of pool) { if (pick < q) { id = mid; break; } pick -= q; }
      const m = modelOf(id);
      u.equipment[id] -= 1;
      if (!u.equipment[id]) delete u.equipment[id];
      const pDestroy = COMBAT.destroyChance * Math.max(0, 1 - m.stats.protection / COMBAT.protectionDivisor);
      if (rand(state) < pDestroy) {
        lost[id] = (lost[id] ?? 0) + 1;
        res.destroyed[m.category] = (res.destroyed[m.category] ?? 0) + 1;
      } else {
        u.damaged[id] = (u.damaged[id] ?? 0) + 1;
        res.damaged[m.category] = (res.damaged[m.category] ?? 0) + 1;
      }
    }
  }
  return res;
}

/** ¿El batallón está en territorio que controla su país o un aliado de guerra? */
export function inFriendlyTerritory(state: GameState, u: Unit): boolean {
  const ctrl = state.regions[u.regionId].controller;
  return ctrl === u.owner || sameSide(state, u.owner, ctrl);
}

function repairBag(bag: Record<string, number>, into: Record<string, number>, rate: number): void {
  for (const id of Object.keys(bag).sort()) {
    const n = bag[id];
    if (!n) continue;
    const fixed = Math.min(n, Math.max(1, Math.round(n * rate)));
    bag[id] -= fixed;
    if (!bag[id]) delete bag[id];
    into[id] = (into[id] ?? 0) + fixed;
  }
}

/**
 * Cada día, fuera de combate: reabastecimiento de combustible y munición (igual
 * en cualquier territorio) y reparación de vehículos dañados, ambos limitados
 * por el presupuesto militar. La reparación solo se hace en territorio propio o
 * aliado. La reserva nacional dañada también se repara.
 */
export function dailySupplyAndRepair(state: GameState): void {
  for (const u of Object.values(state.units)) {
    if (u.status === 'combat') continue;
    const budget = clamp(state.countries[u.owner].supplyRatio, 0, 1);
    const rate = SUPPLY.dailyResupply * budget;
    u.fuel = Math.min(1, u.fuel + rate);
    u.ammo = Math.min(1, u.ammo + rate);
    // Los talleres de reparación solo están en territorio propio o aliado.
    if (inFriendlyTerritory(state, u) && state.countries[u.owner].supplyRatio >= REPAIR.minSupplyRatio) repairBag(u.damaged, u.equipment, REPAIR.dailyRate * budget);
  }
  for (const c of Object.values(state.countries)) {
    if (c.supplyRatio >= REPAIR.minSupplyRatio) repairBag(c.inventoryDamaged, c.inventory, REPAIR.dailyRate * clamp(c.supplyRatio, 0, 1));
  }
}
