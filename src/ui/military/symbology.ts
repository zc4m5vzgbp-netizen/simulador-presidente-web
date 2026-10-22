/**
 * Simbología militar del Atlas de mando (ATLAS-001), inspirada en APP-6 / MIL-STD-2525
 * y simplificada para pantallas pequeñas.
 *
 * - El MARCO indica bando y dominio (no solo el color: legible con daltonismo):
 *     amigo/aliado: rectángulo (tierra), cúpula (aire), círculo (superficie), «U» (submarino)
 *     hostil: rombo / triángulo · neutral: cuadrado.
 * - El GLIFO interior indica el tipo de unidad.
 * - El ESCALÓN (II batallón, X brigada, XX división…) va encima del marco.
 *
 * Solo REPRESENTACIÓN: no añade mecánicas. El motor actual solo tiene un tipo
 * de unidad (batallón genérico); las demás categorías quedan preparadas para el
 * futuro sistema militar y marcadas `inGame: false`.
 */
import type { Unit } from '../../engine/types';

export type Affiliation = 'friend' | 'ally' | 'hostile' | 'neutral';
export type Domain = 'land' | 'air' | 'sea' | 'subsurface';

export type UnitCategory =
  | 'infantry' | 'mechanized' | 'armored' | 'tank'
  | 'artillery' | 'air-defense'
  | 'fighter' | 'helicopter' | 'drone'
  | 'fleet' | 'surface-ship' | 'submarine'
  | 'formation';

export interface CategoryDef {
  id: UnitCategory;
  label: string;
  domain: Domain;
  /** true = existe hoy en el motor del juego. */
  inGame: boolean;
}

export const CATEGORIES: Record<UnitCategory, CategoryDef> = {
  infantry: { id: 'infantry', label: 'Infantería', domain: 'land', inGame: true },
  mechanized: { id: 'mechanized', label: 'Infantería mecanizada', domain: 'land', inGame: false },
  armored: { id: 'armored', label: 'Blindados', domain: 'land', inGame: false },
  tank: { id: 'tank', label: 'Tanques', domain: 'land', inGame: false },
  artillery: { id: 'artillery', label: 'Artillería', domain: 'land', inGame: false },
  'air-defense': { id: 'air-defense', label: 'Defensa antiaérea', domain: 'land', inGame: false },
  fighter: { id: 'fighter', label: 'Aviones', domain: 'air', inGame: false },
  helicopter: { id: 'helicopter', label: 'Helicópteros', domain: 'air', inGame: false },
  drone: { id: 'drone', label: 'Drones', domain: 'air', inGame: false },
  fleet: { id: 'fleet', label: 'Flota', domain: 'sea', inGame: false },
  'surface-ship': { id: 'surface-ship', label: 'Buque', domain: 'sea', inGame: false },
  submarine: { id: 'submarine', label: 'Submarino', domain: 'subsurface', inGame: false },
  formation: { id: 'formation', label: 'Formación compuesta', domain: 'land', inGame: true },
};

export type Echelon = 'company' | 'battalion' | 'regiment' | 'brigade' | 'division' | 'corps' | 'army';
export const ECHELON_MARK: Record<Echelon, string> = {
  company: 'I', battalion: 'II', regiment: 'III', brigade: 'X', division: 'XX', corps: 'XXX', army: 'XXXX',
};

/** Categoría de una unidad del motor. Hoy todas son batallones de infantería genéricos. */
export function unitCategory(_u: Unit): UnitCategory {
  return 'infantry';
}
export const UNIT_ECHELON: Echelon = 'battalion';

/** Relación con el jugador (la que ya usa el mapa) → bando del símbolo. */
export function affiliationOf(rel: 'mine' | 'ally' | 'enemy' | 'other'): Affiliation {
  return rel === 'mine' ? 'friend' : rel === 'ally' ? 'ally' : rel === 'enemy' ? 'hostile' : 'neutral';
}

export interface Frame {
  /** Trazado del marco centrado en (0, 0), en unidades de símbolo (1 = 1 px a escala 1). */
  d: string;
  /** Caja interior útil para el glifo. */
  inner: { w: number; h: number };
  /** Borde superior e inferior (para colocar escalón y efectivos). */
  top: number;
  bottom: number;
  halfW: number;
}

