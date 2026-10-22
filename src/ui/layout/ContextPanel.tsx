/**
 * Panel de información contextual (zona derecha) según la selección:
 * país, región o batallón(es). Solo muestra datos del estado real del juego.
 */
import { useEffect, useState } from 'react';
import type { CountryId, GameState, Unit } from '../../engine/types';
import { REGIONS, countryName } from '../../engine/world';
import { atWar, sameSide, warsOf, inTruce } from '../../engine/war';
import { getRelation, hasTrade } from '../../engine/diplomacy';
import { countryPower, recruitCost, unitPower, unitsIn, unitsOf } from '../../engine/military';
import { annualFlows } from '../../engine/economy';
import { regionsControlledBy } from '../../engine/territory';
import { controller } from '../controller';
import type { Selection } from '../selection';
import { ConfirmButton, CountryTag, Meter, RelationBar, Section, Stat } from '../widgets';
import { UnitCard } from '../panels/UnitCard';
import { moneyShort as money, people, pct, signedPct, int, relationLabel } from '../format';
import type { SectionId } from './NavRail';
import { Icon } from '../icons';

interface Props {
  state: GameState;
  selection: Selection;
  setSelection: (s: Selection) => void;
  startOrder: (regionId: string, ids: string[]) => void;
  openSection: (id: SectionId, country?: CountryId) => void;
}

function Tabs<T extends string>({ tabs, active, onChange }: { tabs: { id: T; label: string }[]; active: T; onChange: (t: T) => void }) {
  return (
    <div className="ctx-tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={active === t.id} className={active === t.id ? 'on' : ''}
          data-ctx-tab={t.id} onClick={() => onChange(t.id)}>{t.label}</button>
      ))}
    </div>
  );
}

// ---------------- País ----------------

type CountryTab = 'economy' | 'diplomacy' | 'military';

