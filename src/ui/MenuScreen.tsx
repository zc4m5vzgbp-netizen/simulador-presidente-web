import { useState } from 'react';
import type { CountryId } from '../engine/types';
import { COUNTRY_IDS, MAP, REGIONS } from '../engine/world';
import { COUNTRY_DEFS } from '../data/countries';
import { formatDate } from '../engine/core';
import { controller } from './controller';
import { money, people } from './format';
import { tryLockLandscape } from './layout/viewport';

export function MenuScreen() {
  const [choice, setChoice] = useState<CountryId>('ARG');
  const d = COUNTRY_DEFS[choice];
  const saves = controller.saves;
  const latest = saves[0];

  return (
    <div className="menu">
      <section className="menu-left">
        <header className="menu-head">
          <p className="eyebrow">Beta 1.0 · Sudamérica · 2027</p>
          <h1>Simulador de Presidente</h1>
          <p className="lede">Gobierna la economía, negocia con tus vecinos y defiende tu territorio. Un día de juego dura un minuto.</p>
        </header>
        <div className="menu-map" aria-hidden="true">
          <svg viewBox={`-20 -10 ${MAP.width + 40} ${MAP.height + 20}`} preserveAspectRatio="xMidYMid meet">
            {MAP.neutral.map((n) => <path key={n.name} d={n.path} className="neutral" />)}
            {COUNTRY_IDS.map((c) => (
              <path key={c} d={MAP.countries[c]} fill={COUNTRY_DEFS[c].color}
                className={`menu-country${c === choice ? ' chosen' : ''}`} onClick={() => setChoice(c)} />
            ))}
            {Object.values(REGIONS).filter((r) => r.capital && r.country === choice).map((r) => (
              <circle key={r.id} cx={r.anchor[0]} cy={r.anchor[1]} r={11} className="menu-capital" />
            ))}
          </svg>
        </div>
      </section>

      <section className="menu-right">
        {latest && (
          <div className="continue">
            <div>
              <span className="eyebrow">Última partida</span>
              <strong>{COUNTRY_DEFS[latest.player].name} · {formatDate(latest.hour)}</strong>
            </div>
            <button type="button" className="primary" onClick={() => { tryLockLandscape(); controller.load(latest.slot); }}>Continuar</button>
          </div>
        )}

        <h2 className="pick-title">Elige tu país</h2>
        <ul className="pick" role="listbox" aria-label="Países">
          {COUNTRY_IDS.map((c) => (
            <li key={c}>
              <button type="button" role="option" aria-selected={c === choice} className={`pick-item${c === choice ? ' on' : ''}`}
                data-country={c} onClick={() => setChoice(c)}>
                <span className="pick-swatch" style={{ background: COUNTRY_DEFS[c].color }} />
                {COUNTRY_DEFS[c].name}
              </button>
            </li>
          ))}
        </ul>

        <div className="dossier">
          <h3>{d.name}</h3>
          <dl>
            <div><dt>PIB</dt><dd>{money(d.gdp)}</dd></div>
            <div><dt>Población</dt><dd>{people(d.pop)}</dd></div>
            <div><dt>Deuda</dt><dd>{Math.round(d.debt / d.gdp * 100)} % del PIB</dd></div>
            <div><dt>Estabilidad</dt><dd>{d.stability} / 100</dd></div>
            <div><dt>Batallones</dt><dd>{d.units}</dd></div>
            <div><dt>Crecimiento</dt><dd>{d.growth.toLocaleString('es-ES')} % anual</dd></div>
          </dl>
          <p className="muted small-text">Cifras iniciales simplificadas y estimadas para el juego.</p>
          <button type="button" className="primary big" data-testid="start" onClick={() => { tryLockLandscape(); controller.newGame(choice); }}>Gobernar {d.name}</button>
        </div>
      </section>
    </div>
  );
}
