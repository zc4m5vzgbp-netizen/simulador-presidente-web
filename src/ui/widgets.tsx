import { useState, type ReactNode } from 'react';
import type { CountryId } from '../engine/types';
import { COUNTRY_DEFS } from '../data/countries';

export function Flag({ c, size = 12 }: { c: CountryId; size?: number }) {
  return <span className="flag" style={{ background: COUNTRY_DEFS[c].color, width: size, height: size * 0.72 }} aria-hidden="true" />;
}

export function CountryTag({ c }: { c: CountryId }) {
  return <span className="ctag"><Flag c={c} />{COUNTRY_DEFS[c].name}</span>;
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'good' | 'bad' | 'warn' }) {
  return (
    <div className={`stat${tone ? ` ${tone}` : ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub !== undefined && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

export function Meter({ value, max = 100, tone, label }: { value: number; max?: number; tone?: 'good' | 'bad' | 'warn' | 'accent'; label?: string }) {
  const p = Math.max(0, Math.min(1, value / max)) * 100;
  return (
    <div className="meter" role="meter" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      <div className={`meter-fill ${tone ?? 'accent'}`} style={{ width: `${p}%` }} />
    </div>
  );
}

/** Barra centrada para relaciones -100..100. */
export function RelationBar({ value }: { value: number }) {
  const w = Math.abs(value) / 2;
  return (
    <div className="relbar" aria-label={`Relación ${Math.round(value)}`}>
      <div className="relbar-mid" />
      <div className={`relbar-fill ${value >= 0 ? 'pos' : 'neg'}`} style={value >= 0 ? { left: '50%', width: `${w}%` } : { right: '50%', width: `${w}%` }} />
    </div>
  );
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="sec">
      <header className="sec-head"><h3>{title}</h3>{aside}</header>
      {children}
    </section>
  );
}

/** Botón con confirmación dentro de la página (no se usan diálogos del navegador). */
export function ConfirmButton({ label, confirmLabel, onConfirm, className, disabled }: { label: string; confirmLabel: string; onConfirm: () => void; className?: string; disabled?: boolean }) {
  const [armed, setArmed] = useState(false);
  if (!armed) return <button type="button" className={className} disabled={disabled} onClick={() => setArmed(true)}>{label}</button>;
  return (
    <span className="confirm">
      <button type="button" className={`${className ?? ''} armed`} onClick={() => { setArmed(false); onConfirm(); }}>{confirmLabel}</button>
      <button type="button" className="ghost" onClick={() => setArmed(false)}>Cancelar</button>
    </span>
  );
}
