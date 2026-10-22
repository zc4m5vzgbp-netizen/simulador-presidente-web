/** Diplomacia: relaciones, ayuda, comercio, apoyo militar y propuestas. */
import type { CountryId, GameState, PeaceTerms, Proposal, ProposalKind } from './types';
import { clamp, fail, log, newId, ok, pairKey, type ActionResult } from './core';
import { countryName } from './world';
import { transferFunds } from './economy';
import { atWar, declareWar, inTruce, joinWar, makePeace, sideOf, warAssessment, warsOf, warBetween } from './war';

const DAY = 24;
export const MAX_TRADES = 4;

export function getRelation(state: GameState, a: CountryId, b: CountryId): number {
  if (a === b) return 100;
  return state.relations[a][b];
}

export function changeRelation(state: GameState, a: CountryId, b: CountryId, delta: number): void {
  if (a === b) return;
  const v = clamp(state.relations[a][b] + delta, -100, 100);
  state.relations[a][b] = v;
  state.relations[b][a] = v;
}

function cooldownLeft(state: GameState, key: string): number {
  return Math.max(0, (state.cooldowns[key] ?? 0) - state.hour);
}

function setCooldown(state: GameState, key: string, hours: number): void {
  state.cooldowns[key] = state.hour + hours;
}

export function diplomacyCost(state: GameState, c: CountryId): number {
  return Math.max(0.01, state.countries[c].gdp * 0.0002);
}

export function improveRelations(state: GameState, from: CountryId, to: CountryId): ActionResult {
  if (from === to) return fail('Acción no válida.');
  if (atWar(state, from, to)) return fail('Estáis en guerra: primero negocia la paz.');
  const key = `improve:${pairKey(from, to)}:${from}`;
  const left = cooldownLeft(state, key);
  if (left) return fail(`Misión diplomática reciente. Disponible en ${Math.ceil(left / DAY)} días.`);
  const cost = diplomacyCost(state, from);
  const c = state.countries[from];
  if (c.reserves < cost) return fail('Reservas insuficientes para la misión diplomática.');
  c.reserves -= cost;
  const rel = getRelation(state, from, to);
  const gain = rel > 50 ? 5 : 10;
  changeRelation(state, from, to, gain);
  setCooldown(state, key, 30 * DAY);
  log(state, 'diplomacy', `${countryName(from)} envía una misión diplomática a ${countryName(to)} (+${gain}).`, [from, to]);
  return ok(`Relaciones con ${countryName(to)} +${gain} (coste ${cost.toFixed(2)} mil M).`);
}

export function worsenRelations(state: GameState, from: CountryId, to: CountryId): ActionResult {
  if (from === to) return fail('Acción no válida.');
  const key = `worsen:${pairKey(from, to)}:${from}`;
  const left = cooldownLeft(state, key);
  if (left) return fail(`Ya protestaste recientemente. Disponible en ${Math.ceil(left / DAY)} días.`);
  changeRelation(state, from, to, -15);
  setCooldown(state, key, 30 * DAY);
  // Retórica nacionalista: pequeño apoyo interno
  const c = state.countries[from];
  c.stability = clamp(c.stability + 0.5, 0, 100);
  log(state, 'diplomacy', `${countryName(from)} emite una protesta formal contra ${countryName(to)} (−15).`, [from, to]);
  return ok(`Relaciones con ${countryName(to)} −15.`);
}

export function sendAid(state: GameState, from: CountryId, to: CountryId, amount: number): ActionResult {
  if (atWar(state, from, to)) return fail('No puedes enviar ayuda a un enemigo.');
  const res = transferFunds(state, from, to, amount);
  if (!res.ok) return res;
  const gain = clamp((150 * amount) / Math.max(state.countries[to].gdp, 1), 1, 25);
  changeRelation(state, from, to, gain);
  log(state, 'diplomacy', `${countryName(from)} envía ${amount.toFixed(2)} mil M en ayuda a ${countryName(to)} (+${gain.toFixed(0)}).`, [from, to]);
  return ok(`${res.message} Relaciones +${gain.toFixed(0)}.`);
}

export function hasTrade(state: GameState, a: CountryId, b: CountryId): boolean {
  return state.trades.some((t) => pairKey(t.a, t.b) === pairKey(a, b));
}

export function tradeCount(state: GameState, c: CountryId): number {
  return state.trades.filter((t) => t.a === c || t.b === c).length;
}

export function cancelTrade(state: GameState, from: CountryId, to: CountryId): ActionResult {
  if (!hasTrade(state, from, to)) return fail('No existe acuerdo comercial.');
  state.trades = state.trades.filter((t) => pairKey(t.a, t.b) !== pairKey(from, to));
  changeRelation(state, from, to, -10);
  log(state, 'diplomacy', `${countryName(from)} cancela su acuerdo comercial con ${countryName(to)}.`, [from, to]);
  return ok('Acuerdo comercial cancelado (−10 relaciones).');
}

