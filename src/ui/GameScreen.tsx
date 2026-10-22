import { useState } from 'react';
import type { CountryId, GameState } from '../engine/types';
import { formatDate } from '../engine/core';
import { SPEEDS, type SpeedId } from '../engine/time';
import { REGIONS } from '../engine/world';
import { warsOf } from '../engine/war';
import { COUNTRY_DEFS } from '../data/countries';
import { controller } from './controller';
import { MapView, type MapSelection } from './MapView';
import { RegionPanel } from './panels/RegionPanel';
import { EconomyPanel } from './panels/EconomyPanel';
import { DiplomacyPanel } from './panels/DiplomacyPanel';
import { ArmyPanel } from './panels/ArmyPanel';
import { GamePanel } from './panels/GamePanel';
import { Flag } from './widgets';
import { money, int } from './format';

type Tab = 'map' | 'economy' | 'diplomacy' | 'army' | 'game';
const TABS: { id: Tab; label: string }[] = [
  { id: 'map', label: 'Mapa' },
  { id: 'economy', label: 'Economía' },
  { id: 'diplomacy', label: 'Diplomacia' },
  { id: 'army', label: 'Ejército' },
  { id: 'game', label: 'Partida' },
];

function SpeedIcon({ id }: { id: SpeedId }) {
  if (id === 0) return <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="3" y="2.5" width="3.5" height="11" fill="currentColor" /><rect x="9.5" y="2.5" width="3.5" height="11" fill="currentColor" /></svg>;
  const n = id === 1 ? 1 : id === 2 ? 2 : 3;
  const w = 7 * n + 2;
  return (
    <svg viewBox={`0 0 ${w} 16`} width={w} height="14" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => <path key={i} d={`M${1 + i * 7} 2.5 L${8 + i * 7} 8 L${1 + i * 7} 13.5 Z`} fill="currentColor" />)}
    </svg>
  );
}

