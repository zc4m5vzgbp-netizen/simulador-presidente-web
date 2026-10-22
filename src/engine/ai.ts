/**
 * Inteligencia artificial basada en reglas y prioridades.
 * Cada país no controlado por el jugador decide una vez al día (a una hora
 * propia) y revisa presupuesto, guerra y paz una vez al mes.
 * Toda decisión se ejecuta mediante `perform`, igual que el jugador.
 */
import type { CountryId, GameState, Unit } from './types';
import { monthIndex, rand } from './core';
import { perform, type Action } from './actions';
import { annualFlows } from './economy';
import { countryPower, findPath, recruitCost, unitPower, unitsIn, unitsOf } from './military';
import { atWar, inTruce, sameSide, warAssessment, warBetween, warsOf } from './war';
import { getRelation, hasTrade, tradeCount } from './diplomacy';
import { REGIONS, capitalOf, distance, neighborCountries } from './world';
import { COUNTRY_IDS } from '../data/regionDefs';

const DAY = 24;

/** Hora del día en la que decide cada país (escalonado para repartir la carga). */
export function aiHourOf(c: CountryId): number {
  return (COUNTRY_IDS.indexOf(c) * 2) % 24;
}

function act(state: GameState, c: CountryId, action: Action): boolean {
  const res = perform(state, c, action);
  if (res.ok) {
    state.ai[c].decisions += 1;
    state.ai[c].lastActionHour = state.hour;
  }
  return res.ok;
}

export function hourlyAI(state: GameState): void {
  const h = state.hour % DAY;
  for (const c of COUNTRY_IDS) {
    if (c === state.player || state.countries[c].eliminated) continue;
    if (aiHourOf(c) === h) runCountryAI(state, c);
  }
}

export function runCountryAI(state: GameState, c: CountryId): void {
  const mem = state.ai[c];
  const month = monthIndex(state.hour);
  if (mem.lastWarCheckMonth !== month) {
    mem.lastWarCheckMonth = month;
    manageBudget(state, c);
    considerPeace(state, c);
    considerWar(state, c);
  }
  manageRecruitment(state, c);
  manageArmy(state, c);
  if (rand(state) < 0.1) manageDiplomacy(state, c);
}

// ---------------- Presupuesto ----------------

function isThreatened(state: GameState, c: CountryId): boolean {
  if (warsOf(state, c).length) return true;
  const my = countryPower(state, c);
  return neighborCountries(c).some((n) => getRelation(state, c, n) < -30 && countryPower(state, n) > my * 1.2);
}

function manageBudget(state: GameState, c: CountryId): void {
  const country = state.countries[c];
  const p = { ...country.policy };
  const b = country.basePolicy;
  const f = annualFlows(state, c);
  const deficitPct = country.gdp > 0 ? (-f.balance / country.gdp) * 100 : 0;
  const debtRatio = country.gdp > 0 ? country.debt / country.gdp : 2;

  if (deficitPct > 1.5 && debtRatio > 0.6) {
    p.taxRate = Math.min(b.taxRate + 6, p.taxRate + 0.5);
    p.publicSpending = Math.max(b.publicSpending - 4, p.publicSpending - 0.3);
    p.investment = Math.max(b.investment - 1.5, p.investment - 0.2);
  } else if (deficitPct < -1) {
    p.investment = Math.min(b.investment + 3, p.investment + 0.3);
  }
  if (country.stability < 35) {
    p.publicSpending = Math.min(b.publicSpending + 5, p.publicSpending + 0.5);
    p.taxRate = Math.max(b.taxRate - 3, p.taxRate - 0.3);
  }
  const atWarNow = warsOf(state, c).length > 0;
  const milTarget = atWarNow ? Math.min(6, Math.max(b.militaryBudget * 2, b.militaryBudget + 1.5))
    : isThreatened(state, c) ? b.militaryBudget * 1.4 : b.militaryBudget;
  if (Math.abs(p.militaryBudget - milTarget) > 0.05) {
    p.militaryBudget += Math.sign(milTarget - p.militaryBudget) * Math.min(0.4, Math.abs(milTarget - p.militaryBudget));
  }
  const changed = (Object.keys(p) as (keyof typeof p)[]).some((k) => Math.abs(p[k] - country.policy[k]) > 0.01);
  if (changed) act(state, c, { type: 'setPolicy', patch: p });

  // Amortizar deuda si sobran muchas reservas
  if (!atWarNow && country.reserves > country.gdp * 0.25 && debtRatio > 0.3) {
    act(state, c, { type: 'payDebt', amount: country.reserves - country.gdp * 0.2 });
  }
}

