/** Ejército: batallones, reclutamiento, mantenimiento, rutas y movimiento. */
import type { CountryId, GameState, Unit } from './types';
import { clamp, fail, log, newId, ok, type ActionResult } from './core';
import { REGIONS, distance, countryName } from './world';
import { atWar, sameSide } from './war';
import { BATTALION_TEMPLATE, RECRUITMENT, fillFromInventory, returnToInventory } from './equipment';

/** Máximo de efectivos por batallón (plantilla universal). */
export const UNIT_MAX_MEN = BATTALION_TEMPLATE.maxMen;
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

/** Crea un batallón operativo (sin entrenamiento obligatorio, MIL-018 A). El equipo lo asigna quien lo crea. */
export function createUnit(state: GameState, owner: CountryId, regionId: string, men: number = UNIT_MAX_MEN): Unit {
  const id = newId(state, 'u');
  const c = state.countries[owner];
  const n = unitsOf(state, owner).length + 1;
  const unit: Unit = {
    id,
    owner,
    name: `${n}.º Batallón`,
    men,
    org: 100,
    morale: clamp(50 + c.stability / 2, 0, 100),
    regionId,
    destination: null,
    path: [],
    progress: 0,
    status: 'idle',
    equipment: {},
    recruitPending: 0,
  };
  // Evitar nombres repetidos tras bajas
  const names = new Set(unitsOf(state, owner).map((u) => u.name));
  let k = n;
  while (names.has(unit.name)) unit.name = `${++k}.º Batallón`;
  state.units[id] = unit;
  return unit;
}

/**
 * Reclutamiento voluntario y progresivo (MIL-012 B, 013 A, 030 B): cada batallón
 * nace operativo con un primer contingente de voluntarios, recibe equipo del
 * inventario nacional y se completa día a día. El coste se paga al ordenarlo.
 */
export function recruit(state: GameState, c: CountryId, regionId: string, count = 1): ActionResult {
  const country = state.countries[c];
  const region = state.regions[regionId];
  if (!region) return fail('Región desconocida.');
  if (region.owner !== c || region.controller !== c) return fail('Solo se recluta en territorio propio no ocupado.');
  if (!Number.isInteger(count) || count < 1 || count > RECRUITMENT.maxPerOrder) return fail(`Se pueden reclutar de 1 a ${RECRUITMENT.maxPerOrder} batallones por orden.`);
  const cost = recruitCost(state, c) * count;
  if (country.reserves < cost) return fail(`Reservas insuficientes (necesitas ${cost.toFixed(2)} mil M).`);
  country.reserves -= cost;
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const u = createUnit(state, c, regionId, RECRUITMENT.initialMen);
    u.recruitPending = UNIT_MAX_MEN - RECRUITMENT.initialMen;
    fillFromInventory(state, u);
    names.push(u.name);
  }
  log(state, 'military', `${countryName(c)} recluta ${count === 1 ? `el ${names[0]}` : `${count} batallones`} en ${REGIONS[regionId].name}.`, [c]);
  const days = Math.ceil((UNIT_MAX_MEN - RECRUITMENT.initialMen) / RECRUITMENT.menPerDay);
  return ok(`${count === 1 ? names[0] : `${count} batallones`} en ${REGIONS[regionId].name}: operativo${count > 1 ? 's' : ''} con ${RECRUITMENT.initialMen} voluntarios; completo${count > 1 ? 's' : ''} en unos ${days} días. Coste: ${cost.toFixed(2)} mil M.`);
}

export function disband(state: GameState, c: CountryId, unitId: string): ActionResult {
  const u = state.units[unitId];
  if (!u || u.owner !== c) return fail('Batallón no válido.');
  // El equipo vuelve a las reservas solo si el batallón está en territorio que controla su país.
  const home = state.regions[u.regionId].controller === c;
  if (home) returnToInventory(state, u);
  delete state.units[unitId];
  log(state, 'military', `${countryName(c)} desmoviliza el ${u.name}.`, [c]);
  return ok(`${u.name} desmovilizado.${home ? ' Su equipo vuelve a las reservas.' : ' Su equipo se pierde fuera del territorio propio.'}`);
}

/** Activa o pausa la reposición automática de efectivos y equipo (MIL-019 B, 038 B). */
export function setAutoReplenish(state: GameState, c: CountryId, enabled: boolean): ActionResult {
  state.countries[c].autoReplenish = enabled;
  return ok(enabled ? 'Reposición automática activada.' : 'Reposición automática en pausa.');
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
        if (state.regions[u.regionId].controller === u.owner) returnToInventory(state, u);
        delete state.units[u.id];
      }
    }
  }
}

/**
 * Incorporación diaria de voluntarios y reposición automática (MIL-012, 019, 038).
 * Solo en territorio controlado por el propio país y fuera de combate o retirada.
 * Primero llegan los voluntarios ya reclutados; si la reposición está activa, se
 * cubren las bajas (pagando como un reclutamiento) y se completa el equipo con el
 * inventario nacional. Nunca se crea equipo: solo se mueve desde las reservas.
 */
export function dailyReplenishment(state: GameState): void {
  for (const u of Object.values(state.units)) {
    if (u.status === 'combat' || u.status === 'retreating') continue;
    if (state.regions[u.regionId].controller !== u.owner) continue;
    const c = state.countries[u.owner];
    let capacity = Math.min(RECRUITMENT.menPerDay, UNIT_MAX_MEN - u.men);
    const arrive = Math.min(capacity, u.recruitPending);
    u.men += arrive;
    u.recruitPending -= arrive;
    capacity -= arrive;
    if (!c.autoReplenish) continue;
    const deficit = UNIT_MAX_MEN - u.men - u.recruitPending;
    const perMan = recruitCost(state, u.owner) / UNIT_MAX_MEN;
    const buy = Math.min(capacity, Math.max(0, deficit), Math.floor(c.reserves / perMan));
    if (buy > 0) {
      c.reserves -= buy * perMan;
      u.men += buy;
    }
    fillFromInventory(state, u);
  }
}

/** Horas que faltan para que el batallón llegue a su destino al ritmo actual (MIL-033). */
export function etaHours(state: GameState, u: Unit): number {
  if (!u.path.length) return 0;
  const orgFactor = u.status === 'retreating' ? 1 : 0.6 + 0.4 * (u.org / 100);
  let from = u.regionId, total = 0;
  u.path.forEach((to, i) => {
    const h = travelHours(state, u.owner, from, to) / orgFactor;
    total += i === 0 ? h * (1 - u.progress) : h;
    from = to;
  });
  return total;
}
