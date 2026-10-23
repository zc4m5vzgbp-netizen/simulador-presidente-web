/**
 * Aviso de llegada de una orden de marcha, en tiempo de juego y en tiempo real
 * (incidencia F2-INC-01: con 1 día = 5 minutos, una marcha de varios días dura
 * minutos reales y, sin este aviso, el juego parecía detenido).
 */
import type { GameState } from '../engine/types';
import { etaHours } from '../engine/military';
import { REAL_MS_PER_HOUR } from '../engine/time';

export function formatGameDuration(hours: number): string {
  const h = Math.max(1, Math.ceil(hours));
  const d = Math.floor(h / 24), r = h % 24;
  return d ? `${d} d${r ? ` ${r} h` : ''}` : `${r} h`;
}

/** Minutos reales que tarda `hours` de juego a un multiplicador dado. */
export function realMinutes(hours: number, multiplier: number): number {
  return (hours * REAL_MS_PER_HOUR) / multiplier / 60_000;
}

function fmtMin(min: number): string {
  if (min < 1) return 'menos de 1 min';
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return `${h} h${m ? ` ${m} min` : ''}`;
}

/** «llegada en 5 d 10 h (≈ 7 min reales a ×4)», o '' si nadie marcha. */
export function arrivalNote(state: GameState, unitIds: string[]): string {
  const etas = unitIds.map((id) => state.units[id]).filter((u) => u && u.path.length).map((u) => etaHours(state, u!));
  if (!etas.length) return '';
  const h = Math.max(...etas);
  return `llegada en ${formatGameDuration(h)} (≈ ${fmtMin(realMinutes(h, 4))} reales a ×4)`;
}
