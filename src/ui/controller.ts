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
  /** Solo para pruebas automatizadas y la vista previa de verificación: acelera el reloj sin cambiar las reglas (1 = tiempo real). */
  timeScale = 1;
  /** Error interno del motor, si lo hubo: el reloj se detiene y se avisa en pantalla (nunca en silencio). */
  fatal: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(storage?: StorageAdapter) {
    this.storage = storage ?? defaultStorage();
    this.refreshSaves();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        // Al cerrar u ocultar la app: pausa y autoguardado (MIL-155 B). El juego no avanza cerrado.
        if (document.hidden && this.state && !this.state.gameOver) {
          this.clock.speed = 0;
          void this.autosave();
          this.emit();
        }
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
    this.stop();
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

  private stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /**
   * Un paso del reloj: convierte el tiempo real transcurrido en horas simuladas.
   * Lo llaman requestAnimationFrame (fluido) y, como respaldo, un temporizador
   * cada 250 ms: algunos visores de iPhone suspenden requestAnimationFrame y el
   * juego parecería congelado. Ambos comparten la marca de tiempo, así que nunca
   * se cuenta dos veces el mismo intervalo. Un error del motor detiene el reloj
   * y se muestra en pantalla, en lugar de parar el bucle sin avisar.
   */
  tickNow = (): void => {
    const now = performance.now();
    const dt = now - this.last;
    this.last = now;
    if (!this.state || this.state.gameOver || this.fatal) return;
    try {
      const hours = this.clock.tick(dt, this.timeScale);
      if (hours > 0) {
        advanceHours(this.state, hours);
        const m = monthIndex(this.state.hour);
        if (m !== this.lastAutosaveMonth) { this.lastAutosaveMonth = m; void this.autosave(); }
        if (this.state.gameOver) this.clock.speed = 0;
        this.emit();
      }
    } catch (e) {
      this.clock.speed = 0;
      this.fatal = (e as Error)?.message ?? String(e);
      console.error('Error interno del simulador', e);
      this.toast(`Error interno: ${this.fatal}. La partida se ha pausado.`, false);
      this.emit();
    }
  };

  private start(): void {
    this.stop();
    this.fatal = null;
    this.last = performance.now();
    const loop = () => {
      this.tickNow();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    this.timer = setInterval(this.tickNow, 250);
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