// ---------------- Reclutamiento ----------------

function manageRecruitment(state: GameState, c: CountryId): void {
  const country = state.countries[c];
  const mem = state.ai[c];
  const units = unitsOf(state, c);
  const threatened = isThreatened(state, c);
  if (!threatened && country.supplyRatio < 0.7 && units.length > 1) {
    const weakest = units.slice().sort((a, b) => unitPower(state, a) - unitPower(state, b))[0];
    if (weakest.status === 'idle') act(state, c, { type: 'disband', unitId: weakest.id });
    return;
  }
  if (state.hour - mem.lastRecruitHour < 10 * DAY) return;
  const cost = recruitCost(state, c);
  // Solo reclutar si, tras hacerlo, el ejército sigue bien abastecido.
  const supplyAfter = country.supplyRatio * units.length / (units.length + 1);
  const wantMore = threatened ? supplyAfter >= 0.95 : supplyAfter >= 1.2;
  if (!wantMore || country.reserves < cost * 3) return;
  const cap = capitalOf(c);
  const region = state.regions[cap].controller === c ? cap
    : Object.values(state.regions).find((r) => r.owner === c && r.controller === c)?.id;
  if (!region) return;
  if (act(state, c, { type: 'recruit', regionId: region })) mem.lastRecruitHour = state.hour;
}

// ---------------- Ejército ----------------

function available(state: GameState, c: CountryId): Unit[] {
  return unitsOf(state, c).filter((u) => u.status === 'idle' && u.path.length === 0 && u.org > 35);
}

function enemyPowerIn(state: GameState, c: CountryId, regionId: string): number {
  return unitsIn(state, regionId).filter((u) => atWar(state, c, u.owner)).reduce((s, u) => s + unitPower(state, u), 0);
}

function manageArmy(state: GameState, c: CountryId): void {
  if (warsOf(state, c).length) manageWarArmy(state, c);
  else if (state.hour % (3 * DAY) === (aiHourOf(c) % DAY)) managePeaceArmy(state, c);
}