export function GameScreen({ state }: { state: GameState }) {
  const [tab, setTab] = useState<Tab>('map');
  const [sel, setSel] = useState<MapSelection>({ regionId: null, unitIds: [] });
  const [orderMode, setOrderMode] = useState(false);
  const me = state.player;
  const c = state.countries[me];
  const speed = controller.clock.speed;
  const inbox = state.proposals.filter((p) => p.to === me).length;
  const atWarNow = warsOf(state, me).length > 0;
  const latest = [...state.log].reverse().find((l) => l.countries.includes(me) || l.kind === 'war');
  const validUnits = sel.unitIds.filter((id) => state.units[id]?.owner === me);

  function startOrder(ids: string[]) {
    if (!ids.length) return;
    setSel((s) => ({ ...s, unitIds: ids }));
    setOrderMode(true);
    setTab('map');
  }

  function onTapRegion(regionId: string) {
    if (orderMode && validUnits.length) {
      controller.actBatch(
        validUnits.map((id) => ({ type: 'move' as const, unitId: id, target: regionId })),
        (n) => `${n} ${n > 1 ? 'batallones' : 'batallón'} en marcha hacia ${REGIONS[regionId].name}.`,
      );
      setOrderMode(false);
      return;
    }
    setOrderMode(false);
    setSel((s) => ({ regionId, unitIds: s.regionId === regionId ? s.unitIds : [] }));
  }

  function onTapUnits(regionId: string, owner: CountryId) {
    if (owner === me) {
      const ids = Object.values(state.units)
        .filter((u) => u.owner === me && u.regionId === regionId && u.status !== 'training' && u.status !== 'retreating')
        .map((u) => u.id);
      setSel({ regionId, unitIds: ids });
      if (ids.length) setOrderMode(true);
    } else {
      setSel({ regionId, unitIds: [] });
      setOrderMode(false);
    }
  }

  function focusUnit(id: string) {
    const u = state.units[id];
    if (!u) return;
    setSel({ regionId: u.regionId, unitIds: [id] });
    setTab('map');
  }

  const panelOpen = tab !== 'map' || !!sel.regionId;

  return (
    <div className={`game${atWarNow ? ' wartime' : ''}`}>
      <header className="topbar">
        <div className="tb-row">
          <div className="tb-country"><Flag c={me} size={16} /><span>{COUNTRY_DEFS[me].name}</span></div>
          <div className="tb-date" aria-live="polite" data-testid="date">{formatDate(state.hour, true)}</div>
        </div>
        <div className="tb-row">
          <div className="speed" role="group" aria-label="Velocidad">
            {SPEEDS.map((s) => (
              <button key={s.id} type="button" className={speed === s.id ? 'on' : ''} aria-pressed={speed === s.id}
                aria-label={s.label} title={s.label} data-speed={s.id} onClick={() => controller.setSpeed(s.id)}>
                <SpeedIcon id={s.id} />
              </button>
            ))}
          </div>
          <div className="tb-stats">
            <span title="Reservas"><small>Reservas</small>{money(c.reserves)}</span>
            <span title="Estabilidad" className={c.stability < 30 ? 'bad-text' : ''}><small>Estab.</small>{int(c.stability)}</span>
          </div>
        </div>
        {latest && <div className="ticker" key={`${latest.hour}${latest.text}`}>{latest.text}</div>}
      </header>

      <main className="stage">
        <MapView state={state} selection={{ regionId: sel.regionId, unitIds: validUnits }} orderMode={orderMode}
          onTapRegion={onTapRegion} onTapUnits={onTapUnits}
          onTapEmpty={() => { setOrderMode(false); setSel({ regionId: null, unitIds: [] }); }} />

        {orderMode && (
          <div className="order-banner" role="status">
            <span>Toca la región de destino para {validUnits.length} {validUnits.length > 1 ? 'batallones' : 'batallón'}</span>
            <button type="button" className="small" onClick={() => setOrderMode(false)}>Cancelar</button>
          </div>
        )}

        {panelOpen && (
          <div className={`sheet${tab === 'map' ? ' compact' : ''}`} data-testid="sheet">
            <div className="sheet-handle">
              <span className="sheet-title">{tab === 'map' ? 'Región' : TABS.find((t) => t.id === tab)!.label}</span>
              <button type="button" className="ghost small" aria-label="Cerrar panel"
                onClick={() => { if (tab === 'map') setSel({ regionId: null, unitIds: [] }); else setTab('map'); }}>Cerrar</button>
            </div>
            <div className="sheet-scroll">
              {tab === 'map' && sel.regionId && (
                <RegionPanel state={state} regionId={sel.regionId} selectedUnits={validUnits}
                  setSelectedUnits={(ids) => setSel((s) => ({ ...s, unitIds: ids }))} startOrder={startOrder} />
              )}
              {tab === 'economy' && <EconomyPanel state={state} />}
              {tab === 'diplomacy' && <DiplomacyPanel state={state} />}
              {tab === 'army' && <ArmyPanel state={state} onFocusUnit={focusUnit} />}
              {tab === 'game' && <GamePanel state={state} />}
            </div>
          </div>
        )}

        <div className="toasts" aria-live="polite">
          {controller.toasts.map((t) => <div key={t.id} className={`toast${t.ok ? '' : ' err'}`}>{t.text}</div>)}
        </div>
      </main>

      <nav className="tabbar" aria-label="Secciones">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined}
            data-tab={t.id} onClick={() => setTab(t.id)}>
            {t.label}
            {t.id === 'diplomacy' && inbox > 0 && <span className="badge">{inbox}</span>}
          </button>
        ))}
      </nav>

      {state.gameOver && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="go-title">
          <div className="overlay-card">
            <h2 id="go-title">Fin del mandato</h2>
            <p>{state.gameOver.reason}</p>
            <p className="muted">{formatDate(state.gameOver.hour)}</p>
            <div className="row">
              {controller.saves.some((s) => s.slot === 'auto') && <button type="button" className="primary" onClick={() => controller.load('auto')}>Cargar autoguardado</button>}
              <button type="button" onClick={() => controller.quitToMenu()}>Menú principal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
