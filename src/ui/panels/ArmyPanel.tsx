import { useState } from 'react';
import type { GameState } from '../../engine/types';
import { REGIONS, countryName } from '../../engine/world';
import { countryPower, recruitCost, unitsOf, upkeepNeeded } from '../../engine/military';
import { BATTALION_TEMPLATE, RECRUITMENT, nationalEquipment, unitsTotals } from '../../engine/equipment';
import { CATEGORY_LABEL } from '../../data/military';
import { annualFlows } from '../../engine/economy';
import { warsOf } from '../../engine/war';
import { controller } from '../controller';
import { ConfirmButton, CountryTag, Meter, Section, Stat } from '../widgets';
import { money, pct, int } from '../format';
import { UnitCard } from './UnitCard';
import { Silhouette } from '../military/Silhouette';

type Branch = 'land' | 'air' | 'navy';
const BRANCHES: { id: Branch; label: string; pending?: string }[] = [
  { id: 'land', label: 'Tierra' },
  { id: 'air', label: 'Aire', pending: 'Aviación: fase 4 del plan. Todavía no existe en el juego.' },
  { id: 'navy', label: 'Armada', pending: 'Armada: fase 5 del plan. Todavía no existe en el juego.' },
];

export function ArmyPanel({ state, onFocusUnit }: { state: GameState; onFocusUnit: (unitId: string) => void }) {
  const me = state.player;
  const c = state.countries[me];
  const units = unitsOf(state, me);
  const ownRegions = Object.values(state.regions).filter((r) => r.owner === me && r.controller === me).map((r) => r.id);
  const [recruitAt, setRecruitAt] = useState(ownRegions[0] ?? '');
  const [count, setCount] = useState(1);
  const [branch, setBranch] = useState<Branch>('land');
  const need = upkeepNeeded(state, me);
  const mil = annualFlows(state, me).military;
  const wars = warsOf(state, me);
  const battles = Object.values(state.battles).filter((b) => b.participants.includes(me));
  const totals = unitsTotals(units);
  const inventory = nationalEquipment(state, me);
  const days = Math.ceil((BATTALION_TEMPLATE.maxMen - RECRUITMENT.initialMen) / RECRUITMENT.menPerDay);

  return (
    <div className="panel-body">
      <div className="stat-grid">
        <Stat label="Batallones" value={units.length} sub={`${int(totals.men)} efectivos${totals.pending ? ` · +${int(totals.pending)} en camino` : ''}`} />
        <Stat label="Fuerza total" value={countryPower(state, me).toFixed(0)} />
        <Stat label="Presupuesto militar" value={`${money(mil)}/año`} sub={pct(c.policy.militaryBudget) + ' del PIB'} />
        <Stat label="Mantenimiento" value={`${money(need)}/año`} sub={`${money(c.unitCost)} por batallón`} />
      </div>
      <Section title="Abastecimiento" aside={<span className="num">{pct(Math.min(c.supplyRatio, 9.99) * 100, 0)}</span>}>
        <Meter value={Math.min(c.supplyRatio, 1.5)} max={1.5} tone={c.supplyRatio < 0.7 ? 'bad' : c.supplyRatio < 1 ? 'warn' : 'good'} label="Abastecimiento" />
        {c.supplyRatio < 1 && <p className="notice warn">El presupuesto militar no cubre el mantenimiento{c.supplyRatio < 0.6 ? ' y las tropas sufren bajas por desabastecimiento' : ''}. Sube el presupuesto en Economía o desmoviliza batallones.</p>}
        <p className="muted small-text">Bajas acumuladas: {int(c.casualties)} efectivos.</p>
      </Section>

      <Section title="Reclutar voluntarios">
        {ownRegions.length ? (
          <div className="recruit-row">
            <select id="recruit-region" aria-label="Región de reclutamiento" value={recruitAt} onChange={(e) => setRecruitAt(e.target.value)}>
              {ownRegions.map((id) => <option key={id} value={id}>{REGIONS[id].name}</option>)}
            </select>
            <div className="stepper" role="group" aria-label="Número de batallones">
              <button type="button" aria-label="Menos" disabled={count <= 1} onClick={() => setCount(count - 1)}>−</button>
              <span data-testid="recruit-count">{count}</span>
              <button type="button" aria-label="Más" disabled={count >= RECRUITMENT.maxPerOrder} onClick={() => setCount(count + 1)}>+</button>
            </div>
            <button type="button" className="primary" data-action="recruit" onClick={() => controller.act({ type: 'recruit', regionId: recruitAt, count })}>
              Reclutar {count} · {money(recruitCost(state, me) * count)}
            </button>
          </div>
        ) : <p className="muted">No controlas regiones propias donde reclutar.</p>}
        <p className="muted small-text">Sin entrenamiento obligatorio: cada batallón es operativo desde el primer día con {RECRUITMENT.initialMen} voluntarios y se completa con {RECRUITMENT.menPerDay} al día (≈ {days} días). Recibe equipo de las reservas. <em>Ritmo provisional.</em></p>
      </Section>

      <Section title="Reposición automática" aside={
        <label className="switch">
          <input type="checkbox" id="auto-replenish" checked={c.autoReplenish} onChange={(e) => controller.act({ type: 'setAutoReplenish', enabled: e.target.checked })} />
          <span>{c.autoReplenish ? 'Activa' : 'En pausa'}</span>
        </label>
      }>
        <p className="muted small-text">Cada día, los batallones en territorio propio y fuera de combate cubren sus bajas (se pagan como reclutamiento) y completan su equipo con las reservas nacionales. Nunca se crea equipo: solo se reparte el que hay.</p>
      </Section>

      <Section title="Inventario nacional">
        <div className="seg" role="tablist" aria-label="Ramas">
          {BRANCHES.map((b) => (
            <button key={b.id} type="button" role="tab" aria-selected={branch === b.id} className={branch === b.id ? 'on' : ''} data-branch={b.id} onClick={() => setBranch(b.id)}>{b.label}</button>
          ))}
        </div>
        {branch === 'land' ? (
          <>
            <ul className="inv-list" data-testid="inventory-land">
              {inventory.map(({ model, assigned, reserve }) => (
                <li key={model.id} className="inv-item" data-model={model.id}>
                  <Silhouette kind={model.category} width={40} />
                  <div className="inv-main">
                    <div className="inv-name">{CATEGORY_LABEL[model.category].many} <span className="inv-id">{model.id}</span>{model.provisional && <span className="chip prov-chip">Provisional</span>}</div>
                    <div className="inv-figs">
                      <span><b>{int(assigned)}</b> en batallones</span>
                      <span><b data-testid={`reserve-${model.id}`}>{int(reserve)}</b> en reserva</span>
                    </div>
                    <div className="inv-stats muted">Tripulación {model.crew} · Fuego {model.stats.firepower} · Protección {model.stats.protection} · Movilidad {model.stats.mobility}</div>
                  </div>
                </li>
              ))}
            </ul>
            <p className="notice prov small-text">Modelos, estadísticas, tripulaciones y cantidades son <strong>datos provisionales de prueba</strong>, no equipos reales. Las estadísticas aún no influyen en el combate (fase 2). Fabricación y compra: fase 3.</p>
          </>
        ) : (
          <p className="notice muted" data-testid={`branch-pending-${branch}`}>{BRANCHES.find((b) => b.id === branch)!.pending}</p>
        )}
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
