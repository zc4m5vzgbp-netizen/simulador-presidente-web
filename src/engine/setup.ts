/** Creación de una partida nueva a partir de los datos iniciales. */
import type { AIMemory, CountryId, CountryState, GameState, RegionState } from './types';
import { SAVE_VERSION } from './types';
import { COUNTRY_DEFS, INITIAL_RELATIONS } from '../data/countries';
import { COUNTRY_IDS, REGION_DEFS } from '../data/regionDefs';
import { REGIONS, capitalOf, neighborCountries } from './world';
import { createUnit } from './military';
import { recomputeAggregates } from './territory';
import { log, monthIndex } from './core';
import { annualFlows } from './economy';

export function createNewGame(player: CountryId, seed = Date.now() >>> 0): GameState {
  if (!COUNTRY_IDS.includes(player)) throw new Error(`País no válido: ${player}`);

  const countries = {} as Record<CountryId, CountryState>;
  for (const id of COUNTRY_IDS) {
    const d = COUNTRY_DEFS[id];
    const policy = { taxRate: d.tax, publicSpending: d.spending, investment: d.investment, militaryBudget: d.military };
    countries[id] = {
      id,
      gdp: d.gdp,
      population: d.pop,
      reserves: d.reserves,
      debt: d.debt,
      policy: { ...policy },
      basePolicy: { ...policy },
      growth: d.growth,
      baseGrowth: d.growth,
      stability: d.stability,
      baseStability: d.stability,
      armyQuality: d.quality,
      unitCost: (0.9 * d.gdp * d.military / 100) / d.units,
      monthRevenue: 0,
      monthSpending: 0,
      monthInterest: 0,
      lastReport: null,
      casualties: 0,
      supplyRatio: 1,
      eliminated: false,
    };
  }

  const regions: Record<string, RegionState> = {};
  for (const id of COUNTRY_IDS) {
    const defs = REGION_DEFS.filter((r) => r.country === id);
    const gs = defs.reduce((s, r) => s + r.gdpShare, 0);
    const ps = defs.reduce((s, r) => s + r.popShare, 0);
    for (const r of defs) {
      regions[r.id] = {
        id: r.id,
        owner: id,
        controller: id,
        gdp: COUNTRY_DEFS[id].gdp * r.gdpShare / gs,
        population: COUNTRY_DEFS[id].pop * r.popShare / ps,
        occupationHours: 0,
        occupier: null,
      };
    }
  }

  const relations = {} as Record<CountryId, Record<CountryId, number>>;
  for (const a of COUNTRY_IDS) {
    relations[a] = {} as Record<CountryId, number>;
    const nb = neighborCountries(a);
    for (const b of COUNTRY_IDS) relations[a][b] = a === b ? 100 : nb.includes(b) ? 15 : 5;
  }
  for (const [a, b, v] of INITIAL_RELATIONS) { relations[a][b] = v; relations[b][a] = v; }

  const ai = {} as Record<CountryId, AIMemory>;
  for (const id of COUNTRY_IDS) {
    ai[id] = { aggression: COUNTRY_DEFS[id].aggression, lastRecruitHour: -9999, lastWarCheckMonth: monthIndex(0), lastActionHour: 0, target: null, decisions: 0 };
  }

  const state: GameState = {
    version: SAVE_VERSION,
    player,
    hour: 0,
    rng: seed >>> 0,
    nextId: 1,
    countries,
    regions,
    units: {},
    relations,
    cooldowns: {},
    trades: [],
    wars: [],
    truces: {},
    battles: {},
    proposals: [],
    ai,
    log: [],
    gameOver: null,
  };

  // Despliegue inicial: capital primero, luego regiones fronterizas.
  for (const id of COUNTRY_IDS) {
    const n = COUNTRY_DEFS[id].units;
    const cap = capitalOf(id);
    const others = REGION_DEFS.filter((r) => r.country === id && r.id !== cap)
      .map((r) => r.id)
      .sort((a, b) => foreignNeighbors(b) - foreignNeighbors(a));
    const order = [cap, ...others];
    for (let i = 0; i < n; i++) createUnit(state, id, order[i % order.length], false);
  }

  recomputeAggregates(state);
  for (const id of COUNTRY_IDS) {
    const c = state.countries[id];
    c.supplyRatio = annualFlows(state, id).military / (c.unitCost * COUNTRY_DEFS[id].units);
  }
  log(state, 'info', `Asumes la presidencia de ${COUNTRY_DEFS[player].name}.`, [player]);
  return state;
}

function foreignNeighbors(regionId: string): number {
  const r = REGIONS[regionId];
  return r.neighbors.filter((n) => REGIONS[n].country !== r.country).length;
}
