/** Utilidades compartidas por todos los módulos del motor. */
import type { CountryId, GameState, LogKind } from './types';

export const HOURS_PER_DAY = 24;
export const START_DATE_UTC = Date.UTC(2027, 0, 1);

/** Generador pseudoaleatorio determinista (mulberry32) guardado en el estado. */
export function rand(state: GameState): number {
  state.rng = (state.rng + 0x6d2b79f5) >>> 0;
  let t = state.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randRange(state: GameState, min: number, max: number): number {
  return min + (max - min) * rand(state);
}

export function newId(state: GameState, prefix: string): string {
  return `${prefix}${state.nextId++}`;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function day(state: GameState): number {
  return Math.floor(state.hour / HOURS_PER_DAY);
}

export function dateOf(hour: number): Date {
  return new Date(START_DATE_UTC + hour * 3600_000);
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function formatDate(hour: number, withHour = false): string {
  const d = dateOf(hour);
  const s = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  return withHour ? `${s} · ${String(d.getUTCHours()).padStart(2, '0')}:00` : s;
}

/** Índice de mes absoluto (año*12+mes) para detectar cierres mensuales. */
export function monthIndex(hour: number): number {
  const d = dateOf(hour);
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

export function log(state: GameState, kind: LogKind, text: string, countries: CountryId[] = []): void {
  state.log.push({ hour: state.hour, kind, text, countries });
  if (state.log.length > 300) state.log.splice(0, state.log.length - 300);
}

export function pairKey(a: CountryId, b: CountryId): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/** Resultado común de todas las acciones (jugador e IA). */
export interface ActionResult {
  ok: boolean;
  message: string;
}

export const ok = (message: string): ActionResult => ({ ok: true, message });
export const fail = (message: string): ActionResult => ({ ok: false, message });
