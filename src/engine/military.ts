/** Ejército: batallones, reclutamiento, mantenimiento, rutas y movimiento. */
import type { CountryId, GameState, Unit } from './types';
import { fail, log, newId, ok, type ActionResult } from './core';
import { REGIONS, distance, countryName } from './world';
import { atWar, declareWar, inTruce, sameSide } from './war';
import { BATTALION_TEMPLATE, RECRUITMENT, fillFromInventory, loseAllEquipment, returnToInventory } from './equipment';
import { combatPower, marchSpeedFactor, speedForFuel } from './combat';
import { SUPPLY } from '../data/military';

/** Máximo de efectivos por batallón (plantilla universal). */
export const UNIT_MAX_MEN = BATTALION_TEMPLATE.maxMen;
/** Velocidad base en unidades de mapa por hora, antes del multiplicador terrestre. */
export const BASE_SPEED = 1.4;
/** Territorio hostil: la marcha va al 65 % (regla aprobada, sin cambios). */
export const HOSTILE_SPEED_FACTOR = 0.65;
/**
 * MIL-MOV-001 (opción B, aprobada): multiplicador GLOBAL de la velocidad de los
 * batallones terrestres. ×4 = cada tramo dura el 25 % de lo que duraba antes
 * (Buenos Aires → Uruguay: 132 h → 33 h de juego). Se aplica en un único sitio,
 * `travelHours`, del que dependen las rutas, el avance horario, las retiradas
 * y la llegada estimada; igual para el jugador y la IA. No toca el reloj global,
 * la duración del día, el combate ni el consumo de combustible por hora.
 * Antes de MIL-MOV-001 equivalía a 1 (≈ 3 días entre regiones vecinas).
 */
export const LAND_SPEED_MULTIPLIER = 4;

export function unitsOf(state: GameState, c: CountryId): Unit[] {
  return Object.values(state.units).filter((u) => u.owner === c);
}

export function unitsIn(state: GameState, regionId: string): Unit[] {
  return Object.values(state.units).filter((u) => u.regionId === regionId);
}

