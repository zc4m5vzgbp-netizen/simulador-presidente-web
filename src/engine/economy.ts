/** Economía: actualización diaria, cierre presupuestario mensual, políticas y transferencias. */
import type { CountryId, CountryState, GameState, Policy } from './types';
import { clamp, fail, log, ok, type ActionResult } from './core';
import { countryName } from './world';
import { occupiedFraction, recomputeAggregates } from './territory';
import { upkeepNeeded } from './military';
import { warsOf } from './war';

export const POLICY_LIMITS: Record<keyof Policy, [number, number]> = {
  taxRate: [5, 50],
  publicSpending: [5, 40],
  investment: [0, 12],
  militaryBudget: [0.2, 10],
};

export function interestRate(c: CountryState): number {
  const ratio = c.gdp > 0 ? c.debt / c.gdp : 3;
  return clamp(0.02 + 0.03 * ratio, 0.02, 0.12);
}

export function taxEfficiency(c: CountryState): number {
  return clamp(0.85 + 0.25 * (c.stability / 100), 0.85, 1);
}

/** Flujos anuales estimados con la política actual (para mostrar y para la IA). */
export function annualFlows(state: GameState, id: CountryId) {
  const c = state.countries[id];
  const revenue = (c.gdp * c.policy.taxRate) / 100 * taxEfficiency(c);
  const civil = (c.gdp * (c.policy.publicSpending + c.policy.investment)) / 100;
  const military = (c.gdp * c.policy.militaryBudget) / 100;
  const interest = c.debt * interestRate(c);
  const spending = civil + military + interest;
  return { revenue, civil, military, interest, spending, balance: revenue - spending };
}

/** Actualización diaria: recauda, gasta y financia el déficit con deuda. */
export function dailyEconomy(state: GameState): void {
  for (const c of Object.values(state.countries)) {
    if (c.eliminated) continue;
    const f = annualFlows(state, c.id);
    const revenue = f.revenue / 365;
    const interest = f.interest / 365;
    const spending = f.spending / 365;
    c.reserves += revenue - spending;
    if (c.reserves < 0) {
      // Déficit sin reservas: se financia con nueva deuda (no se crea dinero).
      c.debt += -c.reserves;
      c.reserves = 0;
    }
    c.monthRevenue += revenue;
    c.monthSpending += spending;
    c.monthInterest += interest;
    const need = upkeepNeeded(state, c.id);
    c.supplyRatio = need > 0 ? f.military / need : 2;
  }
}

/** Cierre presupuestario mensual: crecimiento, estabilidad e informe. */
export function monthlyClose(state: GameState): void {
  for (const c of Object.values(state.countries)) {
    if (c.eliminated) continue;
    const p = c.policy, b = c.basePolicy;
    const wars = warsOf(state, c.id).length;
    const trades = state.trades.filter((t) => t.a === c.id || t.b === c.id).length;
    const occ = occupiedFraction(state, c.id);
    const debtRatio = c.gdp > 0 ? c.debt / c.gdp : 3;

    let growth = c.baseGrowth
      + 0.4 * (p.investment - b.investment)
      - 0.15 * (p.taxRate - b.taxRate)
      - 0.2 * Math.max(0, p.militaryBudget - b.militaryBudget)
      + 0.03 * (c.stability - 50)
      + 0.35 * Math.min(trades, 3)
      - (wars > 0 ? 1.5 : 0)
      - 6 * occ
      - (debtRatio > 1.2 ? 1.5 : 0);
    growth = clamp(growth, -12, 15);
    c.growth = growth;

    const stabTarget = clamp(
      c.baseStability
        + 2.5 * (p.publicSpending - b.publicSpending)
        - 2 * (p.taxRate - b.taxRate)
        + 1.5 * (growth - c.baseGrowth)
        - 8 * wars
        - 35 * occ
        - (debtRatio > 1 ? 8 : 0)
        - (c.supplyRatio < 0.7 ? 5 : 0),
      0, 100);
    c.stability = clamp(c.stability + (stabTarget - c.stability) * 0.25, 0, 100);

    c.lastReport = {
      day: Math.floor(state.hour / 24),
      revenue: c.monthRevenue,
      spending: c.monthSpending,
      interest: c.monthInterest,
      balance: c.monthRevenue - c.monthSpending,
      growth,
      stability: c.stability,
    };
    c.monthRevenue = c.monthSpending = c.monthInterest = 0;
  }

  // El PIB de cada región crece al ritmo del país que la controla.
  for (const r of Object.values(state.regions)) {
    const g = state.countries[r.controller].growth;
    r.gdp *= 1 + g / 1200;
    r.population *= 1 + 0.008 / 12;
  }
  recomputeAggregates(state);

  const player = state.countries[state.player];
  if (!state.gameOver && player.stability <= 3) {
    state.gameOver = { reason: 'La estabilidad nacional colapsó y tu gobierno fue destituido.', hour: state.hour };
    log(state, 'alert', 'Crisis de gobierno: has sido destituido.', [state.player]);
  }
}

export function setPolicy(state: GameState, id: CountryId, patch: Partial<Policy>): ActionResult {
  const c = state.countries[id];
  if (c.eliminated) return fail('País eliminado.');
  const before = { ...c.policy };
  for (const k of Object.keys(patch) as (keyof Policy)[]) {
    const v = patch[k];
    if (v === undefined || !Number.isFinite(v)) continue;
    const [min, max] = POLICY_LIMITS[k];
    c.policy[k] = Math.round(clamp(v, min, max) * 10) / 10;
  }
  // Subidas bruscas de impuestos generan descontento inmediato.
  const taxUp = c.policy.taxRate - before.taxRate;
  if (taxUp > 0) c.stability = clamp(c.stability - taxUp * 0.6, 0, 100);
  // Recortes de gasto público también.
  const cut = before.publicSpending - c.policy.publicSpending;
  if (cut > 0) c.stability = clamp(c.stability - cut * 0.5, 0, 100);
  const need = upkeepNeeded(state, id);
  c.supplyRatio = need > 0 ? annualFlows(state, id).military / need : 2;
  return ok('Política económica actualizada.');
}

/** Transferencia exacta de reservas: lo que sale del emisor llega al receptor. */
export function transferFunds(state: GameState, from: CountryId, to: CountryId, amount: number): ActionResult {
  if (from === to) return fail('No puedes transferirte fondos a ti mismo.');
  if (!(amount > 0) || !Number.isFinite(amount)) return fail('Cantidad no válida.');
  const a = state.countries[from], b = state.countries[to];
  if (a.reserves < amount) return fail('Reservas insuficientes.');
  a.reserves -= amount;
  b.reserves += amount;
  return ok(`Transferidos ${amount.toFixed(2)} mil M USD a ${countryName(to)}.`);
}

export function payDebt(state: GameState, id: CountryId, amount: number): ActionResult {
  const c = state.countries[id];
  if (!(amount > 0)) return fail('Cantidad no válida.');
  const pay = Math.min(amount, c.reserves, c.debt);
  if (pay <= 0) return fail('No hay reservas o deuda que amortizar.');
  c.reserves -= pay;
  c.debt -= pay;
  log(state, 'economy', `${countryName(id)} amortiza ${pay.toFixed(1)} mil M de deuda.`, [id]);
  return ok(`Deuda reducida en ${pay.toFixed(1)} mil M USD.`);
}

/** Valor económico total de las regiones (para validar conservación en pruebas). */
export function totalReserves(state: GameState): number {
  return Object.values(state.countries).reduce((s, c) => s + c.reserves, 0);
}
