/** Guerra: declaraciones, combate, ocupación y paz. */
import type { Battle, BattleCountryTally, CountryId, GameState, PeaceTerms, Unit, War, WarSide } from './types';
import { clamp, fail, log, newId, ok, pairKey, rand, type ActionResult } from './core';
import { REGIONS, countryName, distance } from './world';
import { setController, transferOwnership } from './territory';
import { retreat, unitPower, unitsIn, countryPower } from './military';
import { changeRelation, getRelation } from './diplomacy';
import { applyDamage, combatPower } from './combat';
import { loseAllEquipment, modelOf, operationalVehicles } from './equipment';
import { COMBAT, DIRECT_ATTACK, SUPPLY } from '../data/military';

export const TRUCE_HOURS = 365 * 24;
const OCCUPATION_HOURS = 24;
/**
 * F2-001 A: se ELIMINA la bonificación defensiva. Hasta la Fase 1 el daño
 * recibido por el bando que controlaba la región se DIVIDÍA entre 1,3: eso es
 * recibir el 76,9 % del daño (−23,1 %), no un −30 %; y multiplicar ×1,3 el daño
 * del defensor habría sido otra regla distinta. Ya no existe ninguna de las dos.
 */
const TIMELINE_MAX = 240;
const REPORTS_MAX = 20;

export function sideOf(war: War, c: CountryId): WarSide | null {
  if (war.attackers.includes(c)) return 'attackers';
  if (war.defenders.includes(c)) return 'defenders';
  return null;
}

export function warsOf(state: GameState, c: CountryId): War[] {
  return state.wars.filter((w) => sideOf(w, c));
}

export function atWar(state: GameState, a: CountryId, b: CountryId): boolean {
  if (a === b) return false;
  return state.wars.some((w) => {
    const sa = sideOf(w, a), sb = sideOf(w, b);
    return sa && sb && sa !== sb;
  });
}

export function sameSide(state: GameState, a: CountryId, b: CountryId): boolean {
  if (a === b) return false;
  return state.wars.some((w) => {
    const sa = sideOf(w, a);
    return sa && sa === sideOf(w, b);
  });
}

export function enemiesOf(state: GameState, c: CountryId): CountryId[] {
  const set = new Set<CountryId>();
  for (const w of warsOf(state, c)) {
    const side = sideOf(w, c);
    for (const e of side === 'attackers' ? w.defenders : w.attackers) set.add(e);
  }
  return [...set];
}

export function warBetween(state: GameState, a: CountryId, b: CountryId): War | undefined {
  return state.wars.find((w) => {
    const sa = sideOf(w, a), sb = sideOf(w, b);
    return sa && sb && sa !== sb;
  });
}

export function inTruce(state: GameState, a: CountryId, b: CountryId): boolean {
  return (state.truces[pairKey(a, b)] ?? -1) > state.hour;
}

export function declareWar(state: GameState, from: CountryId, to: CountryId, opts: { surprise?: boolean } = {}): ActionResult {
  if (from === to) return fail('No puedes declararte la guerra a ti mismo.');
  const a = state.countries[from], b = state.countries[to];
  if (a.eliminated || b.eliminated) return fail('País eliminado.');
  if (atWar(state, from, to)) return fail('Ya estáis en guerra.');
  if (sameSide(state, from, to)) return fail('Sois aliados en una guerra en curso.');
  if (inTruce(state, from, to)) return fail('Hay una tregua vigente tras el último tratado de paz.');
  const rel = getRelation(state, from, to);
  const war: War = {
    id: newId(state, 'w'),
    name: opts.surprise ? `Ataque de ${countryName(from)} contra ${countryName(to)}` : `Guerra ${countryName(from)}–${countryName(to)}`,
    attackers: [from],
    defenders: [to],
    startHour: state.hour,
    casualties: {},
  };
  state.wars.push(war);
  // Consecuencias diplomáticas y políticas
  changeRelation(state, from, to, -100);
  for (const c of Object.keys(state.countries) as CountryId[]) {
    if (c === from || c === to) continue;
    changeRelation(state, c, from, getRelation(state, c, to) > 30 ? -15 : -6);
  }
  state.trades = state.trades.filter((t) => pairKey(t.a, t.b) !== pairKey(from, to));
  if (rel > -40) a.stability = clamp(a.stability - 6, 0, 100);
  b.stability = clamp(b.stability + 3, 0, 100);
  if (opts.surprise) {
    // Atacar sin declaración: el resto de países lo castiga más y el país atacante lo acusa.
    for (const c of Object.keys(state.countries) as CountryId[]) if (c !== from && c !== to) changeRelation(state, c, from, DIRECT_ATTACK.thirdPartyRelation);
    a.stability = clamp(a.stability + DIRECT_ATTACK.attackerStability, 0, 100);
    log(state, 'war', `${countryName(from)} ataca a ${countryName(to)} sin declaración de guerra.`, [from, to]);
    return ok(`Has atacado a ${countryName(to)} sin declaración de guerra.`);
  }
  log(state, 'war', `${countryName(from)} declara la guerra a ${countryName(to)}.`, [from, to]);
  return ok(`Has declarado la guerra a ${countryName(to)}.`);
}