/** Potencia de combate de un batallón (ver `combat.ts`: efectivos, equipo, suministros, mantenimiento, tecnología). */
export function unitPower(state: GameState, u: Unit): number {
  return combatPower(state, u);
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

/**
 * ¿Puede un batallón de `owner` entrar en la región? `assumeWarWith` permite
 * calcular la ruta de un ataque directo antes de que empiece la guerra.
 */
export function canEnter(state: GameState, owner: CountryId, regionId: string, assumeWarWith?: CountryId): boolean {
  const ctrl = state.regions[regionId].controller;
  return ctrl === owner || ctrl === assumeWarWith || atWar(state, owner, ctrl) || sameSide(state, owner, ctrl);
}

/** Crea un batallón operativo (sin entrenamiento obligatorio, MIL-018 A). El equipo lo asigna quien lo crea. */
export function createUnit(state: GameState, owner: CountryId, regionId: string, men: number = UNIT_MAX_MEN): Unit {
  const id = newId(state, 'u');
  const n = unitsOf(state, owner).length + 1;
  const unit: Unit = {
    id,
    owner,
    name: `${n}.º Batallón`,
    men,
    regionId,
    destination: null,
    path: [],
    progress: 0,
    status: 'idle',
    equipment: {},
    damaged: {},
    fuel: 1,
    ammo: 1,
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
  else loseAllEquipment(state, u);
  delete state.units[unitId];
  log(state, 'military', `${countryName(c)} desmoviliza el ${u.name}.`, [c]);
  return ok(`${u.name} desmovilizado.${home ? ' Su equipo vuelve a las reservas.' : ' Su equipo se pierde fuera del territorio propio.'}`);
}

/** Activa o pausa la reposición automática de efectivos y equipo (MIL-019 B, 038 B). */
export function setAutoReplenish(state: GameState, c: CountryId, enabled: boolean): ActionResult {
  state.countries[c].autoReplenish = enabled;
  return ok(enabled ? 'Reposición automática activada.' : 'Reposición automática en pausa.');
}

/** Horas de juego de un tramo entre regiones vecinas (con combustible suficiente). Única fuente de la duración de las marchas. */
export function travelHours(state: GameState, owner: CountryId, from: string, to: string): number {
  const hostile = state.regions[to].controller !== owner && !sameSide(state, owner, state.regions[to].controller);
  return distance(from, to) / (BASE_SPEED * LAND_SPEED_MULTIPLIER * (hostile ? HOSTILE_SPEED_FACTOR : 1));
}

/** Ruta más rápida (Dijkstra) por regiones transitables. Devuelve la lista sin el origen. */
export function findPath(state: GameState, owner: CountryId, from: string, to: string, assumeWarWith?: CountryId): string[] | null {
  if (from === to) return [];
  if (!canEnter(state, owner, to, assumeWarWith)) return null;
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
      if (done.has(n) || !canEnter(state, owner, n, assumeWarWith)) continue;
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

/** Región amiga vecina más cercana sin enemigos, o null si el batallón está rodeado. */
function retreatTarget(state: GameState, u: Unit): string | null {
  const options = REGIONS[u.regionId].neighbors.filter((n) => {
    const ctrl = state.regions[n].controller;
    if (!(ctrl === u.owner || sameSide(state, u.owner, ctrl))) return false;
    return !unitsIn(state, n).some((o) => atWar(state, o.owner, u.owner));
  });
  if (!options.length) return null;
  options.sort((a, b) => distance(u.regionId, a) - distance(u.regionId, b));
  return options[0];
}

function startRetreat(state: GameState, u: Unit, to: string, why: string): void {
  u.path = [to];
  u.destination = to;
  u.progress = 0;
  u.status = 'retreating';
  log(state, 'military', `El ${u.name} de ${countryName(u.owner)} se retira hacia ${REGIONS[to].name} (${why}).`, [u.owner]);
}

/**
 * Retirada AUTOMÁTICA por pérdidas graves (MIL-041 B): hacia la región amiga
 * vecina más cercana; si está rodeado, se rinde y pierde su equipo.
 */
export function retreat(state: GameState, u: Unit): void {
  const to = retreatTarget(state, u);
  if (!to) {
    log(state, 'military', `El ${u.name} de ${countryName(u.owner)} queda rodeado y se rinde en ${REGIONS[u.regionId].name}.`, [u.owner]);
    state.countries[u.owner].casualties += u.men;
    loseAllEquipment(state, u);
    delete state.units[u.id];
    return;
  }
  startRetreat(state, u, to, 'pérdidas graves');
}

/** Retirada MANUAL ordenada por el jugador o la IA (MIL-041 B). No rinde al batallón si está rodeado. */
export function orderRetreat(state: GameState, c: CountryId, unitId: string): ActionResult {
  const u = state.units[unitId];
  if (!u || u.owner !== c) return fail('Batallón no válido.');
  if (u.status === 'retreating') return fail(`${u.name} ya está en retirada.`);
  const enemiesHere = unitsIn(state, u.regionId).some((o) => o.status !== 'retreating' && atWar(state, o.owner, c));
  if (u.status !== 'combat' && !enemiesHere) return fail(`${u.name} no está en combate.`);
  const to = retreatTarget(state, u);
  if (!to) return fail(`${u.name} está rodeado: no hay ruta de retirada.`);
  startRetreat(state, u, to, 'orden de retirada');
  return ok(`${u.name} se retira hacia ${REGIONS[to].name}.`);
}

/**
 * Ataque directo sin declaración previa (MIL-082 B): inicia la guerra contra el
 * controlador de la región destino, con consecuencias diplomáticas mayores, y
 * pone en marcha los batallones. Mismas reglas para el jugador y la IA.
 */
export function directAttack(state: GameState, c: CountryId, unitIds: string[], target: string): ActionResult {
  const region = state.regions[target];
  if (!region) return fail('Región desconocida.');
  const enemy = region.controller;
  if (enemy === c) return fail('Esa región ya es tuya.');
  if (atWar(state, c, enemy)) return fail(`Ya estás en guerra con ${countryName(enemy)}: usa una orden de marcha.`);
  if (sameSide(state, c, enemy)) return fail(`${countryName(enemy)} es tu aliado en una guerra en curso.`);
  if (inTruce(state, c, enemy)) return fail('Hay una tregua vigente tras el último tratado de paz.');
  const units = unitIds.map((id) => state.units[id]).filter((u): u is Unit => !!u && u.owner === c && u.status !== 'retreating');
  const routes = units.map((u) => ({ u, path: findPath(state, c, u.regionId, target, enemy) })).filter((x) => x.path && x.path.length);
  if (!routes.length) return fail(`Ningún batallón seleccionado puede llegar a ${REGIONS[target].name}.`);
  const war = declareWar(state, c, enemy, { surprise: true });
  if (!war.ok) return war;
  for (const { u } of routes) moveUnit(state, c, u.id, target);
  return ok(`Ataque directo contra ${countryName(enemy)}: ${routes.length} batallón(es) hacia ${REGIONS[target].name}. Empieza la guerra.`);
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
    // Velocidad: reglas de desplazamiento (distancia, territorio hostil) y combustible; sin organización ni moral.
    u.progress += marchSpeedFactor(u) / hours;
    u.fuel = Math.max(0, u.fuel - SUPPLY.fuelPerMarchHour);
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

/** Desgaste diario por falta de abastecimiento presupuestario (MIL-138 B). Sin moral ni organización. */
export function dailyMilitary(state: GameState): void {
  for (const u of Object.values(state.units)) {
    const c = state.countries[u.owner];
    const supply = Math.min(c.supplyRatio, 1.2);
    if (supply < 0.6) {
      const loss = Math.round(u.men * 0.003 * (0.6 - supply) / 0.6 * 3);
      u.men -= loss;
      c.casualties += loss;
      if (u.men < 150) {
        log(state, 'military', `El ${u.name} de ${countryName(u.owner)} se disuelve por falta de abastecimiento.`, [u.owner]);
        if (state.regions[u.regionId].controller === u.owner) returnToInventory(state, u);
        else loseAllEquipment(state, u);
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

/**
 * Horas que faltan para que el batallón llegue a su destino (MIL-033).
 * Reproduce hora a hora las mismas reglas que el movimiento real: avance según
 * el combustible, consumo de combustible al marchar y reabastecimiento diario,
 * incluida la pérdida del avance sobrante al cambiar de etapa. Así la estimación
 * coincide con la llegada real si nada interrumpe la marcha (combate, cambios de
 * control o de presupuesto).
 */
export function etaHours(state: GameState, u: Unit): number {
  if (!u.path.length) return 0;
  const budget = Math.max(0, Math.min(1, state.countries[u.owner].supplyRatio));
  let fuel = u.fuel, progress = u.progress, hour = state.hour, from = u.regionId, leg = 0, n = 0;
  while (leg < u.path.length && n < 24 * 365) {
    hour++; n++;
    const to = u.path[leg];
    progress += speedForFuel(fuel) / travelHours(state, u.owner, from, to);
    fuel = Math.max(0, fuel - SUPPLY.fuelPerMarchHour);
    if (progress >= 1) { from = to; leg++; progress = 0; }
    if (hour % 24 === 0 && u.status !== 'combat') fuel = Math.min(1, fuel + SUPPLY.dailyResupply * budget);
  }
  return n;
}
