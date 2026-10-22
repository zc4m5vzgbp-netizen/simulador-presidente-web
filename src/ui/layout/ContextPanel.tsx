/**
 * Columna derecha del mapa (Modelo 1): tarjeta del país + tarjeta de la región
 * o de los batallones seleccionados. Solo datos del estado real del juego.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { CountryId, GameState, Unit } from '../../engine/types';
import { REGIONS, MAP, countryName } from '../../engine/world';
import { atWar, sameSide, warsOf, inTruce } from '../../engine/war';
import { getRelation, hasTrade } from '../../engine/diplomacy';
import { countryPower, recruitCost, unitsIn, unitsOf } from '../../engine/military';
import { annualFlows, interestRate } from '../../engine/economy';
import { regionsControlledBy } from '../../engine/territory';
import { COUNTRY_DEFS } from '../../data/countries';
import { controller } from '../controller';
import type { Selection } from '../selection';
import { ConfirmButton, CountryTag, RelationBar } from '../widgets';
import { FlagIcon } from '../flags';
import { UnitCard } from '../panels/UnitCard';
import { moneyShort as money, people, pct, signedPct, int, relationLabel } from '../format';
import type { SectionId } from './NavRail';
import { Icon, type IconName } from '../icons';
import { CITY_KIND_LABEL, cityById, crossingById, formatLonLat } from '../../geo';
import { StateCard, FacilityCard } from '../panels/AtlasCards';

interface Props {
  state: GameState;
  selection: Selection;
  setSelection: (s: Selection) => void;
  startOrder: (regionId: string, ids: string[]) => void;
  openSection: (id: SectionId, country?: CountryId) => void;
  onCollapse: () => void;
}

function Row({ icon, label, value, trend, tone, children }: { icon?: IconName; label: string; value?: ReactNode; trend?: ReactNode; tone?: 'good' | 'bad' | 'warn'; children?: ReactNode }) {
  return (
    <div className={`crow${tone ? ` ${tone}` : ''}`}>
      {icon && <Icon name={icon} size={20} className="crow-icon" />}
      <div className="crow-main">
        <span className="crow-label">{label}</span>
        {value !== undefined && <span className="crow-value">{value}</span>}
        {children}
      </div>
      {trend !== undefined && <span className="crow-trend">{trend}</span>}
    </div>
  );
}

function Trend({ v }: { v: number }) {
  return <span className={`trend ${v >= 0 ? 'up' : 'down'}`}><Icon name={v >= 0 ? 'up' : 'down'} size={11} />{signedPct(v).replace(/^[+−]/, '')}</span>;
}

function Tabs<T extends string>({ tabs, active, onChange }: { tabs: { id: T; label: string; short?: string }[]; active: T; onChange: (t: T) => void }) {
  return (
    <div className="ctabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={active === t.id} className={active === t.id ? 'on' : ''}
          data-ctx-tab={t.id} onClick={() => onChange(t.id)}><span className="tab-full">{t.label}</span><span className="tab-short" aria-hidden="true">{t.short ?? t.label}</span></button>
      ))}
    </div>
  );
}

// ---------------- Tarjeta de país ----------------

type CountryTab = 'summary' | 'economy' | 'military' | 'diplomacy';

function CountryCard({ state, country, openSection, onCollapse }: { state: GameState; country: CountryId; openSection: Props['openSection']; onCollapse: () => void }) {
  const [tab, setTab] = useState<CountryTab>('summary');
  const me = state.player;
  const isMe = country === me;
  const c = state.countries[country];
  const debtPct = c.gdp > 0 ? (c.debt / c.gdp) * 100 : 0;
  const flows = annualFlows(state, country);
  const units = unitsOf(state, country);
  const wars = warsOf(state, country);
  const partners = state.trades.filter((t) => t.a === country || t.b === country).map((t) => (t.a === country ? t.b : t.a));
  const occupiedOwn = Object.values(state.regions).filter((r) => r.owner === country && r.controller !== country).length;
  const rel = getRelation(state, me, country);
  const stabTone = c.stability < 30 ? 'bad' : c.stability < 50 ? 'warn' : 'good';

  return (
    <section className="card country-card" aria-label={`País: ${countryName(country)}`}>
      <header className="card-head">
        <FlagIcon c={country} size={34} />
        <h2 className="cc-name">{COUNTRY_DEFS[country].name}</h2>
        {!isMe && atWar(state, me, country) && <span className="chip war">Guerra</span>}
        <button type="button" className="icon-btn ghost-btn" aria-label="Contraer panel" data-action="collapse" onClick={onCollapse}>
          <Icon name="chevronRight" size={18} />
        </button>
      </header>
      <Tabs<CountryTab> tabs={[{ id: 'summary', label: 'Resumen' }, { id: 'economy', label: 'Economía', short: 'Econ.' }, { id: 'military', label: 'Ejército' }, { id: 'diplomacy', label: 'Diplomacia', short: 'Diplom.' }]} active={tab} onChange={setTab} />

      {tab === 'summary' && (
        <div className="card-body">
          <Row icon="gdp" label="PIB" value={money(c.gdp)} trend={<Trend v={c.growth} />} />
          <Row icon="population" label="Población" value={people(c.population)} />
          <Row icon="reserves" label="Reservas" value={money(c.reserves)} tone={c.reserves <= 0 ? 'bad' : undefined} />
          <Row icon="economy" label="Deuda" value={money(c.debt)} trend={<span className={`trend ${debtPct > 100 ? 'down' : 'muted'}`}>{pct(debtPct, 0)} del PIB</span>} />
          <Row icon="stability" label="Estabilidad" tone={stabTone}>
            <span className="crow-bar"><span className="crow-value">{int(c.stability)}</span><span className={`bar ${stabTone}`}><span style={{ width: `${Math.max(0, Math.min(100, c.stability))}%` }} /></span></span>
          </Row>
          <div className="crow link">
            <Icon name="handshake" size={20} className="crow-icon" />
            <div className="crow-main"><span className="crow-label">{isMe ? 'Relaciones' : `Relación: ${relationLabel(rel)} (${rel > 0 ? '+' : ''}${int(rel)})`}</span></div>
            <button type="button" className="link-btn" onClick={() => openSection('diplomacy', isMe ? undefined : country)}>Ver detalles <Icon name="chevronRight" size={14} /></button>
          </div>
        </div>
      )}

      {tab === 'economy' && (
        <div className="card-body">
          <Row label="Ingresos fiscales" value={`${money(flows.revenue)}/año`} />
          <Row label="Gasto del Estado" value={`${money(flows.spending)}/año`} />
          <Row label="Saldo" value={`${money(flows.balance)}/año`} tone={flows.balance < 0 ? 'bad' : 'good'} />
          <Row label="Impuestos" value={pct(c.policy.taxRate)} trend={<span className="muted">interés {pct(interestRate(c) * 100)}</span>} />
          <Row label="Inversión pública" value={pct(c.policy.investment)} />
          <Row label="Acuerdos comerciales" value={partners.length} />
          {isMe && <button type="button" className="link-btn" onClick={() => openSection('economy')}>Gestionar economía <Icon name="chevronRight" size={14} /></button>}
        </div>
      )}

      {tab === 'military' && (
        <div className="card-body">
          <Row icon="soldier" label="Batallones" value={units.length} trend={<span className="muted">{int(units.reduce((s, u) => s + u.men, 0))} ef.</span>} />
          <Row icon="army" label="Fuerza militar" value={countryPower(state, country).toFixed(0)} trend={isMe ? undefined : <span className="muted">tuya {countryPower(state, me).toFixed(0)}</span>} />
          <Row icon="map" label="Regiones controladas" value={regionsControlledBy(state, country).length} trend={occupiedOwn ? <span className="trend down">{occupiedOwn} ocupadas</span> : undefined} />
          <Row label="Presupuesto militar" value={pct(c.policy.militaryBudget)} trend={isMe ? <span className={c.supplyRatio < 1 ? 'trend down' : 'muted'}>abast. {pct(Math.min(c.supplyRatio, 9.99) * 100, 0)}</span> : undefined} />
          <Row label="Bajas acumuladas" value={int(c.casualties)} />
          {isMe && <button type="button" className="link-btn" onClick={() => openSection('army')}>Gestionar ejército <Icon name="chevronRight" size={14} /></button>}
        </div>
      )}

      {tab === 'diplomacy' && (
        <div className="card-body">
          {!isMe && (
            <div className="rel-box">
              <div className="row-between"><span>Relación contigo</span><strong className="num">{relationLabel(rel)} ({rel > 0 ? '+' : ''}{int(rel)})</strong></div>
              <RelationBar value={rel} />
              <div className="chips">
                {atWar(state, me, country) && <span className="chip war">En guerra</span>}
                {sameSide(state, me, country) && <span className="chip ally">Aliado</span>}
                {hasTrade(state, me, country) && <span className="chip trade">Comercio</span>}
                {inTruce(state, me, country) && <span className="chip">Tregua</span>}
              </div>
            </div>
          )}
          <Row label="Guerras" value={wars.length ? wars.map((w) => w.name).join(' · ') : 'En paz'} tone={wars.length ? 'bad' : undefined} />
          <Row label="Socios comerciales">
            {partners.length ? <span className="chips">{partners.map((p) => <CountryTag key={p} c={p} />)}</span> : <span className="crow-value">Ninguno</span>}
          </Row>
          <button type="button" className="link-btn" onClick={() => openSection('diplomacy', isMe ? undefined : country)}>
            {isMe ? 'Abrir diplomacia' : `Acciones con ${countryName(country)}`} <Icon name="chevronRight" size={14} />
          </button>
        </div>
      )}
    </section>
  );
}

// ---------------- Silueta de región (sustituye a la fotografía del modelo) ----------------

function pathBox(d: string) {
  const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    minX = Math.min(minX, nums[i]); maxX = Math.max(maxX, nums[i]);
    minY = Math.min(minY, nums[i + 1]); maxY = Math.max(maxY, nums[i + 1]);
  }
  return { minX, minY, maxX, maxY };
}

function RegionSilhouette({ state, regionId }: { state: GameState; regionId: string }) {
  const reg = REGIONS[regionId];
  const b = pathBox(reg.path);
  const pad = Math.max(b.maxX - b.minX, b.maxY - b.minY) * 0.18 + 6;
  const vb = `${b.minX - pad} ${b.minY - pad} ${b.maxX - b.minX + pad * 2} ${b.maxY - b.minY + pad * 2}`;
  const ctrl = state.regions[regionId].controller;
  return (
    <svg className="region-thumb" viewBox={vb} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <path d={MAP.countries[reg.country]} className="thumb-country" />
      <path d={reg.path} fill={COUNTRY_DEFS[ctrl].color} className="thumb-region" />
      <circle cx={reg.anchor[0]} cy={reg.anchor[1]} r={pad * 0.12} className="thumb-dot" />
    </svg>
  );
}

// ---------------- Tarjeta de región ----------------

function RegionCard({ state, regionId, setSelection, startOrder }: Omit<Props, 'selection' | 'onCollapse'> & { regionId: string }) {
  const [open, setOpen] = useState(true);
  const [showTroops, setShowTroops] = useState(false);
  useEffect(() => { setShowTroops(false); }, [regionId]);
  const reg = REGIONS[regionId];
  const r = state.regions[regionId];
  const me = state.player;
  const units = unitsIn(state, regionId);
  const mine = units.filter((u) => u.owner === me);
  const orderable = mine.filter((u) => u.status !== 'training' && u.status !== 'retreating');
  const byOwner = new Map<CountryId, Unit[]>();
  for (const u of units) byOwner.set(u.owner, [...(byOwner.get(u.owner) ?? []), u]);
  const battle = state.battles[regionId];
  const need = reg.capital ? 48 : 24;

  return (
    <section className="card region-card" aria-label={`Región seleccionada: ${reg.name}`}>
      <header className="card-head small">
        <h3>Región seleccionada</h3>
        <button type="button" className="icon-btn ghost-btn" aria-label={open ? 'Plegar región' : 'Desplegar región'} aria-expanded={open} onClick={() => setOpen(!open)}>
          <Icon name={open ? 'chevronUp' : 'chevronDown'} size={18} />
        </button>
      </header>
      {open && (
        <div className="card-body">
          <div className="rc-top">
            <RegionSilhouette state={state} regionId={regionId} />
            <div className="rc-id">
              <h2 className="rc-name">{reg.name}</h2>
              <button type="button" className="link-btn inline rc-owner" onClick={() => setSelection({ kind: 'country', country: r.owner })}>
                <FlagIcon c={r.owner} size={20} /> {countryName(r.owner)}
              </button>
              {reg.capital && <span className="chip ally">Capital</span>}
            </div>
          </div>
          <Row label="Población" value={people(r.population)} />
          <Row label="PIB regional" value={money(r.gdp)} />
          <Row label="Control">
            <span className={`crow-value rc-ctrl${r.controller !== r.owner ? ' bad-text' : ''}`}><FlagIcon c={r.controller} size={18} /> {countryName(r.controller)}{r.controller !== r.owner ? ' (ocupada)' : ''}</span>
          </Row>
          <Row label="Unidades">
            <span className="unit-badges">
              {units.length === 0 && <span className="crow-value">Ninguna</span>}
              {[...byOwner.entries()].map(([c, us]) => {
                const rel = c === me ? 'mine' : atWar(state, c, me) ? 'enemy' : sameSide(state, c, me) ? 'ally' : 'other';
                return <span key={c} className={`ubadge ${rel}`} title={countryName(c)}><Icon name="soldier" size={13} />{us.length}</span>;
              })}
            </span>
          </Row>
          {r.occupationHours > 0 && r.occupier && <p className="notice warn">{countryName(r.occupier)} está tomando el control: {Math.round((r.occupationHours / need) * 100)} %</p>}
          {battle && <p className="notice bad">Batalla en curso. Bajas: {Object.entries(battle.losses).map(([c, n]) => `${countryName(c as CountryId)} ${int(n ?? 0)}`).join(' · ')}</p>}
          <div className="card-actions">
            {orderable.length > 0 && <button type="button" className="primary small" onClick={() => startOrder(regionId, orderable.map((u) => u.id))}><Icon name="move" size={15} /> Mover tropas ({orderable.length})</button>}
            {units.length > 0 && <button type="button" className="small" data-action="troops" onClick={() => setShowTroops(!showTroops)}>{showTroops ? 'Ocultar tropas' : 'Ver tropas'}</button>}
            {r.owner === me && r.controller === me && <button type="button" className="small" onClick={() => controller.act({ type: 'recruit', regionId })}>Reclutar · {money(recruitCost(state, me))}</button>}
          </div>
          {showTroops && (
            <div className="unit-list">
              {units.map((u) => (
                <UnitCard key={u.id} state={state} u={u} onToggle={() => setSelection({ kind: 'units', regionId, owner: u.owner, unitIds: [u.id] })} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ---------------- Tarjeta de batallones ----------------

function UnitsCard({ state, selection, setSelection, startOrder }: Omit<Props, 'onCollapse' | 'openSection'> & { selection: Extract<Selection, { kind: 'units' }> }) {
  const me = state.player;
  const mine = selection.owner === me;
  const all = unitsIn(state, selection.regionId).filter((u) => u.owner === selection.owner);
  const selected = selection.unitIds.map((id) => state.units[id]).filter(Boolean);
  const orderable = selected.filter((u) => u.status !== 'training' && u.status !== 'retreating');
  const moving = selected.filter((u) => u.path.length > 0 && u.status !== 'retreating');
  const list = [...new Map([...selected, ...all].map((u) => [u.id, u])).values()];
  const title = selected.length === 1 ? selected[0].name : `${selected.length} batallones`;

  function toggle(id: string) {
    if (!mine) return;
    const ids = selection.unitIds.includes(id) ? selection.unitIds.filter((x) => x !== id) : [...selection.unitIds, id];
    setSelection(ids.length ? { ...selection, unitIds: ids } : { kind: 'region', regionId: selection.regionId });
  }

  return (
    <section className="card units-card" aria-label="Batallones seleccionados">
      <header className="card-head small">
        <h3>Batallones seleccionados</h3>
        <button type="button" className="icon-btn ghost-btn" aria-label="Quitar selección" onClick={() => setSelection({ kind: 'region', regionId: selection.regionId })}>
          <Icon name="close" size={16} />
        </button>
      </header>
      <div className="card-body">
        <div className="rc-id">
          <h2 className="rc-name">{title}</h2>
          <span className="rc-owner"><FlagIcon c={selection.owner} size={20} /> {countryName(selection.owner)} · {REGIONS[selection.regionId].name}</span>
        </div>
        {mine ? (
          <div className="card-actions">
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
    </section>
  );
}

// ---------------- Tarjetas cartográficas (MAP-001) ----------------
// Solo información geográfica documentada: sin estadísticas inventadas.

function SourceLinks({ sources }: { sources: string[] }) {
  return (
    <ul className="src-list">
      {sources.map((src) => (
        <li key={src}>{/^https?:/.test(src)
          ? <a href={src} target="_blank" rel="noopener noreferrer">{src.replace(/^https?:\/\/(www\.)?/, '').replace(/\/wiki\//, ' · ').replace(/_/g, ' ')}</a>
          : src}</li>
      ))}
    </ul>
  );
}

function CityCard({ cityId, setSelection }: { cityId: string; setSelection: Props['setSelection'] }) {
  const city = cityById(cityId);
  if (!city) return null;
  return (
    <section className="card geo-card city-card" aria-label={`Ciudad seleccionada: ${city.name}`}>
      <header className="card-head small">
        <h3><Icon name="city" size={15} /> Ciudad</h3>
        <button type="button" className="icon-btn ghost-btn" aria-label="Quitar selección" onClick={() => setSelection({ kind: 'none' })}>
          <Icon name="close" size={16} />
        </button>
      </header>
      <div className="card-body">
        <div className="rc-id">
          <h2 className="rc-name">{city.name}</h2>
          <button type="button" className="link-btn inline rc-owner" onClick={() => setSelection({ kind: 'country', country: city.country })}>
            <FlagIcon c={city.country} size={20} /> {countryName(city.country)}
          </button>
          <span className={`chip ${city.kind === 'city' ? '' : 'ally'}`} data-testid="city-kind">{CITY_KIND_LABEL[city.kind]}</span>
        </div>
        {city.note && <p className="geo-note">{city.note}</p>}
        {city.province && <Row label={city.provinceType ?? 'División'} value={city.province} />}
        {city.region && REGIONS[city.region] && (
          <Row label="Región del juego">
            <button type="button" className="link-btn inline crow-value" onClick={() => setSelection({ kind: 'region', regionId: city.region! })}>{REGIONS[city.region].name} <Icon name="chevronRight" size={13} /></button>
          </Row>
        )}
        <Row label="Coordenadas" value={formatLonLat(city.lonlat)} />
        <div className="geo-src"><span className="crow-label">Fuente</span><SourceLinks sources={[city.source]} /></div>
      </div>
    </section>
  );
}

function CrossingCard({ crossingId, setSelection }: { crossingId: string; setSelection: Props['setSelection'] }) {
  const x = crossingById(crossingId);
  if (!x) return null;
  const fluvial = x.type === 'fluvial';
  return (
    <section className="card geo-card crossing-card" aria-label={`Paso fronterizo: ${x.name}`}>
      <header className="card-head small">
        <h3><Icon name={fluvial ? 'ferry' : 'crossing'} size={15} /> Paso fronterizo</h3>
        <button type="button" className="icon-btn ghost-btn" aria-label="Quitar selección" onClick={() => setSelection({ kind: 'none' })}>
          <Icon name="close" size={16} />
        </button>
      </header>
      <div className="card-body">
        <div className="rc-id">
          <h2 className="rc-name">{x.name}</h2>
          <span className={`chip ${fluvial ? 'fluvial' : 'land'}`} data-testid="crossing-type">{fluvial ? 'Fluvial' : 'Terrestre'}</span>
        </div>
        {x.detail && <p className="geo-note">{x.detail}</p>}
        <div className="cross-ends">
          {x.countries.map((c, i) => (
            <button key={c} type="button" className="link-btn inline" onClick={() => setSelection({ kind: 'country', country: c })}>
              <FlagIcon c={c} size={18} /> <span>{x.places[i]}<small className="muted"> · {countryName(c)}</small></span>
            </button>
          ))}
        </div>
        {fluvial && x.terminals
          ? <>
            <Row label={`Terminal ${x.places[0]}`} value={formatLonLat(x.terminals[0])} />
            <Row label={`Terminal ${x.places[1]}`} value={formatLonLat(x.terminals[1])} />
            {x.lengthKm !== undefined && <Row label="Distancia entre terminales" value={`≈ ${int(x.lengthKm)} km`} />}
          </>
          : <Row label="Coordenadas" value={formatLonLat(x.lonlat)} />}
        <Row label="Precisión" value={x.precision === 'estructura' ? 'Ubicación del puente o puesto' : 'Aproximada (centro de la localidad)'} />
        <p className="muted small-text">Información geográfica: este paso todavía no influye en el movimiento de tropas.</p>
        <div className="geo-src"><span className="crow-label">Fuentes</span><SourceLinks sources={x.source} /></div>
      </div>
    </section>
  );
}

// ---------------- Columna ----------------

export function ContextPanel(props: Props) {
  const { state, selection } = props;
  const country = selection.kind === 'country' ? selection.country : state.player;
  const selKey = selection.kind === 'region' ? `r:${selection.regionId}` : selection.kind === 'units' ? `u:${selection.unitIds.join()}`
    : selection.kind === 'city' ? `c:${selection.cityId}` : selection.kind === 'crossing' ? `x:${selection.crossingId}`
    : selection.kind === 'state' ? `s:${selection.stateId}` : selection.kind === 'facility' ? `f:${selection.facilityId}` : selection.kind;
  const ref = useRef<HTMLDivElement>(null);
  // Al seleccionar región o batallones, llevar su tarjeta a la vista (pantallas bajas).
  useEffect(() => {
    if (selection.kind === 'none' || selection.kind === 'country') return;
    const card = ref.current?.querySelector('.region-card, .units-card, .geo-card');
    card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="cards" data-testid="context" ref={ref}>
      <CountryCard key={country} state={state} country={country} openSection={props.openSection} onCollapse={props.onCollapse} />
      {selection.kind === 'region' && <RegionCard {...props} regionId={selection.regionId} />}
      {selection.kind === 'units' && <UnitsCard {...props} selection={selection} />}
      {selection.kind === 'city' && <CityCard cityId={selection.cityId} setSelection={props.setSelection} />}
      {selection.kind === 'crossing' && <CrossingCard crossingId={selection.crossingId} setSelection={props.setSelection} />}
      {selection.kind === 'state' && <StateCard stateId={selection.stateId} regionId={selection.regionId} setSelection={props.setSelection} />}
      {selection.kind === 'state' && <RegionCard {...props} regionId={selection.regionId} />}
      {selection.kind === 'facility' && <FacilityCard facilityId={selection.facilityId} setSelection={props.setSelection} />}
    </div>
  );
}
