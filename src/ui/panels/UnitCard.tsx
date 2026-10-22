import type { GameState, Unit } from '../../engine/types';
import { REGIONS } from '../../engine/world';
import { unitPower } from '../../engine/military';
import { Meter } from '../widgets';
import { int, STATUS_LABEL } from '../format';

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
