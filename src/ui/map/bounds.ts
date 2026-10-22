/**
 * Encuadre del mapa (MOBILE-001): límites de zoom y de desplazamiento.
 *
 * Lógica pura de interfaz, sin React ni DOM, para poder probarla aparte. No
 * forma parte del motor ni del guardado: solo decide qué parte del mapa se ve.
 */
import { MAP, COUNTRY_IDS } from '../../engine/world';

/** Encuadre: esquina superior izquierda y ancho, en unidades de mapa. */
export interface View { x: number; y: number; w: number }

export const MIN_W = 120;
export const MAX_W = MAP.width * 1.45;
/**
 * La tierra debe quedar dentro de esta fracción central del encuadre: con 0,6
 * siempre hay país a la vista a más del 20 % de cada borde de la pantalla.
 */
export const LAND_INNER = 0.6;

export const clampW = (w: number) => Math.min(MAX_W, Math.max(MIN_W, w));

type Ring = [number, number][];

function rings(d: string): Ring[] {
  return d.split('M').filter(Boolean).map((part) => part.replace(/Z/g, '').split('L').map((p) => p.split(',').map(Number) as [number, number]));
}

const LAND_RINGS: Ring[] = COUNTRY_IDS.flatMap((c) => rings(MAP.countries[c]));

/** Separación (unidades de mapa) de la rejilla de puntos de tierra. */
const LAND_STEP = 12;

/**
 * Puntos de una rejilla que caen dentro de los 12 países (por barrido de
 * líneas: una pasada por fila). Representan "tierra visible" de verdad: los
 * islotes más pequeños que la rejilla no cuentan.
 */
const LAND: [number, number][] = (() => {
  const out: [number, number][] = [];
  for (let y = LAND_STEP / 2; y < MAP.height; y += LAND_STEP) {
    const xs: number[] = [];
    for (const ring of LAND_RINGS) {
      const cross: number[] = [];
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        if ((yi > y) !== (yj > y)) cross.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
      }
      cross.sort((p, q) => p - q);
      for (let k = 0; k + 1 < cross.length; k += 2) {
        for (let x = Math.ceil((cross[k] - LAND_STEP / 2) / LAND_STEP) * LAND_STEP + LAND_STEP / 2; x <= cross[k + 1]; x += LAND_STEP) xs.push(x);
      }
    }
    for (const x of new Set(xs)) out.push([x, y]);
  }
  return out;
})();

function onLand(x: number, y: number): boolean {
  let n = 0;
  for (const ring of LAND_RINGS) {
    let ins = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
    }
    if (ins) n++;
  }
  return n % 2 === 1;
}

/**
 * Corrige un encuadre para que nunca se pierda el mapa:
 * 1. el ancho queda entre MIN_W y MAX_W (conservando el centro);
 * 2. si el centro está en el mar y en la zona central del encuadre (LAND_INNER)
 *    no hay ningún punto de tierra, se desplaza lo mínimo necesario para que
 *    entre el punto de tierra más cercano.
 * El resultado no depende del camino: siempre es la misma corrección mínima.
 */
export function clampView(v: View, aspect: number): View {
  const w = clampW(v.w);
  const h = w * aspect;
  let cx = v.x + v.w / 2, cy = v.y + (v.w * aspect) / 2;
  const hx = (w / 2) * LAND_INNER, hy = (h / 2) * LAND_INNER;
  if (!onLand(cx, cy)) {
    let best = Infinity, sx = 0, sy = 0;
    for (const [px, py] of LAND) {
      const dx = Math.max(0, Math.abs(px - cx) - hx) * Math.sign(px - cx);
      const dy = Math.max(0, Math.abs(py - cy) - hy) * Math.sign(py - cy);
      const d = dx * dx + dy * dy;
      if (d < best) { best = d; sx = dx; sy = dy; if (d === 0) break; }
    }
    cx += sx; cy += sy;
  }
  return { x: cx - w / 2, y: cy - h / 2, w };
}

/** ¿Hay tierra dentro de la zona central del encuadre? (para pruebas) */
export const LAND_POINTS = () => LAND.length;

export function landInView(v: View, aspect: number): boolean {
  const h = v.w * aspect, cx = v.x + v.w / 2, cy = v.y + h / 2;
  const hx = (v.w / 2) * LAND_INNER + 1e-6, hy = (h / 2) * LAND_INNER + 1e-6;
  return onLand(cx, cy) || LAND.some(([px, py]) => Math.abs(px - cx) <= hx && Math.abs(py - cy) <= hy);
}
