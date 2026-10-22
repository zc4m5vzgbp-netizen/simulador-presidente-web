/** Ejército: batallones, reclutamiento, mantenimiento, rutas y movimiento. */
import type { CountryId, GameState, Unit } from './types';
import { clamp, fail, log, newId, ok, type ActionResult } from './core';
import { REGIONS, distance, countryName } from './world';
import { atWar, sameSide } from './war';

export const UNIT_MAX_MEN = 1000;
export const TRAINING_HOURS = 15 * 24;
/** Velocidad base en unidades de mapa por hora (≈3 días entre regiones vecinas). */
export const BASE_SPEED = 1.4;
export const HOSTILE_SPEED_FACTOR = 0.65;

export function unitsOf(state: GameState, c: CountryId): Unit[] {
  return Object.values(state.units).filter((u) => u.owner === c);
}

export function unitsIn(state: GameState, regionId: string): Unit[] {
  return Object.values(state.units).filter((u) => u.regionId === regionId);
}

/** Fuerza de combate de un batallón. */
export function unitPower(state: GameState, u: Unit): number {
  if (u.status === 'training') return 0;
  const q = state.countries[u.owner].armyQuality;
  return (u.men / UNIT_MAX_MEN) * 10 * q * (0.3 + 0.7 * u.org / 100) * (0.6 + 0.4 * u.morale / 100);
}

export function countryPower(state: GameState, c: CountryId): number {
  return unitsOf(state, c).reduce((s, u) => s + unitPower(state, u), 0);
}

/** Coste anual de mantener todos los batallones (miles de millones USD). */
export function upkeepNeeded(state: GameState, c: CountryId): number {
  const cost = state.countries[c].unitCost;
  return unitsOf(state, c).reduce((s, u) => s + (u.men / UNIT_MAX_MEN) * cost, 0);
}

export function recruitCost(state: GameState, c: CountryId): number {
  return state.countries[c].unitCost * 0.5;
}

/** ¿Puede un batallón de `owner` entrar en la región? */
export function canEnter(state: GameState, owner: CountryId, regionId: string): boolean {
  const ctrl = state.regions[regionId].controller;
  return ctrl === owner || atWar(state, owner, ctrl) || sameSide(state, owner, ctrl);
}

export function createUnit(state: GameState, owner: CountryId, regionId: string, training: boolean): Unit {
  const id = newId(state, 'u');
  const c = state.countries[owner];
  const n = unitsOf(state, owner).length + 1;
  const unit: Unit = {
    id,
    owner,
    name: `${n}.º Batallón`,
    men: UNIT_MAX_MEN,
    org: training ? 40 : 100,
    morale: clamp(50 + c.stability / 2, 0, 100),
    regionId,
    destination: null,
    path: [],
    progress: 0,
    status: training ? 'training' : 'idle',
    trainingHours: training ? TRAINING_HOURS : 0,
  };
  // Evitar nombres repetidos tras bajas
  const names = new Set(unitsOf(state, owner).map((u) => u.name));
  let k = n;
  while (names.has(unit.name)) unit.name = `${++k}.º Batallón`;
  state.units[id] = unit;
  return unit;
}

export function recruit(state: GameState, c: CountryId, regionId: string): ActionResult {
  const country = state.countries[c];
  const region = state.regions[regionId];
  if (!region) return fail('Región desconocida.');
  if (region.owner !== c || region.controller !== c) return fail('Solo se recluta en territorio propio no ocupado.');
  const cost = recruitCost(state, c);
  if (country.reserves < cost) return fail(`Reservas insuficientes (necesitas ${cost.toFixed(2)} mil M).`);
  country.reserves -= cost;
  const u = createUnit(state, c, regionId, true);
  log(state, 'military', `${countryName(c)} recluta el ${u.name} en ${REGIONS[regionId].name}.`, [c]);
  return ok(`${u.name} en entrenamiento (15 días). Coste: ${cost.toFixed(2)} mil M.`);
}

export function disband(state: GameState, c: CountryId, unitId: string): ActionResult {
  const u = state.units[unitId];
  if (!u || u.owner !== c) return fail('Batallón no válido.');
  delete state.units[unitId];
  log(state, 'military', `${countryName(c)} desmoviliza el ${u.name}.`, [c]);
  return ok(`${u.name} desmovilizado.`);
}

function travelHours(state: GameState, owner: CountryId, from: string, to: string): number {
  const hostile = state.regions[to].controller !== owner && !sameSide(state, owner, state.regions[to].controller);
  return distance(from, to) / (BASE_SPEED * (hostile ? HOSTILE_SPEED_FACTOR : 1));
}

/** Ruta más rápida (Dijkstra) por regiones transitables. Devuelve la lista sin el origen. */
export function findPath(state: GameState, owner: CountryId, from: string, to: string): string[] | null {
  if (from === to) return [];
  if (!canEnter(state, owner, to)) return null;
  const dist: Record<string, number> = { [from]: 0 };
  const prev: Record<string, string> = {};
  const open = new Set([from]);
  const done = new Set<string>();
  while (open.size) {
    let cur = '';
    let best = Infinity;
    for (const id of open) if (dist[id] < best) { best = dist[id]; cur = id; }
    open.delete(cur);
    done.add(cur);
    if (cur === to) break;
    for (const n of REGIONS[cur].neighbors) {
      if (done.has(n) || !canEnter(state, owner, n)) continue;
      const d = best + travelHours(state, owner, cur, n);
      if (d < (dist[n] ?? Infinity)) { dist[n] = d; prev[n] = cur; open.add(n); }
    }
  }
  if (!(to in prev)) return null;
  const path: string[] = [];
  for (let at = to; at !== from; at = prev[at]) path.unshift(at);
  return path;
}