export function joinWar(state: GameState, joiner: CountryId, warId: string, side: WarSide): ActionResult {
  const war = state.wars.find((w) => w.id === warId);
  if (!war) return fail('La guerra ya terminó.');
  if (sideOf(war, joiner)) return fail('Ya participa en esa guerra.');
  const enemies = side === 'attackers' ? war.defenders : war.attackers;
  if (enemies.some((e) => inTruce(state, joiner, e))) return fail('Tiene una tregua con un beligerante.');
  war[side].push(joiner);
  for (const e of enemies) changeRelation(state, joiner, e, -60);
  state.trades = state.trades.filter((t) => !(enemies.includes(t.a) && t.b === joiner) && !(enemies.includes(t.b) && t.a === joiner));
  log(state, 'war', `${countryName(joiner)} entra en la ${war.name} junto a ${countryName(war[side][0])}.`, [joiner, ...war.attackers, ...war.defenders]);
  return ok(`${countryName(joiner)} se une a la guerra.`);
}

/** Puntuación de guerra de c: territorio ganado menos perdido (relativo a su PIB) y relación de fuerzas. */
export function warAssessment(state: GameState, c: CountryId) {
  const enemies = enemiesOf(state, c);
  let lost = 0, gained = 0, own = 0;
  for (const r of Object.values(state.regions)) {
    if (r.owner === c) {
      own += r.gdp;
      if (r.controller !== c) lost += r.gdp;
    } else if (enemies.includes(r.owner) && (r.controller === c || sameSide(state, c, r.controller))) gained += r.gdp;
  }
  const allies = new Set<CountryId>([c]);
  for (const w of warsOf(state, c)) for (const x of w[sideOf(w, c)!]) allies.add(x);
  const myPower = [...allies].reduce((s, x) => s + countryPower(state, x), 0);
  const enemyPower = enemies.reduce((s, x) => s + countryPower(state, x), 0);
  const score = own > 0 ? (gained - lost) / own : -1;
  const capitalLost = Object.values(state.regions).some((r) => r.owner === c && REGIONS[r.id].capital && r.controller !== c);
  return { score, powerRatio: enemyPower > 0 ? myPower / enemyPower : 10, capitalLost, lostFraction: own ? lost / own : 1, stability: state.countries[c].stability };
}

function tallyOf(b: Battle, c: CountryId): BattleCountryTally {
  return (b.tally[c] ??= { damaged: {}, destroyed: {}, fuel: 0, ammo: 0 });
}

/**
 * Combate terrestre por intervalos de una hora (MIL-040 B, 132 B) en cada región
 * con batallones enemigos. Cada batallón reparte su potencia entre los enemigos
 * presentes en proporción a sus efectivos; cada uno conserva identidad, equipo y
 * pérdidas propias (MIL-136 B). Bajas humanas y materiales separadas (MIL-037 B).
 */
