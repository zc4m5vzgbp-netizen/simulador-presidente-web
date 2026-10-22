import type { UnitStatus } from '../engine/types';

const nf1 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

/** Miles de millones de USD → texto ("US$ 2,2 billones", "US$ 640 mil M"). */
export function money(bn: number): string {
  const sign = bn < 0 ? '−' : '';
  const v = Math.abs(bn);
  if (v >= 1000) return `${sign}US$ ${nf2.format(v / 1000)} bill.`;
  if (v >= 100) return `${sign}US$ ${nf0.format(v)} mil M`;
  if (v >= 1) return `${sign}US$ ${nf1.format(v)} mil M`;
  return `${sign}US$ ${nf0.format(v * 1000)} M`;
}

/** Versión compacta para la barra superior. */
export function moneyShort(bn: number): string {
  return money(bn).replace('US$ ', '$');
}

export function pct(v: number, digits = 1): string {
  return `${v.toLocaleString('es-ES', { maximumFractionDigits: digits, minimumFractionDigits: digits })} %`;
}

export function signedPct(v: number): string {
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${pct(Math.abs(v))}`;
}

export function people(millions: number): string {
  if (millions >= 1) return `${nf1.format(millions)} M hab.`;
  return `${nf0.format(millions * 1000)} mil hab.`;
}

export function int(n: number): string {
  return nf0.format(Math.round(n));
}

export const STATUS_LABEL: Record<UnitStatus, string> = {
  idle: 'En posición',
  moving: 'En marcha',
  combat: 'En combate',
  training: 'Entrenando',
  retreating: 'En retirada',
};

export function relationLabel(r: number): string {
  if (r >= 60) return 'Aliado cercano';
  if (r >= 25) return 'Amistoso';
  if (r >= -10) return 'Neutral';
  if (r >= -50) return 'Tenso';
  return 'Hostil';
}
