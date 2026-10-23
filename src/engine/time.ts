/**
 * Tiempo de juego. La simulación avanza en pasos de 1 hora simulada.
 * La velocidad de renderizado no influye: el reloj convierte tiempo real en
 * horas simuladas y el motor procesa exactamente esas horas.
 */
import type { GameState } from './types';
import { HOURS_PER_DAY, monthIndex } from './core';
import { hourlyMovement, dailyMilitary, dailyReplenishment } from './military';
import { hourlyCombat, hourlyOccupation } from './war';
import { dailySupplyAndRepair } from './combat';
import { dailyEconomy, monthlyClose } from './economy';
import { expireProposals, monthlyDiplomacy } from './diplomacy';
import { hourlyAI } from './ai';

/** Un día de juego = 5 minutos reales a ×1 (MIL-153 C). */
export const REAL_MS_PER_DAY = 300_000;
export const REAL_MS_PER_HOUR = REAL_MS_PER_DAY / HOURS_PER_DAY;

/** Pausa, ×1, ×2 y ×4 (MIL-154 B). */
export const SPEEDS = [
  { id: 0, label: 'Pausa', multiplier: 0 },
  { id: 1, label: 'Velocidad ×1', multiplier: 1 },
  { id: 2, label: 'Velocidad ×2', multiplier: 2 },
  { id: 3, label: 'Velocidad ×4', multiplier: 4 },
] as const;

export type SpeedId = (typeof SPEEDS)[number]['id'];

/** Avanza una hora simulada. */
export function stepHour(state: GameState): void {
  if (state.gameOver) return;
  const prevMonth = monthIndex(state.hour);
  state.hour += 1;
  hourlyMovement(state);
  hourlyCombat(state);
  hourlyOccupation(state);
  if (state.hour % HOURS_PER_DAY === 0) {
    dailyEconomy(state);
    dailyMilitary(state);
    dailyReplenishment(state);
    dailySupplyAndRepair(state);
    expireProposals(state);
  }
  if (monthIndex(state.hour) !== prevMonth) {
    monthlyClose(state);
    monthlyDiplomacy(state);
  }
  hourlyAI(state);
}

export function advanceHours(state: GameState, hours: number): void {
  for (let i = 0; i < hours && !state.gameOver; i++) stepHour(state);
}

export function advanceDays(state: GameState, days: number): void {
  advanceHours(state, days * HOURS_PER_DAY);
}

/**
 * Reloj: acumula tiempo real y devuelve cuántas horas simuladas tocan.
 * Se limita el máximo por fotograma para no bloquear la interfaz.
 */
export class GameClock {
  private accumulator = 0;
  speed: SpeedId = 0;

  constructor(private maxHoursPerTick = 48) {}

  /**
   * Devuelve las horas a simular tras `realMs` milisegundos reales.
   * `testScale` solo lo usan las pruebas automatizadas para no esperar minutos reales.
   */
  tick(realMs: number, testScale = 1): number {
    const mult = SPEEDS[this.speed].multiplier;
    if (mult === 0) { this.accumulator = 0; return 0; }
    this.accumulator += Math.min(realMs, 1000) * mult * testScale;
    // Pequeño margen para que el redondeo de coma flotante no pierda horas.
    const hours = Math.floor((this.accumulator + 1e-6) / REAL_MS_PER_HOUR);
    const allowed = Math.min(hours, this.maxHoursPerTick);
    this.accumulator = Math.max(0, this.accumulator - hours * REAL_MS_PER_HOUR);
    return allowed;
  }

  /** Fracción de la hora en curso (para animar el movimiento con suavidad). */
  get fraction(): number {
    return this.accumulator / REAL_MS_PER_HOUR;
  }
}