function manageWarArmy(state: GameState, c: CountryId): void {
  let pool = available(state, c);
  if (!pool.length) return;
  const cap = capitalOf(c);

  // 1) Mantener guarnición en la capital si el enemigo está cerca.
  const capThreat = state.regions[cap].controller === c && REGIONS[cap].neighbors.some((n) => enemyPowerIn(state, c, n) > 0);
  if (capThreat && !unitsIn(state, cap).some((u) => u.owner === c)) {
    const nearest = pool.slice().sort((a, b) => distance(a.regionId, cap) - distance(b.regionId, cap))[0];
    if (nearest && act(state, c, { type: 'move', unitId: nearest.id, target: cap })) pool = pool.filter((u) => u !== nearest);
  }
  const garrisonCap = pool.find((u) => u.regionId === cap);
  if (capThreat && garrisonCap) pool = pool.filter((u) => u !== garrisonCap);

  // 2) Defender regiones propias atacadas.
  const attacked = Object.values(state.regions)
    .filter((r) => r.controller === c && enemyPowerIn(state, c, r.id) > 0)
    .map((r) => r.id);
  for (const target of attacked) {
    const need = enemyPowerIn(state, c, target) * 1.2;
    let sent = unitsIn(state, target).filter((u) => u.owner === c).reduce((s, u) => s + unitPower(state, u), 0);
    for (const u of pool.slice().sort((a, b) => distance(a.regionId, target) - distance(b.regionId, target))) {
      if (sent >= need) break;
      if (distance(u.regionId, target) > 260) continue;
      if (act(state, c, { type: 'move', unitId: u.id, target })) { sent += unitPower(state, u); pool = pool.filter((x) => x !== u); }
    }
  }
  if (!pool.length) return;

  // 3) Ofensiva: elegir la región enemiga más rentable y concentrar fuerzas.
  const candidates = Object.values(state.regions).filter((r) => {
    if (!atWar(state, c, r.controller)) return false;
    return REGIONS[r.id].neighbors.some((n) => {
      const ctrl = state.regions[n].controller;
      return ctrl === c || sameSide(state, c, ctrl);
    });
  });
  if (!candidates.length) return;
  const scored = candidates.map((r) => {
    const defense = enemyPowerIn(state, c, r.id) + REGIONS[r.id].neighbors.reduce((s, n) => s + enemyPowerIn(state, c, n) * 0.3, 0);
    const value = r.gdp + (REGIONS[r.id].capital ? state.countries[r.owner].gdp * 0.3 : 0) + (r.owner === c ? r.gdp * 2 : 0);
    return { id: r.id, defense, score: value / (defense + 2) };
  }).sort((a, b) => b.score - a.score);
  const target = scored[0];
  state.ai[c].target = target.id;
  const myPool = pool.filter((u) => findPath(state, c, u.regionId, target.id));
  const poolPower = myPool.reduce((s, u) => s + unitPower(state, u), 0);
  if (poolPower < target.defense * 1.3 + 1) return; // esperar refuerzos
  let sent = 0;
  for (const u of myPool.sort((a, b) => distance(a.regionId, target.id) - distance(b.regionId, target.id))) {
    if (sent >= target.defense * 1.6 + 4) break;
    if (act(state, c, { type: 'move', unitId: u.id, target: target.id })) sent += unitPower(state, u);
  }
}

function managePeaceArmy(state: GameState, c: CountryId): void {
  // Amenaza por región fronteriza: vecinos hostiles y su fuerza.
  const own = Object.values(state.regions).filter((r) => r.controller === c).map((r) => r.id);
  const threat: Record<string, number> = {};
  for (const id of own) {
    let t = 0;
    for (const n of REGIONS[id].neighbors) {
      const ctrl = state.regions[n].controller;
      if (ctrl === c) continue;
      const rel = getRelation(state, c, ctrl);
      if (rel < 10) t += (10 - rel) * (1 + countryPower(state, ctrl) / 20);
    }
    threat[id] = t;
  }
  const pool = available(state, c);
  const counts: Record<string, number> = {};
  for (const u of unitsOf(state, c)) counts[u.regionId] = (counts[u.regionId] ?? 0) + 1;
  const desired = own.filter((id) => threat[id] > 0).sort((a, b) => threat[b] - threat[a]);
  if (!desired.length) return;
  // Mover una unidad desde la región más sobrada hacia la más amenazada sin tropas.
  const target = desired.find((id) => !counts[id]) ?? null;
  if (!target) return;
  const donors = pool.filter((u) => (counts[u.regionId] ?? 0) > 1 || threat[u.regionId] === 0 || threat[u.regionId] < threat[target] * 0.3)
    .filter((u) => !(REGIONS[u.regionId].capital && counts[u.regionId] === 1));
  const donor = donors.sort((a, b) => distance(a.regionId, target) - distance(b.regionId, target))[0];
  if (donor) act(state, c, { type: 'move', unitId: donor.id, target });
}

// ---------------- Diplomacia ----------------

