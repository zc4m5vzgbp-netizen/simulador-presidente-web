/**
 * Atlas de mando (ATLAS-001): escalas del mapa y nivel de detalle.
 *
 * Tres bandas según el ancho visible (unidades de mapa; el continente mide
 * 1000 de ancho): Continente, Nación y Región. Cada banda decide qué capas y
 * cuánto detalle se dibujan, como en Apple Maps: cuanto más lejos, menos vías,
 * menos rótulos y unidades agrupadas.
 *
 * Lógica pura (sin React ni DOM): se prueba en tests/scale.test.ts.
 */
import type { CountryId } from '../../engine/types';
import { REGIONS, capitalOf } from '../../engine/world';
import { MAX_W, MIN_W, clampView, type View } from './bounds';
import type { Facility } from '../../atlas';

export type ScaleBand = 'continent' | 'nation' | 'region';

export const SCALE_BANDS: { id: ScaleBand; label: string; short: string }[] = [
  { id: 'continent', label: 'Continente', short: 'Cont.' },
  { id: 'nation', label: 'Nación', short: 'Nac.' },
  { id: 'region', label: 'Región', short: 'Reg.' },
];

/**
 * Límites de banda. Se miden por DENSIDAD (k = unidades de mapa por píxel de
 * pantalla), que es lo que decide cuánto detalle cabe: así un iPhone SE (mapa
 * de 252 px) y un 15 Pro Max (496 px) ven el mismo nivel de detalle a la misma
 * escala. En pantallas anchas, el continente entero (≥ 1250 de ancho) cuenta
 * siempre como Continente.
 */
export const BAND_K = { continentFrom: 2.4, regionBelow: 0.7, continentW: 1250 } as const;

export function bandOf(viewW: number, screenW: number): ScaleBand {
  const k = viewW / Math.max(screenW, 1);
  if (viewW >= BAND_K.continentW || k >= BAND_K.continentFrom) return 'continent';
  if (k < BAND_K.regionBelow) return 'region';
  return 'nation';
}

export type RoadTier = 'motorway' | 'trunk' | 'secondary';

export interface Detail {
  /** Estados/provincias reales (límites y selección). */
  states: boolean;
  /** Rótulos de estados. */
  stateLabels: boolean;
  /** Rótulos de las regiones del juego. */
  regionLabels: boolean;
  /** Jerarquías de vías visibles. */
  roads: RoadTier[];
  /** Ríos hasta este rango de Natural Earth (menor = más importante). */
  riverRank: number;
  /** Instalaciones (aeropuertos, puertos) visibles. */
  facilities: (f: Facility) => boolean;
  /** Nombres de instalaciones. */
  facilityLabels: boolean;
  /** Unidades: agrupadas por país (Continente) o por región (Nación/Región). */
  units: 'country' | 'region';
}

export const DETAIL: Record<ScaleBand, Detail> = {
  continent: {
    states: false, stateLabels: false, regionLabels: false, roads: [], riverRank: 3,
    facilities: () => false, facilityLabels: false, units: 'country',
  },
  nation: {
    states: true, stateLabels: true, regionLabels: false, roads: ['motorway', 'trunk'], riverRank: 6,
    // Solo las principales de la selección de Natural Earth.
    facilities: (f) => (f.kind === 'airport' ? f.neType === 'major' || f.rank <= 6 : f.rank <= 5),
    facilityLabels: false, units: 'region',
  },
  region: {
    states: true, stateLabels: true, regionLabels: true, roads: ['motorway', 'trunk', 'secondary'], riverRank: 8,
    facilities: () => true, facilityLabels: true, units: 'region',
  },
};

/** Encuadre nacional: todas las regiones del país, con un mínimo de escala legible. */
export function nationView(player: CountryId, aspect: number, screenW = 900): View {
  const pts = Object.values(REGIONS).filter((r) => r.country === player).map((r) => r.anchor);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const spanX = Math.max(...xs) - Math.min(...xs), spanY = Math.max(...ys) - Math.min(...ys);
  // Escala mínima de ~1,15 unidades de mapa por píxel: en pantallas pequeñas
  // se abre más cerca para que nombres y batallones no se amontonen.
  const w = Math.min(Math.max(820, spanX * 2.6, (spanY * 2.2) / aspect), Math.max(screenW * 1.15, spanX * 1.6, (spanY * 1.3) / aspect));
  // Siempre dentro de la banda Nación (ni tan lejos como Continente ni tan cerca como Región).
  const wn = Math.min(Math.max(w, screenW * BAND_K.regionBelow * 1.15), screenW * BAND_K.continentFrom * 0.9, BAND_K.continentW - 50);
  return { x: cx - wn / 2, y: cy - (wn * aspect) / 2, w: wn };
}

/** Encuadre objetivo de cada botón del selector de escala, centrado en el país del jugador. */
export function viewForBand(band: ScaleBand, player: CountryId, aspect: number, screenW = 900): View {
  const nation = nationView(player, aspect, screenW);
  const center = (cx: number, cy: number, w: number): View => clampView({ x: cx - w / 2, y: cy - (w * aspect) / 2, w }, aspect);
  if (band === 'nation') return clampView(nation, aspect);
  if (band === 'continent') return center(nation.x + nation.w / 2, nation.y + (nation.w * aspect) / 2, MAX_W);
  const cap = REGIONS[capitalOf(player)].anchor;
  return center(cap[0], cap[1], Math.max(MIN_W, screenW * 0.55));
}