export function CountryContext({ state, country, openSection, compact }: { state: GameState; country: CountryId; openSection: Props['openSection']; compact?: boolean }) {
  const [tab, setTab] = useState<CountryTab>('economy');
  const me = state.player;
  const isMe = country === me;
  const c = state.countries[country];
  const debtPct = c.gdp > 0 ? (c.debt / c.gdp) * 100 : 0;
  const flows = annualFlows(state, country);
  const units = unitsOf(state, country);
  const wars = warsOf(state, country);
  const partners = state.trades.filter((t) => t.a === country || t.b === country).map((t) => (t.a === country ? t.b : t.a));
  const controlled = regionsControlledBy(state, country);
  const occupiedOwn = Object.values(state.regions).filter((r) => r.owner === country && r.controller !== country);
  const rel = getRelation(state, me, country);

  return (
    <div className="ctx-body">
      {!compact && (
        <Tabs<CountryTab> tabs={[{ id: 'economy', label: 'Economía' }, { id: 'diplomacy', label: 'Diplom.' }, { id: 'military', label: 'Militar' }]} active={tab} onChange={setTab} />
      )}
      {(compact || tab === 'economy') && (
        <>
          <div className="stat-grid compact">
            <Stat label="PIB" value={money(c.gdp)} sub={`${signedPct(c.growth)} / año`} tone={c.growth < 0 ? 'bad' : undefined} />
            <Stat label="Población" value={people(c.population)} />
            <Stat label="Estabilidad" value={int(c.stability)} tone={c.stability < 30 ? 'bad' : c.stability < 50 ? 'warn' : undefined} />
            <Stat label="Deuda" value={pct(debtPct, 0)} sub="del PIB" tone={debtPct > 100 ? 'bad' : undefined} />
            {!compact && <Stat label="Reservas" value={money(c.reserves)} />}
            {!compact && <Stat label="Saldo anual" value={money(flows.balance)} tone={flows.balance < 0 ? 'bad' : 'good'} />}
          </div>
          {isMe && !compact && <button type="button" className="link-btn" onClick={() => openSection('economy')}>Abrir Economía <Icon name="chevronRight" size={14} /></button>}
        </>
      )}
      {!compact && tab === 'diplomacy' && (
        <>
          {!isMe && (
            <div className="rel-box">
              <div className="row-between"><span>Relación contigo</span><strong className="num">{relationLabel(rel)} ({rel > 0 ? '+' : ''}{int(rel)})</strong></div>
              <RelationBar value={rel} />
              <div className="chips">
                {atWar(state, me, country) && <span className="chip war">En guerra contigo</span>}
                {sameSide(state, me, country) && <span className="chip ally">Aliado de guerra</span>}
                {hasTrade(state, me, country) && <span className="chip trade">Acuerdo comercial</span>}
                {inTruce(state, me, country) && <span className="chip">Tregua</span>}
              </div>
            </div>
          )}
          <Section title="Guerras">
            {wars.length ? (
              <ul className="plain">{wars.map((w) => <li key={w.id}>{w.name}</li>)}</ul>
            ) : <p className="muted">En paz.</p>}
          </Section>
          <Section title="Socios comerciales">
            {partners.length ? <div className="chips">{partners.map((p) => <CountryTag key={p} c={p} />)}</div> : <p className="muted">Ninguno.</p>}
          </Section>
          <button type="button" className="link-btn" onClick={() => openSection('diplomacy', isMe ? undefined : country)}>
            {isMe ? 'Abrir Diplomacia' : `Acciones con ${countryName(country)}`} <Icon name="chevronRight" size={14} />
          </button>
        </>
      )}
      {!compact && tab === 'military' && (
        <>
          <div className="stat-grid compact">
            <Stat label="Batallones" value={units.length} sub={`${int(units.reduce((s, u) => s + u.men, 0))} efectivos`} />
            <Stat label="Fuerza" value={countryPower(state, country).toFixed(0)} sub={isMe ? undefined : `la tuya: ${countryPower(state, me).toFixed(0)}`} />
            <Stat label="Regiones" value={controlled.length} sub={occupiedOwn.length ? `${occupiedOwn.length} propias ocupadas` : 'ninguna ocupada'} tone={occupiedOwn.length ? 'bad' : undefined} />
            <Stat label="Bajas" value={int(c.casualties)} />
          </div>
          {isMe && (
            <>
              <div className="row-between small-text"><span>Abastecimiento</span><span className="num">{pct(Math.min(c.supplyRatio, 9.99) * 100, 0)}</span></div>
              <Meter value={Math.min(c.supplyRatio, 1.5)} max={1.5} tone={c.supplyRatio < 0.7 ? 'bad' : c.supplyRatio < 1 ? 'warn' : 'good'} label="Abastecimiento" />
              <button type="button" className="link-btn" onClick={() => openSection('army')}>Abrir Ejército <Icon name="chevronRight" size={14} /></button>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ---------------- Región ----------------

type RegionTab = 'region' | 'country' | 'troops';

function RegionContext({ state, regionId, setSelection, startOrder, openSection }: Props & { regionId: string }) {
  const [tab, setTab] = useState<RegionTab>('region');
  useEffect(() => { setTab('region'); }, [regionId]);
  const reg = REGIONS[regionId];
  const r = state.regions[regionId];
  const me = state.player;
  const units = unitsIn(state, regionId);
  const mine = units.filter((u) => u.owner === me);
  const others = units.filter((u) => u.owner !== me);
  const battle = state.battles[regionId];
  const need = reg.capital ? 48 : 24;
  const orderable = mine.filter((u) => u.status !== 'training' && u.status !== 'retreating');
  const byOwner = new Map<CountryId, Unit[]>();
  for (const u of others) byOwner.set(u.owner, [...(byOwner.get(u.owner) ?? []), u]);

  return (
    <div className="ctx-body">
      <Tabs<RegionTab> tabs={[{ id: 'region', label: 'Región' }, { id: 'country', label: 'País' }, { id: 'troops', label: `Tropas (${units.length})` }]} active={tab} onChange={setTab} />
      {tab === 'region' && (
        <>
          <div className="stat-grid compact">
            <Stat label="PIB regional" value={money(r.gdp)} />
            <Stat label="Población" value={people(r.population)} />
          </div>
          <dl className="kv">
            <div><dt>Propietario</dt><dd><button type="button" className="link-btn inline" onClick={() => setSelection({ kind: 'country', country: r.owner })}><CountryTag c={r.owner} /></button></dd></div>
            <div><dt>Control</dt><dd>{r.controller === r.owner ? 'Propietario' : <span className="bad-text">Ocupada por {countryName(r.controller)}</span>}</dd></div>
            {reg.capital && <div><dt>Estatus</dt><dd>Capital nacional</dd></div>}
          </dl>
          {r.occupationHours > 0 && r.occupier && (
            <p className="notice warn">{countryName(r.occupier)} está tomando el control: {Math.round((r.occupationHours / need) * 100)} %</p>
          )}
          {battle && (
            <p className="notice bad">Batalla en curso. Bajas: {Object.entries(battle.losses).map(([c, n]) => `${countryName(c as CountryId)} ${int(n ?? 0)}`).join(' · ')}</p>
          )}
          {r.owner === me && r.controller === me && (
            <button type="button" onClick={() => controller.act({ type: 'recruit', regionId })}>Reclutar batallón aquí · {money(recruitCost(state, me))}</button>
          )}
        </>
      )}
      {tab === 'country' && (
        <>
          <div className="row-between"><CountryTag c={r.controller} />
            <button type="button" className="link-btn" onClick={() => setSelection({ kind: 'country', country: r.controller })}>Ver país <Icon name="chevronRight" size={14} /></button>
          </div>
          <CountryContext state={state} country={r.controller} openSection={openSection} compact />
        </>
      )}
      {tab === 'troops' && (
        <>
          {mine.length > 0 && (
            <Section title={`Tus batallones (${mine.length})`} aside={orderable.length > 0 && (
              <button type="button" className="small primary" onClick={() => startOrder(regionId, orderable.map((u) => u.id))}>Mover todos</button>
            )}>
              <div className="unit-list">
                {mine.map((u) => (
                  <UnitCard key={u.id} state={state} u={u} onToggle={() => setSelection({ kind: 'units', regionId, owner: me, unitIds: [u.id] })} />
                ))}
              </div>
            </Section>
          )}
          {byOwner.size > 0 && (
            <Section title="Otras tropas">
              <ul className="plain">
                {[...byOwner.entries()].map(([c, us]) => (
                  <li key={c} className="row-between">
                    <CountryTag c={c} />
                    <span className="num small-text">{us.length} bat. · {int(us.reduce((s, u) => s + u.men, 0))} ef. · fuerza {us.reduce((s, u) => s + unitPower(state, u), 0).toFixed(1)}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {!units.length && <p className="muted">No hay tropas en esta región.</p>}
        </>
      )}
    </div>
  );
}

// ---------------- Batallones ----------------

function UnitsContext({ state, selection, setSelection, startOrder }: Props & { selection: Extract<Selection, { kind: 'units' }> }) {
  const me = state.player;
  const mine = selection.owner === me;
  const all = unitsIn(state, selection.regionId).filter((u) => u.owner === selection.owner);
  const selected = selection.unitIds.map((id) => state.units[id]).filter(Boolean);
  const orderable = selected.filter((u) => u.status !== 'training' && u.status !== 'retreating');
  const moving = selected.filter((u) => u.path.length > 0 && u.status !== 'retreating');
  // Unidades en marcha que ya salieron de la región se muestran igualmente
  const list = [...new Map([...selected, ...all].map((u) => [u.id, u])).values()];

  function toggle(id: string) {
    if (!mine) return;
    const ids = selection.unitIds.includes(id) ? selection.unitIds.filter((x) => x !== id) : [...selection.unitIds, id];
    setSelection(ids.length ? { ...selection, unitIds: ids } : { kind: 'region', regionId: selection.regionId });
  }

  return (
    <div className="ctx-body">
      {mine ? (
        <div className="unit-actions">
          <button type="button" className="primary" disabled={!orderable.length} data-action="move" onClick={() => startOrder(selection.regionId, orderable.map((u) => u.id))}>
            <Icon name="move" size={16} /> Mover ({orderable.length})
          </button>
          <button type="button" disabled={!moving.length} onClick={() => controller.actBatch(moving.map((u) => ({ type: 'move' as const, unitId: u.id, target: u.regionId })), (n) => `${n} batallón(es) detenido(s).`)}>
            <Icon name="stop" size={14} /> Detener
          </button>
          {selected.length === 1 && (
            <ConfirmButton className="ghost" label="Desmovilizar" confirmLabel="Confirmar" onConfirm={() => { controller.act({ type: 'disband', unitId: selected[0].id }); setSelection({ kind: 'region', regionId: selection.regionId }); }} />
          )}
        </div>
      ) : (
        <p className="muted small-text">Tropas de {countryName(selection.owner)}. Solo puedes consultar su información.</p>
      )}
      <div className="unit-list">
        {list.map((u) => (
          <UnitCard key={u.id} state={state} u={u} selected={selection.unitIds.includes(u.id)} onToggle={mine ? () => toggle(u.id) : undefined} />
        ))}
      </div>
      {mine && all.length > 1 && <p className="muted small-text">Toca un batallón para añadirlo o quitarlo de la selección.</p>}
    </div>
  );
}

// ---------------- Contenedor ----------------

export function contextTitle(state: GameState, sel: Selection): { title: string; subtitle: string } {
  switch (sel.kind) {
    case 'none': return { title: countryName(state.player), subtitle: 'Tu país' };
    case 'country': return { title: countryName(sel.country), subtitle: sel.country === state.player ? 'Tu país' : 'País' };
    case 'region': return { title: REGIONS[sel.regionId].name, subtitle: `Región · ${countryName(state.regions[sel.regionId].owner)}` };
    case 'units': return {
      title: sel.unitIds.length === 1 && state.units[sel.unitIds[0]] ? state.units[sel.unitIds[0]].name : `${sel.unitIds.length} batallones`,
      subtitle: `${countryName(sel.owner)} · ${REGIONS[sel.regionId].name}`,
    };
  }
}

export function ContextPanel(props: Props) {
  const { state, selection } = props;
  switch (selection.kind) {
    case 'none': return <CountryContext state={state} country={state.player} openSection={props.openSection} />;
    case 'country': return <CountryContext key={selection.country} state={state} country={selection.country} openSection={props.openSection} />;
    case 'region': return <RegionContext {...props} regionId={selection.regionId} />;
    case 'units': return <UnitsContext {...props} selection={selection} />;
  }
}

