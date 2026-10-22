/** Guerra: declaraciones, combate, ocupación y paz. */
import type { CountryId, GameState, PeaceTerms, Unit, War, WarSide } from './types';
import { clamp, fail, log, newId, ok, pairKey, rand, type ActionResult } from './core';
import { REGIONS, countryName, distance } from './world';
import { setController, transferOwnership } from './territory';
import { retreat, unitPower, unitsIn, countryPower } from './military';
import { changeRelation, getRelation } from './diplomacy';

export const TRUCE_HOURS = 365 * 24;
/** Coeficiente de daño: bajas por hora por punto de fuerza. */
const DAMAGE = 1.2;
const DEFENDER_BONUS = 1.3;
const OCCUPATION_HOURS = 24;

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

export function declareWar(state: GameState, from: CountryId, to: CountryId): ActionResult {
  if (from === to) return fail('No puedes declararte la guerra a ti mismo.');
  const a = state.countries[from], b = state.countries[to];
  if (a.eliminated || b.eliminated) return fail('País eliminado.');
  if (atWar(state, from, to)) return fail('Ya estáis en guerra.');
  if (sameSide(state, from, to)) return fail('Sois aliados en una guerra en curso.');
  if (inTruce(state, from, to)) return fail('Hay una tregua vigente tras el último tratado de paz.');
  const rel = getRelation(state, from, to);
  const war: War = {
    id: newId(state, 'w'),
    name: `Guerra ${countryName(from)}–${countryName(to)}`,
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

/** Combate horario en cada región con unidades enemigas presentes. */
export function hourlyCombat(state: GameState): void {
  const byRegion: Record<string, Unit[]> = {};
  for (const u of Object.values(state.units)) {
    if (u.status === 'training' || u.status === 'retreating') continue;
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
      state.battles[regionId] = { regionId, startHour: state.hour, lastHour: state.hour, losses: {}, participants };
      log(state, 'war', `Comienza la batalla de ${REGIONS[regionId].name}.`, participants);
    }
    const b = state.battles[regionId];
    b.lastHour = state.hour;
    const controller = state.regions[regionId].controller;
    const damage = new Map<string, number>();
    for (const u of engaged) {
      const enemies = engaged.filter((o) => atWar(state, u.owner, o.owner));
      const totalMen = enemies.reduce((s, e) => s + e.men, 0);
      const p = unitPower(state, u);
      for (const e of enemies) {
        const defending = e.owner === controller || sameSide(state, e.owner, controller);
        const dmg = (p * DAMAGE * (e.men / totalMen) * (0.85 + 0.3 * rand(state))) / (defending ? DEFENDER_BONUS : 1);
        damage.set(e.id, (damage.get(e.id) ?? 0) + dmg);
      }
    }
    for (const u of engaged) {
      const dmg = damage.get(u.id) ?? 0;
      const loss = Math.min(u.men, Math.round(dmg));
      u.org = clamp(u.org - ((loss / Math.max(u.men, 1)) * 300 + 1), 0, 100);
      u.morale = clamp(u.morale - 0.3, 0, 100);
      u.men -= loss;
      u.status = 'combat';
      b.losses[u.owner] = (b.losses[u.owner] ?? 0) + loss;
      if (!b.participants.includes(u.owner)) b.participants.push(u.owner);
      state.countries[u.owner].casualties += loss;
      for (const w of warsOf(state, u.owner)) w.casualties[u.owner] = (w.casualties[u.owner] ?? 0) + loss;
    }
    for (const u of engaged) {
      if (!state.units[u.id]) continue;
      if (u.men < 150) {
        log(state, 'military', `El ${u.name} de ${countryName(u.owner)} ha sido destruido en ${REGIONS[regionId].name}.`, [u.owner]);
        state.countries[u.owner].casualties += u.men;
        delete state.units[u.id];
      } else if (u.org <= 8) {
        retreat(state, u);
      }
    }
  }
}

function endBattle(state: GameState, regionId: string, remaining: Unit[]): void {
  const b = state.battles[regionId];
  delete state.battles[regionId];
  const winners = [...new Set(remaining.map((u) => u.owner))].filter((o) => b.participants.includes(o));
  const losses = Object.entries(b.losses).map(([c, n]) => `${countryName(c as CountryId)} ${n}`).join(', ');
  const verdict = winners.length ? `victoria de ${winners.map(countryName).join(' y ')}` : 'sin vencedor claro';
  log(state, 'war', `Termina la batalla de ${REGIONS[regionId].name}: ${verdict}. Bajas: ${losses}.`, b.participants);
  for (const u of remaining) {
    if (u.status === 'combat') u.status = u.path.length ? 'moving' : 'idle';
  }
}

/** Ocupación: una región sin defensores y con tropas enemigas estacionadas cambia de control. */
export function hourlyOccupation(state: GameState): void {
  for (const r of Object.values(state.regions)) {
    const units = unitsIn(state, r.id).filter((u) => u.status !== 'retreating');
    const stationed = units.filter((u) => u.status !== 'training' && u.path.length === 0);
    const hostile = stationed.filter((u) => atWar(state, u.owner, r.controller));
    const defenders = units.filter((u) => u.status !== 'training' && (u.owner === r.controller || sameSide(state, u.owner, r.controller)));
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
    if (r.occupationHours >= need) {
      // Las unidades en entrenamiento del antiguo controlador son capturadas.
      for (const u of units) {
        if (u.status === 'training' && atWar(state, u.owner, taker)) {
          log(state, 'military', `El ${u.name} de ${countryName(u.owner)} es capturado durante su entrenamiento.`, [u.owner]);
          delete state.units[u.id];
        }
      }
      setController(state, r.id, taker);
    }
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
    if (u.status !== 'training') u.status = 'idle';
  }
}
