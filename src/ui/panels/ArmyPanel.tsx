import { useState } from 'react';
import type { GameState } from '../../engine/types';
import { REGIONS, countryName } from '../../engine/world';
import { countryPower, recruitCost, unitsOf, upkeepNeeded } from '../../engine/military';
import { annualFlows } from '../../engine/economy';
import { warsOf } from '../../engine/war';
import { controller } from '../controller';
import { ConfirmButton, CountryTag, Meter, Section, Stat } from '../widgets';
import { money, pct, int } from '../format';
import { UnitCard } from './RegionPanel';

export function ArmyPanel({ state, onFocusUnit }: { state: GameState; onFocusUnit: (unitId: string) => void }) {
  const me = state.player;
  const c = state.countries[me];
  const units = unitsOf(state, me);
  const ownRegions = Object.values(state.regions).filter((r) => r.owner === me && r.controller === me).map((r) => r.id);
  const [recruitAt, setRecruitAt] = useState(ownRegions[0] ?? '');
  const need = upkeepNeeded(state, me);
  const mil = annualFlows(state, me).military;
  const wars = warsOf(state, me);
  const battles = Object.values(state.battles).filter((b) => b.participants.includes(me));

  return (
    <div className="panel-body">
      <div className="stat-grid">
        <Stat label="Batallones" value={units.length} sub={`${int(units.reduce((s, u) => s + u.men, 0))} efectivos`} />
        <Stat label="Fuerza total" value={countryPower(state, me).toFixed(0)} />
        <Stat label="Presupuesto militar" value={`${money(mil)}/año`} sub={pct(c.policy.militaryBudget) + ' del PIB'} />
        <Stat label="Mantenimiento" value={`${money(need)}/año`} sub={`${money(c.unitCost)} por batallón`} />
      </div>
      <Section title="Abastecimiento" aside={<span className="num">{pct(Math.min(c.supplyRatio, 9.99) * 100, 0)}</span>}>
        <Meter value={Math.min(c.supplyRatio, 1.5)} max={1.5} tone={c.supplyRatio < 0.7 ? 'bad' : c.supplyRatio < 1 ? 'warn' : 'good'} label="Abastecimiento" />
        {c.supplyRatio < 1 && <p className="notice warn">El presupuesto militar no cubre el mantenimiento: la organización baja{c.supplyRatio < 0.6 ? ' y las tropas sufren bajas por desabastecimiento' : ''}. Sube el presupuesto en Economía o desmoviliza batallones.</p>}
        <p className="muted small-text">Bajas acumuladas: {int(c.casualties)} efectivos.</p>
      </Section>

      <Section title="Reclutar">
        {ownRegions.length ? (
          <div className="row">
            <select id="recruit-region" value={recruitAt} onChange={(e) => setRecruitAt(e.target.value)}>
              {ownRegions.map((id) => <option key={id} value={id}>{REGIONS[id].name}</option>)}
            </select>
            <button type="button" className="primary" onClick={() => controller.act({ type: 'recruit', regionId: recruitAt })}>Reclutar · {money(recruitCost(state, me))}</button>
          </div>
        ) : <p className="muted">No controlas regiones propias donde reclutar.</p>}
        <p className="muted small-text">1.000 efectivos, 15 días de entrenamiento. Aumenta el mantenimiento anual.</p>
      </Section>

      {wars.length > 0 && (
        <Section title="Guerras activas">
          {wars.map((w) => (
            <div key={w.id} className="war-card">
              <strong>{w.name}</strong>
              <div className="war-sides">
                <div>{w.attackers.map((a) => <CountryTag key={a} c={a} />)}</div>
                <span className="vs">contra</span>
                <div>{w.defenders.map((d) => <CountryTag key={d} c={d} />)}</div>
              </div>
              <div className="muted small-text">Bajas: {Object.entries(w.casualties).map(([k, v]) => `${countryName(k as never)} ${int(v ?? 0)}`).join(' · ') || 'ninguna aún'}</div>
            </div>
          ))}
          {battles.length > 0 && <p className="notice bad">Batallas en curso: {battles.map((b) => REGIONS[b.regionId].name).join(', ')}</p>}
        </Section>
      )}

      <Section title="Tus batallones">
        <div className="unit-list">
          {units.map((u) => (
            <div key={u.id} className="unit-row">
              <UnitCard state={state} u={u} onToggle={() => onFocusUnit(u.id)} />
              <ConfirmButton className="small ghost" label="Desmovilizar" confirmLabel="Sí, desmovilizar" onConfirm={() => controller.act({ type: 'disband', unitId: u.id })} />
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