// ---------- Evaluación de propuestas (reglas consistentes usadas por la IA) ----------

export interface Evaluation { accept: boolean; reason: string }

export function evaluateTrade(state: GameState, to: CountryId, from: CountryId): Evaluation {
  if (atWar(state, from, to)) return { accept: false, reason: 'estáis en guerra' };
  if (hasTrade(state, from, to)) return { accept: false, reason: 'ya existe un acuerdo' };
  if (tradeCount(state, to) >= MAX_TRADES) return { accept: false, reason: 'ya tiene demasiados acuerdos' };
  const rel = getRelation(state, from, to);
  if (rel < 15) return { accept: false, reason: `relaciones insuficientes (${rel.toFixed(0)}, se necesita 15)` };
  return { accept: true, reason: 'relaciones favorables' };
}

export function evaluateSupport(state: GameState, to: CountryId, from: CountryId, warId: string): Evaluation {
  const war = state.wars.find((w) => w.id === warId);
  if (!war) return { accept: false, reason: 'la guerra ya terminó' };
  const side = sideOf(war, from);
  if (!side) return { accept: false, reason: 'no participas en esa guerra' };
  if (sideOf(war, to)) return { accept: false, reason: 'ya participa en esa guerra' };
  if (warsOf(state, to).length) return { accept: false, reason: 'ya está en otra guerra' };
  const enemies = side === 'attackers' ? war.defenders : war.attackers;
  if (enemies.some((e) => inTruce(state, to, e))) return { accept: false, reason: 'tiene una tregua con el enemigo' };
  const rel = getRelation(state, to, from);
  if (rel < 50) return { accept: false, reason: `relaciones insuficientes (${rel.toFixed(0)}, se necesita 50)` };
  const worstEnemyRel = Math.max(...enemies.map((e) => getRelation(state, to, e)));
  if (worstEnemyRel >= 25) return { accept: false, reason: 'mantiene buenas relaciones con el enemigo' };
  if (state.countries[to].stability < 30) return { accept: false, reason: 'su situación interna es inestable' };
  return { accept: true, reason: 'alianza de hecho' };
}

export function evaluatePeace(state: GameState, to: CountryId, from: CountryId, terms: PeaceTerms): Evaluation {
  const war = warBetween(state, from, to);
  if (!war) return { accept: false, reason: 'no estáis en guerra' };
  const a = warAssessment(state, to);
  const days = (state.hour - war.startHour) / DAY;
  const desperate = a.stability < 25 || a.capitalLost || a.powerRatio < 0.6;
  if (terms === 'white') {
    if (a.score <= 0.03) return { accept: true, reason: 'no gana nada continuando la guerra' };
    if (days > 120 && a.score < 0.15) return { accept: true, reason: 'cansancio de guerra' };
    if (desperate) return { accept: true, reason: 'su situación militar es crítica' };
    return { accept: false, reason: 'cree que está ganando la guerra' };
  }
  // status_quo: cada parte conserva lo que ocupa
  if (a.score >= 0) return { accept: true, reason: 'conserva sus conquistas' };
  if (a.score < -0.05 && (desperate || days > 180)) return { accept: true, reason: 'acepta la derrota' };
  return { accept: false, reason: 'no acepta ceder territorio' };
}

// ---------- Propuestas ----------

const KIND_LABEL: Record<ProposalKind, string> = {
  trade: 'acuerdo comercial',
  peace: 'tratado de paz',
  military_support: 'apoyo militar',
};

export interface ProposalInput { kind: ProposalKind; terms?: PeaceTerms; warId?: string }

/**
 * Envía una propuesta. Si el destinatario es la IA se evalúa al instante;
 * si es el jugador, queda en su bandeja hasta que responda (o caduque).
 */
export function propose(state: GameState, from: CountryId, to: CountryId, input: ProposalInput): ActionResult {
  if (from === to) return fail('Acción no válida.');
  if (state.countries[to].eliminated) return fail('País eliminado.');
  const key = `propose:${input.kind}:${pairKey(from, to)}:${from}`;
  const left = cooldownLeft(state, key);
  if (left) return fail(`Propuesta rechazada recientemente. Espera ${Math.ceil(left / DAY)} días.`);
  if (input.kind === 'peace' && !warBetween(state, from, to)) return fail('No estáis en guerra.');
  if (input.kind === 'trade' && hasTrade(state, from, to)) return fail('Ya existe un acuerdo comercial.');
  if (input.kind === 'military_support') {
    if (!input.warId) return fail('Indica la guerra.');
    if (!state.wars.some((w) => w.id === input.warId && sideOf(w, from))) return fail('No participas en esa guerra.');
  }

  if (to === state.player) {
    if (state.proposals.some((p) => p.from === from && p.to === to && p.kind === input.kind)) return fail('Ya hay una propuesta pendiente.');
    const p: Proposal = {
      id: newId(state, 'p'), kind: input.kind, from, to,
      createdHour: state.hour, expiresHour: state.hour + 10 * DAY,
      terms: input.terms, warId: input.warId,
    };
    state.proposals.push(p);
    log(state, 'alert', `${countryName(from)} te propone: ${KIND_LABEL[input.kind]}${input.kind === 'peace' ? ` (${input.terms === 'white' ? 'paz blanca' : 'cada uno conserva lo ocupado'})` : ''}.`, [from, to]);
    return ok('Propuesta enviada.');
  }

  const ev = evaluateProposal(state, to, from, input);
  if (!ev.accept) {
    setCooldown(state, key, 15 * DAY);
    if (from === state.player) log(state, 'diplomacy', `${countryName(to)} rechaza tu propuesta de ${KIND_LABEL[input.kind]}: ${ev.reason}.`, [from, to]);
    return fail(`${countryName(to)} rechaza: ${ev.reason}.`);
  }
  return applyProposal(state, from, to, input, ev.reason);
}