/** Marco según bando y dominio (convención APP-6 simplificada). */
export function frameFor(aff: Affiliation, domain: Domain): Frame {
  const hostile = aff === 'hostile', neutral = aff === 'neutral';
  if (domain === 'land' || domain === 'sea') {
    if (hostile) return { d: 'M0,-11L11,0L0,11L-11,0Z', inner: { w: 11, h: 11 }, top: -11, bottom: 11, halfW: 11 };
    if (neutral) return { d: 'M-9,-9H9V9H-9Z', inner: { w: 15, h: 15 }, top: -9, bottom: 9, halfW: 9 };
    if (domain === 'sea') return { d: 'M0,-9.5A9.5,9.5 0 1 1 0,9.5A9.5,9.5 0 1 1 0,-9.5Z', inner: { w: 13, h: 12 }, top: -9.5, bottom: 9.5, halfW: 9.5 };
    return { d: 'M-12.5,-8.5H12.5V8.5H-12.5Z', inner: { w: 23, h: 15 }, top: -8.5, bottom: 8.5, halfW: 12.5 };
  }
  if (domain === 'air') {
    if (hostile) return { d: 'M-10,6L0,-10L10,6Z', inner: { w: 10, h: 9 }, top: -10, bottom: 6, halfW: 10 };
    if (neutral) return { d: 'M-9,7V-9H9V7Z', inner: { w: 15, h: 13 }, top: -9, bottom: 7, halfW: 9 };
    return { d: 'M-11,6V0A11,9.5 0 0 1 11,0V6Z', inner: { w: 16, h: 10 }, top: -9.5, bottom: 6, halfW: 11 };
  }
  // submarino
  if (hostile) return { d: 'M-10,-6L0,10L10,-6Z', inner: { w: 10, h: 9 }, top: -6, bottom: 10, halfW: 10 };
  if (neutral) return { d: 'M-9,-7V9H9V-7Z', inner: { w: 15, h: 13 }, top: -7, bottom: 9, halfW: 9 };
  return { d: 'M-11,-6V0A11,9.5 0 0 0 11,0V-6Z', inner: { w: 16, h: 10 }, top: -6, bottom: 9.5, halfW: 11 };
}

export interface Glyph { stroke?: string; fill?: string }

/** Glifo del tipo de unidad, dentro de la caja interior del marco (centrada en 0,0). */
export function glyphFor(cat: UnitCategory, inner: { w: number; h: number }): Glyph {
  const hw = inner.w / 2, hh = inner.h / 2;
  const x = `M${-hw},${-hh}L${hw},${hh}M${-hw},${hh}L${hw},${-hh}`;
  const oval = (s = 1) => { const rx = hw * 0.62 * s, ry = hh * 0.48 * s; return `M${-rx + ry},${-ry}H${rx - ry}A${ry},${ry} 0 0 1 ${rx - ry},${ry}H${-rx + ry}A${ry},${ry} 0 0 1 ${-rx + ry},${-ry}Z`; };
  switch (cat) {
    case 'infantry': return { stroke: x };
    case 'mechanized': return { stroke: `${x}${oval(0.9)}` };
    case 'armored': return { stroke: oval() };
    case 'tank': return { stroke: `${oval(0.85)}M${hw * 0.5},${-hh * 0.15}H${hw * 0.95}` };
    case 'artillery': return { fill: `M0,${-hh * 0.32}A${hh * 0.32},${hh * 0.32} 0 1 1 0,${hh * 0.32}A${hh * 0.32},${hh * 0.32} 0 1 1 0,${-hh * 0.32}Z` };
    case 'air-defense': return { stroke: `M${-hw * 0.8},${hh}A${hw * 0.8},${hh * 0.8} 0 0 1 ${hw * 0.8},${hh}` };
    case 'fighter': return { fill: 'M0,-4.5L1.2,-0.8L6.5,1.6V3L1.2,1.8L0.9,4.2L2.6,5.4V6.2L0,5.5L-2.6,6.2V5.4L-0.9,4.2L-1.2,1.8L-6.5,3V1.6L-1.2,-0.8Z' };
    case 'helicopter': return { fill: 'M-6,-2.5L0,0.5L6,-2.5V2.5L0,-0.5L-6,2.5Z' };
    case 'drone': return { stroke: 'M-6.5,2L0,-2.5L6.5,2' };
    case 'fleet': return { stroke: 'M-6,1.5H6L4,4.5H-4Z M-0.5,1.5V-5 M-0.5,-4.2L3.2,-1.2H-0.5 M-6,-2H-3' };
    case 'surface-ship': return { stroke: 'M-6,1.5H6L4,4.5H-4Z M-0.5,1.5V-5 M-0.5,-4.2L3.2,-1.2H-0.5' };
    case 'submarine': return { stroke: 'M-6,0.5H5.5A1.8,1.8 0 0 1 5.5,3H-6Z M-1,0.5V-2H2V0.5' };
    case 'formation': return { stroke: `${x}${oval(0.9)}`, fill: `M0,${-1.4}A1.4,1.4 0 1 1 0,1.4A1.4,1.4 0 1 1 0,-1.4Z` };
  }
}

/** Efectivos en forma compacta: 850 · 4,2K · 12K. */
export function strengthLabel(men: number): string {
  if (men < 1000) return String(Math.round(men));
  const k = men / 1000;
  return `${k < 10 ? k.toFixed(1).replace('.', ',') : Math.round(k)}K`;
}
