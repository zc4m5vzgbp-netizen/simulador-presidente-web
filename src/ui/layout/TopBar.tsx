import type { GameState } from '../../engine/types';
import { formatDate } from '../../engine/core';
import { SPEEDS, type SpeedId } from '../../engine/time';
import { warsOf } from '../../engine/war';
import { COUNTRY_DEFS } from '../../data/countries';
import { controller } from '../controller';
import { Flag } from '../widgets';
import { Icon } from '../icons';
import { moneyShort, people, int } from '../format';

function SpeedIcon({ id }: { id: SpeedId }) {
  if (id === 0) return <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><rect x="3" y="2.5" width="3.5" height="11" fill="currentColor" /><rect x="9.5" y="2.5" width="3.5" height="11" fill="currentColor" /></svg>;
  const n = id === 1 ? 1 : id === 2 ? 2 : 3;
  const w = 6 * n + 2;
  return (
    <svg viewBox={`0 0 ${w} 16`} width={w * 0.85} height="13" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => <path key={i} d={`M${1 + i * 6} 2.5 L${7.5 + i * 6} 8 L${1 + i * 6} 13.5 Z`} fill="currentColor" />)}
    </svg>
  );
}

export function TopBar({ state, onOptions, optionsOpen }: { state: GameState; onOptions: () => void; optionsOpen: boolean }) {
  const me = state.player;
  const c = state.countries[me];
  const speed = controller.clock.speed;
  const atWarNow = warsOf(state, me).length > 0;
  const stabTone = c.stability < 30 ? 'bad' : c.stability < 50 ? 'warn' : 'good';

  return (
    <header className={`topbar${atWarNow ? ' wartime' : ''}`}>
      <div className="tb-nation">
        <Flag c={me} size={20} />
        <span className="tb-name">{COUNTRY_DEFS[me].name}</span>
        <span className="tb-code" aria-hidden="true">{me}</span>
        {atWarNow && <span className="chip war">En guerra</span>}
      </div>

      <dl className="tb-stats">
        <div><dt>PIB</dt><dd>{moneyShort(c.gdp)}</dd></div>
        <div><dt>Reservas</dt><dd className={c.reserves <= 0 ? 'bad-text' : ''}>{moneyShort(c.reserves)}</dd></div>
        <div className="tb-pop"><dt>Población</dt><dd>{people(c.population)}</dd></div>
        <div>
          <dt>Estabilidad</dt>
          <dd className={`stab ${stabTone}`}>
            <span>{int(c.stability)}</span>
            <span className="stab-bar"><span style={{ width: `${Math.max(0, Math.min(100, c.stability))}%` }} /></span>
          </dd>
        </div>
      </dl>

      <div className="tb-time">
        <span className="tb-date" data-testid="date" aria-live="off">{formatDate(state.hour)}<span className="tb-hour"> · {String(state.hour % 24).padStart(2, '0')}:00</span></span>
        <div className="speed" role="group" aria-label="Velocidad de la simulación">
          {SPEEDS.map((s) => (
            <button key={s.id} type="button" className={speed === s.id ? 'on' : ''} aria-pressed={speed === s.id}
              aria-label={s.label} title={s.label} data-speed={s.id} onClick={() => controller.setSpeed(s.id)}>
              <SpeedIcon id={s.id} />
            </button>
          ))}
        </div>
        <button type="button" className={`icon-btn tb-options${optionsOpen ? ' on' : ''}`} data-tab="game" aria-label="Partida: guardar, cargar y opciones" onClick={onOptions}>
          <Icon name="options" />
        </button>
      </div>
    </header>
  );
}
