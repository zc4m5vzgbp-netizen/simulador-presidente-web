/**
 * Controlador de interfaz: conecta el motor con React.
 * Mantiene el estado, el reloj (requestAnimationFrame) y el autoguardado.
 * La interfaz solo modifica el juego a través de `act()` → `perform()`.
 */
import type { CountryId, GameState } from '../engine/types';
import { createNewGame } from '../engine/setup';
import { advanceHours, GameClock, type SpeedId } from '../engine/time';
import { perform, type Action } from '../engine/actions';
import { monthIndex } from '../engine/core';
import type { ActionResult } from '../engine/core';
import { defaultStorage, loadGame, saveGame, type SaveMeta, type StorageAdapter } from '../persistence/saves';

export interface Toast { id: number; text: string; ok: boolean }

type Listener = () => void;

export class GameController {
  state: GameState | null = null;
  clock = new GameClock();
  version = 0;
  /** Cambia con cada partida nueva o cargada (para reiniciar la interfaz). */
  session = 0;
  toasts: Toast[] = [];
  saves: SaveMeta[] = [];
  storage: StorageAdapter;
  private listeners = new Set<Listener>();
  private raf = 0;
  private last = 0;
  private toastId = 0;
  private lastAutosaveMonth = -1;

  constructor(storage?: StorageAdapter) {
    this.storage = storage ?? defaultStorage();
    this.refreshSaves();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.state && !this.state.gameOver) void this.autosave();
      });
    }
  }

  subscribe = (l: Listener) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  getVersion = () => this.version;

  emit(): void {
    this.version++;
    for (const l of this.listeners) l();
  }

  newGame(country: CountryId): void {
    this.state = createNewGame(country);
    this.session++;
    this.clock = new GameClock();
    this.clock.speed = 0;
    this.lastAutosaveMonth = monthIndex(0);
    this.start();
    this.emit();
  }

  quitToMenu(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.state = null;
    this.refreshSaves();
    this.emit();
  }

  setSpeed(speed: SpeedId): void {
    this.clock.speed = speed;
    this.emit();
  }

  act(action: Action): ActionResult {
    if (!this.state) return { ok: false, message: 'No hay partida.' };
    const res = perform(this.state, this.state.player, action);
    this.toast(res.message, res.ok);
    this.emit();
    return res;
  }

  /** Ejecuta varias acciones y muestra un único aviso con el resultado. */
  actBatch(actions: Action[], summary: (okCount: number) => string): ActionResult[] {
    if (!this.state) return [];
    const results = actions.map((a) => perform(this.state!, this.state!.player, a));
    const okCount = results.filter((r) => r.ok).length;
    const firstFail = results.find((r) => !r.ok);
    if (okCount) this.toast(summary(okCount), true);
    if (firstFail) this.toast(firstFail.message, false);
    this.emit();
    return results;
  }

  toast(text: string, ok = true): void {
    const t = { id: ++this.toastId, text, ok };
    this.toasts = [...this.toasts.slice(-2), t];
    setTimeout(() => {
      this.toasts = this.toasts.filter((x) => x.id !== t.id);
      this.emit();
    }, 3800);
  }

  private start(): void {
    cancelAnimationFrame(this.raf);
    this.last = performance.now();
    const loop = (now: number) => {
      const dt = now - this.last;
      this.last = now;
      if (this.state && !this.state.gameOver) {
        const hours = this.clock.tick(dt);
        if (hours > 0) {
          advanceHours(this.state, hours);
          const m = monthIndex(this.state.hour);
          if (m !== this.lastAutosaveMonth) { this.lastAutosaveMonth = m; void this.autosave(); }
          if (this.state.gameOver) this.clock.speed = 0;
          this.emit();
        }
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  async refreshSaves(): Promise<void> {
    try { this.saves = await this.storage.list(); } catch { this.saves = []; }
    this.emit();
  }

  async save(slot: string): Promise<void> {
    if (!this.state) return;
    try {
      await saveGame(this.storage, this.state, slot);
      this.toast(slot === 'auto' ? 'Autoguardado.' : 'Partida guardada.');
      await this.refreshSaves();
    } catch (e) {
      this.toast(`No se pudo guardar: ${(e as Error).message}`, false);
    }
  }

  private async autosave(): Promise<void> {
    if (!this.state) return;
    try { await saveGame(this.storage, this.state, 'auto'); await this.refreshSaves(); } catch { /* sin almacenamiento */ }
  }

  async load(slot: string): Promise<void> {
    try {
      const s = await loadGame(this.storage, slot);
      this.state = s;
      this.session++;
      this.clock = new GameClock();
      this.clock.speed = 0;
      this.lastAutosaveMonth = monthIndex(s.hour);
      this.start();
      this.toast('Partida cargada.');
      this.emit();
    } catch (e) {
      this.toast(`No se pudo cargar: ${(e as Error).message}`, false);
    }
  }

  async deleteSave(slot: string): Promise<void> {
    await this.storage.remove(slot);
    await this.refreshSaves();
  }
}

export const controller = new GameController();
// Acceso para pruebas automatizadas de interfaz.
if (typeof window !== 'undefined') (window as unknown as { __game: GameController }).__game = controller;
