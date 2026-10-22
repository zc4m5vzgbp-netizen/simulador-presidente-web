import type { CountryId, GameState, Unit } from '../../engine/types';
import { REGIONS, countryName } from '../../engine/world';
import { atWar } from '../../engine/war';
import { recruitCost, unitPower, unitsIn } from '../../engine/military';
import { controller } from '../controller';
import { CountryTag, Meter, Section } from '../widgets';
import { money, people, int, STATUS_LABEL } from '../format';

export function UnitCard({ state, u, selected, onToggle }: { state: GameState; u: Unit; selected?: boolean; onToggle?: () => void }) {
  const dest = u.destination ? REGIONS[u.destination].name : null;
  return (
    <button type="button" className={`unit-card${selected ? ' selected' : ''}`} onClick={onToggle} disabled={!onToggle} data-unit-id={u.id}>
      <span className="unit-top">
        <span className="unit-name">{u.name}</span>
        <span className={`chip st-${u.status}`}>{STATUS_LABEL[u.status]}</span>
      </span>
      <span className="unit-meta">
        {int(u.men)} efectivos · fuerza {unitPower(state, u).toFixed(1)} · {REGIONS[u.regionId].name}
        {dest && ` → ${dest}`}
        {u.status === 'training' && ` · listo en ${Math.ceil(u.trainingHours / 24)} d`}
      </span>
      <span className="unit-bars">
        <span>Org.</span><Meter value={u.org} tone={u.org < 30 ? 'bad' : u.org < 60 ? 'warn' : 'good'} label="Organización" />
        <span>Moral</span><Meter value={u.morale} tone={u.morale < 35 ? 'bad' : 'accent'} label="Moral" />
      </span>
    </button>
  );
}

interface Props {
  state: GameState;
  regionId: string;
  selectedUnits: string[];
  setSelectedUnits: (ids: string[]) => void;
  startOrder: (ids: string[]) => void;
}

export function RegionPanel({ state, regionId, selectedUnits, setSelectedUnits, startOrder }: Props) {
  const reg = REGIONS[regionId];
  const r = state.regions[regionId];
  const player = state.player;
  const units = unitsIn(state, regionId);
  const mine = units.filter((u) => u.owner === player);
  const others = units.filter((u) => u.owner !== player);
  const byOwner = new Map<CountryId, Unit[]>();
  for (const u of others) byOwner.set(u.owner, [...(byOwner.get(u.owner) ?? []), u]);
  const battle = state.battles[regionId];
  const canRecruit = r.owner === player && r.controller === player;
  const need = reg.capital ? 48 : 24;
  const orderable = mine.filter((u) => u.status !== 'training' && u.status !== 'retreating');

  return (
    <div className="panel-body">
      <header className="region-head">
        <div>
          <h2>{reg.name}{reg.capital && <span className="cap-mark" title="Capital">capital</span>}</h2>
          <div className="region-sub">
            <CountryTag c={r.owner} />
            {r.controller !== r.owner && <span className="occupied">ocupada por {countryName(r.controller)}</span>}
            {atWar(state, player, r.controller) && <span className="chip war">enemigo</span>}
          </div>
        </div>
        <div className="region-figs">
          <span>{money(r.gdp)}</span>
          <span>{people(r.population)}</span>
        </div>
      </header>

      {r.occupationHours > 0 && r.occupier && (
        <p className="notice warn">
          {countryName(r.occupier)} está tomando el control: {Math.round((r.occupationHours / need) * 100)} %
        </p>
      )}
      {battle && (
        <p className="notice bad">
          Batalla en curso desde hace {Math.max(1, Math.round((state.hour - battle.startHour)))} h. Bajas: {Object.entries(battle.losses).map(([c, n]) => `${countryName(c as CountryId)} ${int(n)}`).join(' · ')}
        </p>
      )}

      <Section title={`Tus batallones (${mine.length})`} aside={orderable.length > 0 && (
        <button type="button" className="small primary" onClick={() => startOrder(orderable.map((u) => u.id))}>Mover todos</button>
      )}>
        {mine.length === 0 && <p className="muted">No tienes tropas aquí.</p>}
        <div className="unit-list">
          {mine.map((u) => (
            <UnitCard key={u.id} state={state} u={u} selected={selectedUnits.includes(u.id)}
              onToggle={() => setSelectedUnits(selectedUnits.includes(u.id) ? selectedUnits.filter((x) => x !== u.id) : [...selectedUnits, u.id])} />
          ))}
        </div>
        {selectedUnits.length > 0 && (
          <div className="row">
            <button type="button" className="primary" onClick={() => startOrder(selectedUnits)}>Dar orden de marcha ({selectedUnits.length})</button>
          </div>
        )}
      </Section>

      {byOwner.size > 0 && (
        <Section title="Otras tropas">
          <ul className="plain">
            {[...byOwner.entries()].map(([c, us]) => (
              <li key={c} className="row-between">
                <CountryTag c={c} />
                <span className="num">{us.length} bat. · {int(us.reduce((s, u) => s + u.men, 0))} efectivos · fuerza {us.reduce((s, u) => s + unitPower(state, u), 0).toFixed(1)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {canRecruit && (
        <div className="row">
          <button type="button" onClick={() => controller.act({ type: 'recruit', regionId })}>
            Reclutar batallón aquí · {money(recruitCost(state, player))}
          </button>
        </div>
      )}
    </div>
  );
}
