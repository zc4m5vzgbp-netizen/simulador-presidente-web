/** Persistencia de partidas: adaptador de almacenamiento + IndexedDB. */
import type { CountryId, GameState } from '../engine/types';
import { SAVE_VERSION } from '../engine/types';
import { formatDate } from '../engine/core';
import { migrateState } from '../engine/migrations';

export interface SaveMeta {
  slot: string;
  label: string;
  player: CountryId;
  hour: number;
  savedAt: number;
}

export interface SaveRecord extends SaveMeta {
  version: number;
  /** Estado serializado en JSON (copia profunda e independiente). */
  data: string;
}

export interface StorageAdapter {
  put(record: SaveRecord): Promise<void>;
  get(slot: string): Promise<SaveRecord | undefined>;
  list(): Promise<SaveMeta[]>;
  remove(slot: string): Promise<void>;
}

export class MemoryStorage implements StorageAdapter {
  private map = new Map<string, SaveRecord>();
  async put(r: SaveRecord) { this.map.set(r.slot, structuredClone(r)); }
  async get(slot: string) { const r = this.map.get(slot); return r && structuredClone(r); }
  async list() { return [...this.map.values()].map(meta).sort((a, b) => b.savedAt - a.savedAt); }
  async remove(slot: string) { this.map.delete(slot); }
}

const DB_NAME = 'simulador-presidente';
const STORE = 'saves';

export class IndexedDBStorage implements StorageAdapter {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private db(): Promise<IDBDatabase> {
    this.dbPromise ??= new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'slot' }); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.dbPromise;
  }

  private async tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(req.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }

  async put(r: SaveRecord) { await this.tx('readwrite', (s) => s.put(r)); }
  async get(slot: string) { return (await this.tx<SaveRecord | undefined>('readonly', (s) => s.get(slot))) ?? undefined; }
  async list() { return (await this.tx<SaveRecord[]>('readonly', (s) => s.getAll())).map(meta).sort((a, b) => b.savedAt - a.savedAt); }
  async remove(slot: string) { await this.tx('readwrite', (s) => s.delete(slot)); }
}

function meta(r: SaveRecord): SaveMeta {
  return { slot: r.slot, label: r.label, player: r.player, hour: r.hour, savedAt: r.savedAt };
}

/** Elige IndexedDB si está disponible; si no (modo privado, etc.), memoria. */
export function defaultStorage(): StorageAdapter {
  try {
    if (typeof indexedDB !== 'undefined' && indexedDB) return new IndexedDBStorage();
  } catch { /* sin IndexedDB */ }
  return new MemoryStorage();
}

export async function saveGame(storage: StorageAdapter, state: GameState, slot: string, label?: string): Promise<SaveMeta> {
  const record: SaveRecord = {
    slot,
    label: label ?? `${slot === 'auto' ? 'Autoguardado' : 'Partida'} · ${formatDate(state.hour)}`,
    player: state.player,
    hour: state.hour,
    savedAt: Date.now(),
    version: SAVE_VERSION,
    data: JSON.stringify(state),
  };
  await storage.put(record);
  return meta(record);
}

export async function loadGame(storage: StorageAdapter, slot: string): Promise<GameState> {
  const r = await storage.get(slot);
  if (!r) throw new Error('No existe esa partida guardada.');
  if (r.version > SAVE_VERSION) throw new Error(`Versión de guardado incompatible (${r.version}): es de una versión más reciente del juego.`);
  const raw = JSON.parse(r.data);
  if (!raw || !raw.countries || !raw.regions || !raw.units) throw new Error('Guardado dañado.');
  // Partidas de versiones anteriores: se actualizan en memoria; la ranura no se reescribe hasta guardar.
  return migrateState({ ...raw, version: raw.version ?? r.version }).state;
}