export function hourlyCombat(state: GameState): void {
  const byRegion: Record<string, Unit[]> = {};
  for (const u of Object.values(state.units)) {
    if (u.status === 'retreating') continue;
    (byRegion[u.regionId] ??= []).push(u);
  }
  for (const regionId of Object.keys(state.regions)) {
    const units = byRegion[regionId] ?? [];
    const engaged = units.filter((u) => units.some((o) => atWar(state, u.owner, o.owner)));
    const battle = state.battles[regionId];
    if (!engaged.length) {
      if (battle) endBattle(state, regionId, units);
      continue;
    }
    if (!battle) {
      const participants = [...new Set(engaged.map((u) => u.owner))];
      state.battles[regionId] = {
        id: `${regionId}@${state.hour}`, regionId, startHour: state.hour, lastHour: state.hour,
        losses: {}, participants, entry: {}, tally: {}, timeline: [],
      };
      log(state, 'war', `Comienza la batalla de ${REGIONS[regionId].name}.`, participants);
    }
    const b = state.battles[regionId];
    b.lastHour = state.hour;
    for (const u of engaged) {
      b.entry[u.id] ??= { owner: u.owner, men: u.men, vehicles: operationalVehicles(u) };
      if (!b.participants.includes(u.owner)) b.participants.push(u.owner);
    }
    // 1) Daño infligido, con la potencia ANTES de las pérdidas de esta hora (simultáneo).
    const damage = new Map<string, number>();
    for (const u of engaged) {
      const enemies = engaged.filter((o) => atWar(state, u.owner, o.owner));
      const totalMen = enemies.reduce((sum, e) => sum + e.men, 0);
      const p = combatPower(state, u);
      for (const e of enemies) {
        const spread = 1 - COMBAT.damageSpread + 2 * COMBAT.damageSpread * rand(state);
        const dmg = p * COMBAT.damagePerPower * (e.men / Math.max(1, totalMen)) * spread;
        damage.set(e.id, (damage.get(e.id) ?? 0) + dmg);
      }
    }
    // 2) Consumo de munición y combustible.
    for (const u of engaged) {
      const t = tallyOf(b, u.owner);
      const ammo = Math.min(u.ammo, SUPPLY.ammoPerCombatHour), fuel = Math.min(u.fuel, SUPPLY.fuelPerCombatHour);
      u.ammo -= ammo; u.fuel -= fuel;
      t.ammo += ammo; t.fuel += fuel;
    }
    // 3) Pérdidas humanas y materiales.
    for (const u of engaged) {
      const res = applyDamage(state, u, damage.get(u.id) ?? 0);
      u.status = 'combat';
      const t = tallyOf(b, u.owner);
      for (const [cat, n] of Object.entries(res.damaged)) t.damaged[cat] = (t.damaged[cat] ?? 0) + (n ?? 0);
      for (const [cat, n] of Object.entries(res.destroyed)) t.destroyed[cat] = (t.destroyed[cat] ?? 0) + (n ?? 0);
      b.losses[u.owner] = (b.losses[u.owner] ?? 0) + res.men;
      state.countries[u.owner].casualties += res.men;
      for (const w of warsOf(state, u.owner)) w.casualties[u.owner] = (w.casualties[u.owner] ?? 0) + res.men;
    }
    // 4) Destrucción y retirada automática por pérdidas graves (sin moral ni organización).
    for (const u of engaged) {
      if (!state.units[u.id]) continue;
      if (u.men < COMBAT.destroyedBelowMen) {
        log(state, 'military', `El ${u.name} de ${countryName(u.owner)} ha sido destruido en ${REGIONS[regionId].name}.`, [u.owner]);
        state.countries[u.owner].casualties += u.men;
        const t = tallyOf(b, u.owner);
        for (const bag of [u.equipment, u.damaged]) for (const [id, n] of Object.entries(bag)) {
          const cat = modelOf(id).category;
          t.destroyed[cat] = (t.destroyed[cat] ?? 0) + n;
        }
        loseAllEquipment(state, u);
        delete state.units[u.id];
        continue;
      }
      const entry = b.entry[u.id];
      const menLoss = (entry.men - u.men) / Math.max(1, entry.men);
      const vehLoss = entry.vehicles >= COMBAT.retreatMinVehicles ? (entry.vehicles - operationalVehicles(u)) / entry.vehicles : 0;
      if (menLoss >= COMBAT.retreatMenLoss || vehLoss >= COMBAT.retreatVehicleLoss) retreat(state, u);
    }
    // 5) Evolución.
    const men: Partial<Record<CountryId, number>> = {};
    for (const u of engaged) if (state.units[u.id] && u.status !== 'retreating') men[u.owner] = (men[u.owner] ?? 0) + u.men;
    b.timeline.push({ hour: state.hour, men });
    if (b.timeline.length > TIMELINE_MAX) b.timeline = b.timeline.filter((_, i) => i % 2 === 0);
  }
}

function endBattle(state: GameState, regionId: string, remaining: Unit[]): void {
  const b = state.battles[regionId];
  delete state.battles[regionId];
  const winners = [...new Set(remaining.map((u) => u.owner))].filter((o) => b.participants.includes(o));
  const losses = Object.entries(b.losses).map(([c, n]) => `${countryName(c as CountryId)} ${n}`).join(', ');
  const material = Object.entries(b.tally).map(([c, t]) => {
    const sum = (o: Partial<Record<string, number>>) => Object.values(o).reduce<number>((x, y) => x + (y ?? 0), 0);
    const d = sum(t!.destroyed), g = sum(t!.damaged);
    return d || g ? `${countryName(c as CountryId)} ${d} destruidos y ${g} dañados` : '';
  }).filter(Boolean).join('; ');
  const verdict = winners.length ? `victoria de ${winners.map(countryName).join(' y ')}` : 'sin vencedor claro';
  log(state, 'war', `Termina la batalla de ${REGIONS[regionId].name}: ${verdict}. Bajas: ${losses}.${material ? ` Vehículos: ${material}.` : ''}`, b.participants);
  state.battleReports.push({ ...b, endHour: state.hour, winners });
  if (state.battleReports.length > REPORTS_MAX) state.battleReports.splice(0, state.battleReports.length - REPORTS_MAX);
  for (const u of remaining) {
    if (u.status === 'combat') u.status = u.path.length ? 'moving' : 'idle';
  }
}

