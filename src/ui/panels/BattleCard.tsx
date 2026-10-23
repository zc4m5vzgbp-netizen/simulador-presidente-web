/**
 * Panel contextual de una batalla (MIL-139/141): en curso o terminada.
 * Bajas humanas, vehículos dañados y destruidos, suministros consumidos,
 * evolución de efectivos y batallones implicados. Retirada manual.
 */
import type { Battle, BattleReport, CountryId, GameState } from '../../engine/types';
import { REGIONS, countryName } from '../../engine/world';
import { formatDate } from '../../engine/core';
import { atWar } from '../../engine/war';
import { EQUIP_CATEGORIES } from '../../engine/equipment';
import { CATEGORY_LABEL } from '../../data/military';
import type { Selection } from '../selection';
import { controller } from '../controller';
import { FlagIcon } from '../flags';
import { int } from '../format';
import { Silhouette } from '../military/Silhouette';
import { Fact, InfoCard } from './InfoCard';
import { formatDuration } from './UnitCard';

export function findBattle(state: GameState, battleId: string): { battle: Battle | BattleReport; live: boolean } | null {
  const live = Object.values(state.battles).find((b) => b.id === battleId);
  if (live) return { battle: live, live: true };
  const report = state.battleReports.find((b) => b.id === battleId);
  return report ? { battle: report, live: false } : null;
}

const sum = (o: Partial<Record<string, number>>) => Object.values(o).reduce<number>((x, y) => x + (y ?? 0), 0);
const loads = (n: number) => n.toLocaleString('es', { maximumFractionDigits: 1 });

/** Evolución de efectivos de cada país durante la batalla (línea por país). */
const SIDE_COLOR = { mine: '#5aa7ee', enemy: '#ee6a5f', other: '#74c587' } as const;

function Timeline({ b, sideOf }: { b: Battle; sideOf: (c: CountryId) => keyof typeof SIDE_COLOR }) {
  const pts = b.timeline;
  if (pts.length < 2) return <p className="muted small-text">La evolución aparecerá tras unas horas de combate.</p>;
  const W = 300, H = 74, pad = 4;
  const max = Math.max(1, ...pts.flatMap((p) => Object.values(p.men).map((v) => v ?? 0)));
  const x = (i: number) => pad + (i / (pts.length - 1)) * (W - 2 * pad);
  const y = (v: number) => H - pad - (v / max) * (H - 2 * pad);
  return (
    <figure className="battle-chart" aria-label="Evolución de efectivos en combate">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img">
        <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} className="axis" />
        {b.participants.map((c) => (
          <polyline key={c} fill="none" stroke={SIDE_COLOR[sideOf(c)]} strokeWidth={2} vectorEffect="non-scaling-stroke"
            points={pts.map((p, i) => `${x(i)},${y(p.men[c] ?? 0)}`).join(' ')} data-series={c} />
        ))}
      </svg>
      <figcaption className="muted small-text">
        Efectivos en combate · {formatDuration(b.lastHour - b.startHour + 1)}
        <span className="chart-legend">{b.participants.map((c) => <span key={c}><i style={{ background: SIDE_COLOR[sideOf(c)] }} />{countryName(c)}</span>)}</span>
      </figcaption>
    </figure>
  );
}

export function BattleCard({ state, battleId, setSelection }: { state: GameState; battleId: string; setSelection: (s: Selection) => void }) {
  const found = findBattle(state, battleId);
  if (!found) return null;
  const { battle: b, live } = found;
  const me = state.player;
  const myUnits = live ? Object.values(state.units).filter((u) => u.owner === me && u.regionId === b.regionId && u.status === 'combat') : [];
  const end = live ? b.lastHour : (b as BattleReport).endHour;
  const winners = live ? [] : (b as BattleReport).winners;
  const units = Object.entries(b.entry).map(([id, e]) => ({ id, ...e, now: state.units[id] }));

  return (
    <InfoCard kind="battle-card" kicker={live ? 'Batalla en curso' : 'Informe de batalla'} icon="swords" title={`Batalla de ${REGIONS[b.regionId].name}`}
      meta={<span className="muted">{formatDate(b.startHour, true)} → {live ? 'en curso' : formatDate(end, true)}</span>}
      onClose={() => setSelection({ kind: 'region', regionId: b.regionId })} closeLabel="Cerrar batalla">
      {!live && <Fact label="Resultado" value={winners.length ? `Victoria de ${winners.map(countryName).join(' y ')}` : 'Sin vencedor claro'} />}
      {myUnits.length > 0 && (
        <div className="card-actions">
          <button type="button" className="danger" data-action="retreat-all"
            onClick={() => controller.actBatch(myUnits.map((u) => ({ type: 'retreat' as const, unitId: u.id })), (n) => `${n} batallón(es) en retirada.`)}>
            Retirar mis batallones ({myUnits.length})
          </button>
        </div>
      )}
      <div className="battle-sides">
        {b.participants.map((c: CountryId) => {
          const t = b.tally[c] ?? { damaged: {}, destroyed: {}, fuel: 0, ammo: 0 };
          const side = me === c ? 'mine' : atWar(state, me, c) ? 'enemy' : 'other';
          return (
            <div key={c} className={`battle-side ${side}`} data-battle-country={c}>
              <div className="bs-head"><FlagIcon c={c} size={20} /> <strong>{countryName(c)}</strong></div>
              <div className="bs-figs">
                <span><b data-testid={`losses-${c}`}>{int(b.losses[c] ?? 0)}</b> bajas</span>
                <span><b>{sum(t.destroyed)}</b> vehículos destruidos</span>
                <span><b>{sum(t.damaged)}</b> dañados</span>
              </div>
              {(sum(t.destroyed) + sum(t.damaged)) > 0 && (
                <div className="bs-equip">
                  {EQUIP_CATEGORIES.filter((cat) => (t.destroyed[cat] ?? 0) + (t.damaged[cat] ?? 0) > 0).map((cat) => (
                    <span key={cat} className="bs-cat" title={CATEGORY_LABEL[cat].many}>
                      <Silhouette kind={cat} width={22} /> {t.destroyed[cat] ?? 0}<span className="muted">/{t.damaged[cat] ?? 0}</span>
                    </span>
                  ))}
                </div>
              )}
              <div className="muted small-text">Consumo: {loads(t.ammo)} cargas de munición · {loads(t.fuel)} de combustible</div>
            </div>
          );
        })}
      </div>
      <p className="muted small-text">Vehículos: destruidos/dañados por tipo. Una «carga» es la dotación completa de un batallón.</p>
      <Timeline b={b} sideOf={(c) => (c === me ? 'mine' : atWar(state, me, c) ? 'enemy' : 'other')} />
      <div className="ic-sec">Batallones implicados</div>
      <ul className="battle-units">
        {units.map((u) => (
          <li key={u.id} className={u.now ? '' : 'gone'}>
            <FlagIcon c={u.owner} size={16} />
            <span className="bu-name">{u.now ? u.now.name : 'Batallón destruido o rendido'}</span>
            <span className="bu-men">{int(u.men)} → {u.now ? int(u.now.men) : 0}</span>
            {u.now?.status === 'retreating' && <span className="chip st-retreating">En retirada</span>}
          </li>
        ))}
      </ul>
      <p className="muted small-text">Combate por intervalos de una hora. Sin terreno, fortificaciones, bonificación defensiva ni moral. Coeficientes provisionales.</p>
    </InfoCard>
  );
}
