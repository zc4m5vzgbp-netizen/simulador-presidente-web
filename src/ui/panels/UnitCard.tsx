/**
 * Ficha de batallón (MIL-143/144): efectivos, equipo por categoría con siluetas,
 * tripulación automática, estado y duración de la marcha. Sin indicador de
 * preparación 0–100 (MIL-032 A) ni experiencia (MIL-039 A).
 */
import type { GameState, Unit } from '../../engine/types';
import { REGIONS } from '../../engine/world';
import { etaHours, unitPower } from '../../engine/military';
import { SUPPLY } from '../../data/military';
import { BATTALION_TEMPLATE, EQUIP_CATEGORIES, crewReport, modelOf, type EquipCategory } from '../../engine/equipment';
import { CATEGORY_LABEL } from '../../data/military';
import { int, STATUS_LABEL } from '../format';
import { atWar, sameSide } from '../../engine/war';
import { MilitarySymbolIcon } from '../military/MilitarySymbol';
import { Silhouette } from '../military/Silhouette';
import { UNIT_ECHELON, affiliationOf, unitCategory } from '../military/symbology';

/** Indicador discreto de suministros: 5 segmentos (MIL-140). */
export function SupplyPips({ label, value, testId }: { label: string; value: number; testId: string }) {
  const on = Math.round(value * 5);
  return (
    <span className={`pips${value < SUPPLY.shortage ? ' low' : ''}`} data-testid={testId} data-value={value.toFixed(2)} aria-label={`${label}: ${Math.round(value * 100)} %`}>
      <span className="pips-label">{label}</span>
      {[0, 1, 2, 3, 4].map((i) => <span key={i} className={i < on ? 'pip on' : 'pip'} />)}
    </span>
  );
}

import { formatGameDuration } from '../arrival';
/** Duración en tiempo de juego: «2 d 5 h». */
export const formatDuration = formatGameDuration;

export interface EquipRow { kind: EquipCategory | 'infantry'; total: number; active: number; damaged?: number; max: number }

/** Rejilla ilustrada: infantería + las cinco categorías de la plantilla. */
export function EquipmentGrid({ rows, testId }: { rows: EquipRow[]; testId?: string }) {
  return (
    <ul className="equip-grid" data-testid={testId}>
      {rows.map((r) => {
        const damaged = r.damaged ?? 0;
        const inactive = r.total - damaged - r.active;
        const label = r.kind === 'infantry' ? 'Infantería' : CATEGORY_LABEL[r.kind].many;
        return (
          <li key={r.kind} className={`equip-row${r.total === 0 ? ' empty' : ''}`} data-equip={r.kind}>
            <Silhouette kind={r.kind} width={34} />
            <span className="equip-label">{label}</span>
            <span className="equip-count">
              <strong data-testid={`equip-${r.kind}`}>{int(r.total)}</strong>
              <span className="equip-max">/{int(r.max)}</span>
            </span>
            <span className="equip-bar" aria-hidden="true">
              <span className="equip-bar-active" style={{ width: `${(100 * r.active) / Math.max(1, r.max)}%` }} />
              <span className="equip-bar-idle" style={{ width: `${(100 * inactive) / Math.max(1, r.max)}%` }} />
              <span className="equip-bar-damaged" style={{ width: `${(100 * damaged) / Math.max(1, r.max)}%` }} />
            </span>
            {(inactive > 0 || damaged > 0) && (
              <span className="equip-note">
                {inactive > 0 && <span className="warn-text" data-testid={`inactive-${r.kind}`}>{int(inactive)} sin tripulación</span>}
                {damaged > 0 && <span className="bad-text" data-testid={`damaged-${r.kind}`}>{int(damaged)} dañados</span>}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function unitRows(u: Unit): EquipRow[] {
  const r = crewReport(u);
  return [
    { kind: 'infantry', total: r.infantry, active: r.infantry, max: BATTALION_TEMPLATE.maxMen },
    ...EQUIP_CATEGORIES.map((cat) => ({ kind: cat, ...r.byCategory[cat] })),
  ];
}

export function UnitCard({ state, u, selected, onToggle, detail }: { state: GameState; u: Unit; selected?: boolean; onToggle?: () => void; detail?: boolean }) {
  const dest = u.destination ? REGIONS[u.destination].name : null;
  const me = state.player;
  const aff = affiliationOf(u.owner === me ? 'mine' : atWar(state, u.owner, me) ? 'enemy' : sameSide(state, u.owner, me) ? 'ally' : 'other');
  const report = crewReport(u);
  const incomplete = u.men < BATTALION_TEMPLATE.maxMen;
  const body = (
    <>
      <span className="unit-top">
        <MilitarySymbolIcon category={unitCategory(u)} affiliation={aff} echelon={UNIT_ECHELON} size={26} />
        <span className="unit-name">{u.name}</span>
        <span className={`chip st-${u.status}`}>{STATUS_LABEL[u.status]}</span>
      </span>
      <span className="unit-meta">
        <span data-testid="unit-men">{int(u.men)}</span> efectivos{incomplete && <span className="muted"> de {int(BATTALION_TEMPLATE.maxMen)}</span>} · {REGIONS[u.regionId].name}
        {dest && <> → {dest} <span className="eta" data-testid="unit-eta">· llega en {formatDuration(etaHours(state, u))}</span></>}
      </span>
      {u.recruitPending > 0 && <span className="unit-meta recruiting" data-testid="unit-pending">+{int(u.recruitPending)} voluntarios por incorporarse</span>}
      {(u.ammo < SUPPLY.shortage || u.fuel < SUPPLY.shortage) && !detail && (
        <span className="unit-meta shortage">{u.ammo < SUPPLY.shortage ? 'Escasez de munición' : 'Escasez de combustible'}</span>
      )}
      {!detail && (
        <span className="equip-mini" aria-label="Equipo">
          {EQUIP_CATEGORIES.map((cat) => (
            <span key={cat} className={`mini${report.byCategory[cat].total ? '' : ' empty'}`} title={CATEGORY_LABEL[cat].many}>
              <Silhouette kind={cat} width={22} /> {report.byCategory[cat].total}
            </span>
          ))}
        </span>
      )}
    </>
  );
  if (detail) {
    const models = Object.entries(u.equipment).map(([id, q]) => ({ m: modelOf(id), q })).filter((x) => x.q > 0);
    return (
      <div className={`unit-card detail${selected ? ' selected' : ''}`} data-unit-id={u.id}>
        {body}
        <div className="unit-supply">
          <span className="unit-power">Potencia <strong data-testid="unit-power">{unitPower(state, u).toLocaleString('es', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</strong></span>
          <SupplyPips label="Munición" value={u.ammo} testId="ammo" />
          <SupplyPips label="Combustible" value={u.fuel} testId="fuel" />
        </div>
        <EquipmentGrid rows={unitRows(u)} testId="unit-equipment" />
        <p className="muted small-text">Tripulación asignada automáticamente: {int(report.crew)} efectivos{report.crewNeeded > report.crew ? ` (faltan ${int(report.crewNeeded - report.crew)})` : ''}. El resto es infantería.</p>
        {models.length > 0 && (
          <div className="unit-models">
            {models.map(({ m, q }) => (
              <span key={m.id} className="model-chip">{q} × {m.name}{m.provisional && <em className="prov"> provisional</em>}</span>
            ))}
          </div>
        )}
      </div>
    );
  }
  return (
    <button type="button" className={`unit-card${selected ? ' selected' : ''}`} onClick={onToggle} disabled={!onToggle} data-unit-id={u.id}>
      {body}
    </button>
  );
}
