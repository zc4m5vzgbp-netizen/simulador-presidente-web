/** Territorios: control de regiones y agregados económicos derivados. */
import type { CountryId, GameState } from './types';
import { REGIONS } from './world';
import { log } from './core';
import { countryName } from './world';

/**
 * MIL-085 A: un territorio ocupado funciona económicamente como propio para quien
 * lo controla, sin penalización automática (antes rendía el 50 %).
 */
export function regionsControlledBy(state: GameState, c: CountryId): string[] {
  return Object.values(state.regions).filter((r) => r.controller === c).map((r) => r.id);
}

export function regionsOwnedBy(state: GameState, c: CountryId): string[] {
  return Object.values(state.regions).filter((r) => r.owner === c).map((r) => r.id);
}

/** Recalcula PIB y población efectivos de cada país a partir del control territorial. */
export function recomputeAggregates(state: GameState): void {
  for (const c of Object.values(state.countries)) { c.gdp = 0; c.population = 0; }
  for (const r of Object.values(state.regions)) {
    const c = state.countries[r.controller];
    c.gdp += r.gdp;
    c.population += r.population;
  }
}

/** Fracción del PIB propio (de jure) actualmente bajo ocupación enemiga. */
export function occupiedFraction(state: GameState, c: CountryId): number {
  let total = 0, lost = 0;
  for (const r of Object.values(state.regions)) {
    if (r.owner !== c) continue;
    total += r.gdp;
    if (r.controller !== c) lost += r.gdp;
  }
  return total ? lost / total : 0;
}

/** Cambia el controlador de una región (ocupación o liberación). */
export function setController(state: GameState, regionId: string, controller: CountryId): void {
  const r = state.regions[regionId];
  const prev = r.controller;
  if (prev === controller) return;
  r.controller = controller;
  r.occupationHours = 0;
  r.occupier = null;
  const name = REGIONS[regionId].name;
  if (controller === r.owner) {
    log(state, 'war', `${countryName(controller)} recupera ${name}.`, [controller, prev]);
  } else {
    log(state, 'war', `${countryName(controller)} ocupa ${name} (${countryName(r.owner)}).`, [controller, prev, r.owner]);
    if (REGIONS[regionId].capital) {
      const victim = state.countries[r.owner];
      victim.stability = Math.max(0, victim.stability - 12);
      log(state, 'alert', `¡La capital de ${countryName(r.owner)} ha caído!`, [r.owner, controller]);
    }
  }
  recomputeAggregates(state);
  checkElimination(state);
}

/** Transfiere la propiedad legal (cesión en un tratado de paz). */
export function transferOwnership(state: GameState, regionId: string, newOwner: CountryId): void {
  const r = state.regions[regionId];
  r.owner = newOwner;
  r.controller = newOwner;
  r.occupationHours = 0;
  r.occupier = null;
  recomputeAggregates(state);
  checkElimination(state);
}

function checkElimination(state: GameState): void {
  for (const c of Object.values(state.countries)) {
    const controlsAny = Object.values(state.regions).some((r) => r.controller === c.id);
    if (!controlsAny && !c.eliminated) {
      c.eliminated = true;
      log(state, 'alert', `${countryName(c.id)} ha perdido todo su territorio.`, [c.id]);
      if (c.id === state.player) state.gameOver = { reason: 'Tu país ha perdido todo su territorio.', hour: state.hour };
    } else if (controlsAny && c.eliminated) {
      c.eliminated = false;
    }
  }
}

export function borderRegions(state: GameState, c: CountryId): string[] {
  return regionsControlledBy(state, c).filter((id) =>
    REGIONS[id].neighbors.some((n) => state.regions[n].controller !== c));
}