function manageDiplomacy(state: GameState, c: CountryId): void {
  const country = state.countries[c];
  const others = COUNTRY_IDS.filter((o) => o !== c && !state.countries[o].eliminated);
  const neighbors = neighborCountries(c).filter((n) => !state.countries[n].eliminated);

  // Pedir apoyo militar si va perdiendo una guerra.
  for (const war of warsOf(state, c)) {
    const a = warAssessment(state, c);
    if (a.powerRatio < 1.1) {
      const friend = others
        .filter((o) => getRelation(state, c, o) >= 50 && !warsOf(state, o).length)
        .sort((x, y) => countryPower(state, y) - countryPower(state, x))[0];
      if (friend) { act(state, c, { type: 'propose', target: friend, kind: 'military_support', warId: war.id }); return; }
    }
  }

  const roll = rand(state);
  if (roll < 0.45) {
    // Mejorar relaciones con un vecino o socio relevante
    const pick = neighbors
      .filter((n) => !atWar(state, c, n) && getRelation(state, c, n) > -40 && getRelation(state, c, n) < 70)
      .sort((a, b) => state.countries[b].gdp - state.countries[a].gdp)[Math.floor(rand(state) * 2)];
    if (pick) act(state, c, { type: 'improveRelations', target: pick });
  } else if (roll < 0.75) {
    if (tradeCount(state, c) >= 3) return;
    const partner = others
      .filter((o) => !hasTrade(state, c, o) && !atWar(state, c, o) && getRelation(state, c, o) >= 20)
      .sort((a, b) => getRelation(state, c, b) - getRelation(state, c, a))[0];
    if (partner) act(state, c, { type: 'propose', target: partner, kind: 'trade' });
  } else if (roll < 0.88) {
    const rival = neighbors.filter((n) => getRelation(state, c, n) < -35).sort((a, b) => getRelation(state, c, a) - getRelation(state, c, b))[0];
    if (rival && rand(state) < 0.5) act(state, c, { type: 'worsenRelations', target: rival });
  } else {
    // Ayuda económica a un aliado en crisis
    if (country.reserves > country.gdp * 0.12) {
      const needy = others.find((o) => getRelation(state, c, o) > 45 && state.countries[o].stability < 30 && !atWar(state, c, o));
      if (needy) act(state, c, { type: 'sendAid', target: needy, amount: Math.round(country.gdp * 0.005 * 100) / 100 });
    }
  }
}

// ---------------- Guerra y paz ----------------

function considerWar(state: GameState, c: CountryId): void {
  const me = state.countries[c];
  if (warsOf(state, c).length || me.stability < 38) return;
  const myPower = countryPower(state, c);
  for (const n of neighborCountries(c)) {
    if (state.countries[n].eliminated || inTruce(state, c, n) || atWar(state, c, n)) continue;
    if (getRelation(state, c, n) >= -50) continue;
    const friends = COUNTRY_IDS.filter((o) => o !== n && o !== c && getRelation(state, n, o) >= 50);
    const theirPower = countryPower(state, n) + friends.reduce((s, o) => s + countryPower(state, o) * 0.5, 0);
    if (myPower < theirPower * 1.8) continue;
    if (rand(state) < state.ai[c].aggression * 0.3) {
      act(state, c, { type: 'declareWar', target: n });
      return;
    }
  }
}

function considerPeace(state: GameState, c: CountryId): void {
  for (const war of warsOf(state, c)) {
    const enemyLeader = war.attackers.includes(c) ? war.defenders[0] : war.attackers[0];
    if (!warBetween(state, c, enemyLeader)) continue;
    const a = warAssessment(state, c);
    const days = (state.hour - war.startHour) / DAY;
    const losing = (a.score < -0.08 && (a.powerRatio < 0.9 || a.capitalLost)) || a.stability < 25;
    if (losing) {
      const terms = monthIndex(state.hour) % 2 === 0 ? 'white' : 'status_quo';
      act(state, c, { type: 'propose', target: enemyLeader, kind: 'peace', terms });
    } else if (a.score > 0.12 && days > 30) {
      act(state, c, { type: 'propose', target: enemyLeader, kind: 'peace', terms: 'status_quo' });
    } else if (days > 240 && Math.abs(a.score) < 0.05) {
      act(state, c, { type: 'propose', target: enemyLeader, kind: 'peace', terms: 'white' });
    }
  }
}
