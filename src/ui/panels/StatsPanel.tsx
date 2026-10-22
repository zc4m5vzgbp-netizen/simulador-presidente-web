import { useState } from 'react';
import type { CountryId, GameState } from '../../engine/types';
import { COUNTRY_IDS, countryName } from '../../engine/world';
import { countryPower, unitsOf } from '../../engine/military';
import { getRelation } from '../../engine/diplomacy';
import { Flag } from '../widgets';
import { money, people, signedPct, int } from '../format';

type Col = 'gdp' | 'population' | 'growth' | 'stability' | 'debt' | 'units' | 'power' | 'relation';

const COLS: { id: Col; label: string }[] = [
  { id: 'gdp', label: 'PIB' },
  { id: 'population', label: 'Población' },
  { id: 'growth', label: 'Crec.' },
  { id: 'stability', label: 'Estab.' },
  { id: 'debt', label: 'Deuda/PIB' },
  { id: 'units', label: 'Bat.' },
  { id: 'power', label: 'Fuerza' },
  { id: 'relation', label: 'Relación' },
];

/** Comparativa de los 12 países con datos del estado actual de la partida. */
export function StatsPanel({ state, onPick }: { state: GameState; onPick: (c: CountryId) => void }) {
  const [sort, setSort] = useState<Col>('gdp');
  const me = state.player;
  const rows = COUNTRY_IDS.map((c) => {
    const s = state.countries[c];
    return {
      c,
      gdp: s.gdp,
      population: s.population,
      growth: s.growth,
      stability: s.stability,
      debt: s.gdp > 0 ? (s.debt / s.gdp) * 100 : 0,
      units: unitsOf(state, c).length,
      power: countryPower(state, c),
      relation: c === me ? 101 : getRelation(state, me, c),
      eliminated: s.eliminated,
    };
  }).sort((a, b) => b[sort] - a[sort]);

  const fmt = (col: Col, r: (typeof rows)[number]) => {
    switch (col) {
      case 'gdp': return money(r.gdp);
      case 'population': return people(r.population);
      case 'growth': return signedPct(r.growth);
      case 'stability': return int(r.stability);
      case 'debt': return `${int(r.debt)} %`;
      case 'units': return r.units;
      case 'power': return r.power.toFixed(0);
      case 'relation': return r.c === me ? '—' : `${r.relation > 0 ? '+' : ''}${int(r.relation)}`;
    }
  };

  return (
    <div className="panel-body">
      <p className="muted small-text">Datos actuales de la partida. Toca una columna para ordenar y un país para verlo en el mapa.</p>
      <div className="table-wrap">
        <table className="stats">
          <thead>
            <tr>
              <th scope="col">País</th>
              {COLS.map((col) => (
                <th key={col.id} scope="col" aria-sort={sort === col.id ? 'descending' : undefined}>
                  <button type="button" className={sort === col.id ? 'on' : ''} onClick={() => setSort(col.id)}>{col.label}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.c} className={`${r.c === me ? 'me' : ''}${r.eliminated ? ' gone' : ''}`}>
                <th scope="row"><button type="button" className="link-btn inline" onClick={() => onPick(r.c)}><Flag c={r.c} /> {countryName(r.c)}</button></th>
                {COLS.map((col) => <td key={col.id} className="num">{fmt(col.id, r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
