import type { ReactNode } from 'react';
import type { GameState } from '../../engine/types';
import { dateOf, formatDate } from '../../engine/core';
import { SPEEDS, type SpeedId } from '../../engine/time';
import { warsOf } from '../../engine/war';
import { COUNTRY_DEFS } from '../../data/countries';
import { controller } from '../controller';
import { FlagIcon } from '../flags';
import { Icon, type IconName } from '../icons';
import { moneyShort, people, int, signedPct } from '../format';

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function SpeedIcon({ id }: { id: SpeedId }) {
  if (id === 0) return <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="3" y="2.5" width="3.5" height="11" rx="0.6" fill="currentColor" /><rect x="9.5" y="2.5" width="3.5" height="11" rx="0.6" fill="currentColor" /></svg>;
  const n = id === 1 ? 1 : id === 2 ? 2 : 3;
  const w = 6 * n + 2;
  return (
    <svg viewBox={`0 0 ${w} 16`} width={w * 0.9} height="14" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => <path key={i} d={`M${1 + i * 6} 2.5 L${7.5 + i * 6} 8 L${1 + i * 6} 13.5 Z`} fill="currentColor" />)}
    </svg>
  );
}

function StatCard({ icon, label, value, trend, className, children }: { icon: IconName; label: string; value: ReactNode; trend?: number; className?: string; children?: ReactNode }) {
  return (
    <div className={`tb-card${className ? ` ${className}` : ''}`}>
      <Icon name={icon} size={22} className="tb-card-icon" />
      <div className="tb-card-text">
        <span className="tb-card-label">{label}</span>
        <span className="tb-card-value">{value}</span>
        {trend !== undefined && (
          <span className={`tb-trend ${trend >= 0 ? 'up' : 'down'}`}>
            <Icon name={trend >= 0 ? 'up' : 'down'} size={10} />{signedPct(trend).replace('+', '')}
          </span>
        )}
        {children}
      </div>
    </div>
  );
}

export function TopBar({ state, onOptions, optionsOpen, onInbox }: { state: GameState; onOptions: () => void; optionsOpen: boolean; onInbox: () => void }) {
  const me = state.player;
  const c = state.countries[me];
  const speed = controller.clock.speed;
  const atWarNow = warsOf(state, me).length > 0;
  const stabTone = c.stability < 30 ? 'bad' : c.stability < 50 ? 'warn' : 'good';
  const inbox = state.proposals.filter((p) => p.to === me).length;

  return (
    <header className={`topbar${atWarNow ? ' wartime' : ''}`}>
      <div className="tb-nation">
        <FlagIcon c={me} size={48} className="tb-flag" />
        <div className="tb-leader" aria-hidden="true"><Icon name="user" size={22} /></div>
        <div className="tb-nation-text">
          <span className="tb-name">{COUNTRY_DEFS[me].name}</span>
          <span className="tb-role">{atWarNow ? <span className="war-text">En guerra</span> : 'Presidente'}</span>
        </div>
      </div>

      <div className="tb-cards">
        <StatCard icon="gdp" label="PIB" value={moneyShort(c.gdp)} trend={c.growth} className="tb-gdp" />
        <StatCard icon="reserves" label="Reservas" value={<span className={c.reserves <= 0 ? 'bad-text' : ''}>{moneyShort(c.reserves)}</span>} className="tb-res" />
        <StatCard icon="population" label="Población" value={people(c.population).replace(' hab.', '')} className="tb-pop" />
        <StatCard icon="stability" label="Estabilidad" value={int(c.stability)} className={`tb-stab ${stabTone}`}>
          <span className="tb-stab-bar"><span style={{ width: `${Math.max(0, Math.min(100, c.stability))}%` }} /></span>
        </StatCard>
      </div>

      <div className="tb-date-card">
        <Icon name="calendar" size={20} className="tb-card-icon" />
        <div className="tb-card-text">
          <span className="tb-date" data-testid="date">{formatDate(state.hour)}<span className="tb-hour" data-testid="clock-hour">{String(state.hour % 24).padStart(2, '0')}:00</span></span>
          <span className="tb-weekday">{WEEKDAYS[dateOf(state.hour).getUTCDay()]} · {String(state.hour % 24).padStart(2, '0')}:00</span>
        </div>
      </div>

      <div className="tb-controls">
        <div className="speed" role="group" aria-label="Velocidad de la simulación">
          {SPEEDS.map((s) => (
            <button key={s.id} type="button" className={speed === s.id ? 'on' : ''} aria-pressed={speed === s.id}
              aria-label={s.label} title={s.label} data-speed={s.id} onClick={() => controller.setSpeed(s.id)}>
              <SpeedIcon id={s.id} />
            </button>
          ))}
        </div>
        <span className="tb-mult" aria-label="Multiplicador de tiempo">x{SPEEDS[speed].multiplier}</span>
        {controller.timeScale > 1 && <span className="tb-verify" data-testid="verify-badge">VERIFICACIÓN ×{controller.timeScale}</span>}
        <button type="button" className="tb-btn" aria-label={`Propuestas recibidas: ${inbox}`} data-action="inbox" onClick={onInbox}>
          <Icon name="mail" size={22} />
          {inbox > 0 && <span className="badge">{inbox}</span>}
        </button>
        <button type="button" className={`tb-btn${optionsOpen ? ' on' : ''}`} data-tab="game" aria-label="Partida: guardar, cargar y opciones" onClick={onOptions}>
          <Icon name="options" size={22} />
        </button>
      </div>
    </header>
  );
}