export function evaluateProposal(state: GameState, to: CountryId, from: CountryId, input: ProposalInput): Evaluation {
  switch (input.kind) {
    case 'trade': return evaluateTrade(state, to, from);
    case 'military_support': return evaluateSupport(state, to, from, input.warId!);
    case 'peace': return evaluatePeace(state, to, from, input.terms ?? 'white');
  }
}

function applyProposal(state: GameState, from: CountryId, to: CountryId, input: ProposalInput, reason: string): ActionResult {
  switch (input.kind) {
    case 'trade': {
      state.trades.push({ a: from, b: to, sinceHour: state.hour });
      changeRelation(state, from, to, 5);
      log(state, 'diplomacy', `${countryName(from)} y ${countryName(to)} firman un acuerdo comercial.`, [from, to]);
      return ok(`${countryName(to)} acepta el acuerdo comercial (${reason}).`);
    }
    case 'military_support': {
      const war = state.wars.find((w) => w.id === input.warId)!;
      const res = joinWar(state, to, war.id, sideOf(war, from)!);
      if (res.ok) changeRelation(state, from, to, 10);
      return res.ok ? ok(`${countryName(to)} entra en la guerra a tu lado.`) : res;
    }
    case 'peace':
      return makePeace(state, from, to, input.terms ?? 'white');
  }
}

/** El jugador responde a una propuesta de la IA. */
export function respondProposal(state: GameState, proposalId: string, accept: boolean): ActionResult {
  const p = state.proposals.find((x) => x.id === proposalId);
  if (!p) return fail('La propuesta ya no está disponible.');
  state.proposals = state.proposals.filter((x) => x !== p);
  const input: ProposalInput = { kind: p.kind, terms: p.terms, warId: p.warId };
  if (!accept) {
    state.cooldowns[`propose:${p.kind}:${pairKey(p.from, p.to)}:${p.from}`] = state.hour + 30 * DAY;
    if (p.kind === 'military_support') changeRelation(state, p.from, p.to, -10);
    log(state, 'diplomacy', `Rechazas la propuesta de ${KIND_LABEL[p.kind]} de ${countryName(p.from)}.`, [p.from, p.to]);
    return ok('Propuesta rechazada.');
  }
  // Validar que siga siendo aplicable
  if (p.kind === 'peace' && !warBetween(state, p.from, p.to)) return fail('Ya no estáis en guerra.');
  if (p.kind === 'trade' && hasTrade(state, p.from, p.to)) return fail('Ya existe el acuerdo.');
  if (p.kind === 'trade' && tradeCount(state, p.to) >= MAX_TRADES) return fail('Tienes demasiados acuerdos comerciales.');
  if (p.kind === 'military_support') {
    const war = state.wars.find((w) => w.id === p.warId);
    if (!war) return fail('Esa guerra ya terminó.');
    const res = joinWar(state, p.to, war.id, sideOf(war, p.from)!);
    if (res.ok) changeRelation(state, p.from, p.to, 10);
    return res;
  }
  return applyProposal(state, p.from, p.to, input, 'aceptado');
}

export function expireProposals(state: GameState): void {
  const expired = state.proposals.filter((p) => p.expiresHour <= state.hour);
  for (const p of expired) {
    state.cooldowns[`propose:${p.kind}:${pairKey(p.from, p.to)}:${p.from}`] = state.hour + 30 * DAY;
    log(state, 'diplomacy', `Caduca la propuesta de ${KIND_LABEL[p.kind]} de ${countryName(p.from)}.`, [p.from, p.to]);
  }
  state.proposals = state.proposals.filter((p) => p.expiresHour > state.hour);
}

/** Efecto mensual de los acuerdos comerciales sobre las relaciones. */
export function monthlyDiplomacy(state: GameState): void {
  for (const t of state.trades) changeRelation(state, t.a, t.b, 1);
}

export { declareWar };
