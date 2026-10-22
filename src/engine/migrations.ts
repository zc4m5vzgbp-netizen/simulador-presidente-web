/**
 * Migración de partidas guardadas a la versión actual del estado.
 *
 * Cada paso convierte la versión N en N+1 de forma determinista (sin usar el
 * generador aleatorio de la partida). Las partidas de versiones POSTERIORES a
 * la del juego no se pueden leer.
 */
import type { CountryId, GameState } from './types';
import { SAVE_VERSION } from './types';
import { initialEquipment, initialInventory } from './equipment';

type AnyState = Record<string, unknown> & { version: number };

const STEPS: Record<number, (s: AnyState) => void> = {
  /**
   * v1 → v2 (MIL Fase 1): inventario nacional y reposición automática por país;
   * equipo provisional por batallón según la plantilla; sin entrenamiento
   * obligatorio (los batallones que entrenaban pasan a estar operativos con sus
   * efectivos actuales).
   */
  1: (raw) => {
    const s = raw as unknown as GameState;
    const counts: Record<string, number> = {};
    for (const u of Object.values(s.units)) counts[u.owner] = (counts[u.owner] ?? 0) + 1;
    for (const c of Object.values(s.countries)) {
      c.inventory = initialInventory(c.id, Math.max(1, counts[c.id] ?? 0));
      c.autoReplenish = true;
    }
    for (const u of Object.values(s.units as unknown as Record<string, Record<string, unknown>>)) {
      if (u.status === 'training') u.status = 'idle';
      delete u.trainingHours;
      u.equipment = initialEquipment(u.owner as CountryId);
      u.recruitPending = 0;
    }
  },
};

export function migrateState(raw: AnyState): { state: GameState; from: number } {
  const from = raw.version;
  if (typeof from !== 'number' || from < 1) throw new Error('Guardado dañado: versión desconocida.');
  if (from > SAVE_VERSION) throw new Error(`Versión de guardado incompatible (${from}): es de una versión más reciente del juego.`);
  for (let v = from; v < SAVE_VERSION; v++) {
    STEPS[v](raw);
    raw.version = v + 1;
  }
  return { state: raw as unknown as GameState, from };
}