/** Ocupación: una región sin defensores y con tropas enemigas estacionadas cambia de control. */
export function hourlyOccupation(state: GameState): void {
  for (const r of Object.values(state.regions)) {
    const units = unitsIn(state, r.id).filter((u) => u.status !== 'retreating');
    const stationed = units.filter((u) => u.path.length === 0);
    const hostile = stationed.filter((u) => atWar(state, u.owner, r.controller));
    const defenders = units.filter((u) => u.owner === r.controller || sameSide(state, u.owner, r.controller));
    if (!hostile.length || defenders.length) {
      r.occupationHours = 0;
      r.occupier = null;
      continue;
    }
    // ¿Quién toma el control? El propietario legal (o un aliado suyo que lo libera) tiene prioridad.
    let taker: CountryId;
    if (hostile.some((u) => u.owner === r.owner)) taker = r.owner;
    else if (hostile.some((u) => sameSide(state, u.owner, r.owner))) taker = r.owner;
    else taker = hostile.slice().sort((a, b) => unitPower(state, b) - unitPower(state, a))[0].owner;
    if (r.occupier !== taker) { r.occupier = taker; r.occupationHours = 0; }
    r.occupationHours += 1;
    const need = OCCUPATION_HOURS * (REGIONS[r.id].capital ? 2 : 1);
    if (r.occupationHours >= need) setController(state, r.id, taker);
  }
}

/** Aplica un tratado de paz entre a y b. Mismo mecanismo para jugador e IA. */
export function makePeace(state: GameState, a: CountryId, b: CountryId, terms: PeaceTerms): ActionResult {
  const war = warBetween(state, a, b);
  if (!war) return fail('No estáis en guerra.');
  const leaders = [war.attackers[0], war.defenders[0]];
  const pairs: [CountryId, CountryId][] = [];
  if (leaders.includes(a) && leaders.includes(b)) {
    for (const x of war.attackers) for (const y of war.defenders) pairs.push([x, y]);
    state.wars = state.wars.filter((w) => w !== war);
    log(state, 'war', `Fin de la ${war.name}.`, [...war.attackers, ...war.defenders]);
  } else {
    // Paz por separado: sale de la guerra el participante que no es líder.
    const leaving = leaders.includes(a) ? b : a;
    const side = sideOf(war, leaving)!;
    const enemies = side === 'attackers' ? war.defenders : war.attackers;
    for (const e of enemies) pairs.push([leaving, e]);
    war[side] = war[side].filter((x) => x !== leaving);
    log(state, 'war', `${countryName(leaving)} firma una paz por separado y abandona la ${war.name}.`, [leaving, ...enemies]);
  }
  for (const [x, y] of pairs) {
    for (const r of Object.values(state.regions)) {
      const between = (r.owner === x && r.controller === y) || (r.owner === y && r.controller === x);
      if (!between) continue;
      if (terms === 'white') setController(state, r.id, r.owner);
      else {
        log(state, 'war', `${REGIONS[r.id].name} pasa a ser territorio de ${countryName(r.controller)}.`, [r.owner, r.controller]);
        transferOwnership(state, r.id, r.controller);
      }
    }
    state.truces[pairKey(x, y)] = state.hour + TRUCE_HOURS;
    changeRelation(state, x, y, 15);
  }
  relocateStrandedUnits(state);
  const desc = terms === 'white' ? 'paz blanca (se devuelven los territorios ocupados)' : 'cada parte conserva lo que ocupa';
  log(state, 'war', `Tratado de paz entre ${countryName(a)} y ${countryName(b)}: ${desc}.`, [a, b]);
  return ok(`Paz firmada: ${desc}.`);
}

/** Tras la paz, los batallones en territorio ya no transitable vuelven a casa. */
export function relocateStrandedUnits(state: GameState): void {
  for (const u of Object.values(state.units)) {
    const ctrl = state.regions[u.regionId].controller;
    if (ctrl === u.owner || atWar(state, u.owner, ctrl) || sameSide(state, u.owner, ctrl)) {
      // Comprobar también que la ruta pendiente siga siendo válida
      continue;
    }
    const home = Object.values(state.regions)
      .filter((r) => r.controller === u.owner)
      .sort((p, q) => distance(u.regionId, p.id) - distance(u.regionId, q.id))[0];
    if (!home) { delete state.units[u.id]; continue; }
    u.regionId = home.id;
    u.path = []; u.destination = null; u.progress = 0;
    u.status = 'idle';
  }
}