export function moveUnit(state: GameState, c: CountryId, unitId: string, target: string): ActionResult {
  const u = state.units[unitId];
  if (!u || u.owner !== c) return fail('Batallón no válido.');
  if (u.status === 'training') return fail('El batallón aún está en entrenamiento.');
  if (u.status === 'retreating') return fail('El batallón está en retirada.');
  if (!state.regions[target]) return fail('Región desconocida.');
  if (target === u.regionId) {
    u.path = []; u.destination = null; u.progress = 0;
    if (u.status === 'moving') u.status = 'idle';
    return ok(`${u.name} se detiene en ${REGIONS[target].name}.`);
  }
  const path = findPath(state, c, u.regionId, target);
  if (!path) {
    const ctrl = state.regions[target].controller;
    return fail(`No hay ruta transitable hasta ${REGIONS[target].name}${ctrl !== c && !atWar(state, c, ctrl) ? ` (no estás en guerra con ${countryName(ctrl)})` : ''}.`);
  }
  const keepProgress = u.path.length > 0 && u.path[0] === path[0];
  u.path = path;
  u.destination = target;
  if (!keepProgress) u.progress = 0;
  if (u.status !== 'combat') u.status = 'moving';
  return ok(`${u.name} marcha hacia ${REGIONS[target].name} (${path.length} etapa${path.length > 1 ? 's' : ''}).`);
}

/** Retirada a la región amiga vecina más cercana; si no hay, el batallón se rinde. */
export function retreat(state: GameState, u: Unit): void {
  const options = REGIONS[u.regionId].neighbors.filter((n) => {
    const ctrl = state.regions[n].controller;
    if (!(ctrl === u.owner || sameSide(state, u.owner, ctrl))) return false;
    return !unitsIn(state, n).some((o) => atWar(state, o.owner, u.owner));
  });
  if (!options.length) {
    log(state, 'military', `El ${u.name} de ${countryName(u.owner)} queda rodeado y se rinde en ${REGIONS[u.regionId].name}.`, [u.owner]);
    state.countries[u.owner].casualties += u.men;
    delete state.units[u.id];
    return;
  }
  options.sort((a, b) => distance(u.regionId, a) - distance(u.regionId, b));
  u.path = [options[0]];
  u.destination = options[0];
  u.progress = 0;
  u.status = 'retreating';
  log(state, 'military', `El ${u.name} de ${countryName(u.owner)} se retira hacia ${REGIONS[options[0]].name}.`, [u.owner]);
}

/** Avance horario del movimiento. */
export function hourlyMovement(state: GameState): void {
  for (const u of Object.values(state.units)) {
    if (u.status === 'training') {
      u.trainingHours -= 1;
      if (u.trainingHours <= 0) {
        u.status = 'idle';
        u.trainingHours = 0;
        if (u.owner === state.player) log(state, 'military', `El ${u.name} ha completado su entrenamiento.`, [u.owner]);
      }
      continue;
    }
    if (!u.path.length) continue;
    if (u.status !== 'moving' && u.status !== 'retreating' && u.status !== 'combat') continue;
    const next = u.path[0];
    if (!canEnter(state, u.owner, next)) {
      u.path = []; u.destination = null; u.progress = 0;
      if (u.status !== 'combat') u.status = 'idle';
      continue;
    }
    const hours = travelHours(state, u.owner, u.regionId, next);
    const orgFactor = u.status === 'retreating' ? 1 : 0.6 + 0.4 * (u.org / 100);
    u.progress += orgFactor / hours;
    if (u.progress >= 1) {
      u.regionId = next;
      u.path.shift();
      u.progress = 0;
      const hostilesHere = unitsIn(state, next).some((o) => o.status !== 'retreating' && atWar(state, o.owner, u.owner));
      if (!u.path.length || hostilesHere) {
        if (u.owner === state.player && !u.path.length && u.status !== 'retreating') {
          log(state, 'military', `El ${u.name} llegó a ${REGIONS[next].name}.`, [u.owner]);
        }
        u.path = [];
        u.destination = null;
        u.status = hostilesHere && u.status !== 'retreating' ? 'combat' : 'idle';
      }
    }
  }
}

/** Recuperación diaria: organización, moral y desgaste por falta de abastecimiento. */
export function dailyMilitary(state: GameState): void {
  for (const u of Object.values(state.units)) {
    if (u.status === 'training') continue;
    const c = state.countries[u.owner];
    const supply = Math.min(c.supplyRatio, 1.2);
    if (u.status === 'idle' || u.status === 'moving') {
      const cap = 100 * clamp(supply, 0.3, 1);
      if (u.org < cap) u.org = Math.min(cap, u.org + 5 * supply);
      else u.org = Math.max(cap, u.org - 2);
    }
    const moraleTarget = clamp(40 + c.stability / 2 + (supply - 1) * 20, 10, 100);
    u.morale += (moraleTarget - u.morale) * 0.1;
    if (supply < 0.6) {
      const loss = Math.round(u.men * 0.003 * (0.6 - supply) / 0.6 * 3);
      u.men -= loss;
      c.casualties += loss;
      if (u.men < 150) {
        log(state, 'military', `El ${u.name} de ${countryName(u.owner)} se disuelve por falta de abastecimiento.`, [u.owner]);
        delete state.units[u.id];
      }
    }
  }
}
