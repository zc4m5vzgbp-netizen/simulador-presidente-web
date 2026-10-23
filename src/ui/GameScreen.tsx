/**
 * Pantalla de juego horizontal: barra superior + navegación lateral (izquierda)
 * + mapa estratégico (centro) + panel contextual o de sección (derecha).
 */
import { useEffect, useState } from 'react';
import type { CountryId, GameState } from '../engine/types';
import { formatDate } from '../engine/core';
import { REGIONS, countryName } from '../engine/world';
import { atWar, sameSide } from '../engine/war';
import { controller } from './controller';
import { MapView } from './map/MapView';
import { defaultVisibility, type LayerVisibility } from './map/layers';
import { TopBar } from './layout/TopBar';
import { NavRail, SECTIONS, type SectionId } from './layout/NavRail';
import { ContextPanel } from './layout/ContextPanel';
import { EconomyPanel } from './panels/EconomyPanel';
import { DiplomacyPanel } from './panels/DiplomacyPanel';
import { ArmyPanel } from './panels/ArmyPanel';
import { GamePanel } from './panels/GamePanel';
import { StatsPanel } from './panels/StatsPanel';
import { FuturePanel } from './panels/FuturePanel';
import { cleanSelection, NO_SELECTION, type Selection } from './selection';
import { Icon } from './icons';

export function GameScreen({ state }: { state: GameState }) {
  const [section, setSection] = useState<SectionId>('map');
  const [rawSel, setSelection] = useState<Selection>(NO_SELECTION);
  const [orderMode, setOrderMode] = useState(false);
  const [pendingAttack, setPendingAttack] = useState<{ regionId: string; enemy: CountryId } | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [layers, setLayers] = useState<LayerVisibility>(defaultVisibility);
  const [diploCountry, setDiploCountry] = useState<CountryId | null>(null);
  const selection = cleanSelection(state, rawSel);
  const me = state.player;
  const inbox = state.proposals.filter((p) => p.to === me).length;
  const orderIds = selection.kind === 'units' && selection.owner === me
    ? selection.unitIds.filter((id) => { const u = state.units[id]; return u && u.status !== 'retreating'; })
    : [];

  function select(s: Selection) {
    setSelection(s);
    setOrderMode(false);
    setCollapsed(false);
    if (section !== 'map') setSection('map');
  }

  function openSection(id: SectionId, country?: CountryId) {
    setDiploCountry(country ?? null);
    setSection(id);
    setOrderMode(false);
  }

  function startOrder(regionId: string, ids: string[]) {
    if (!ids.length) return;
    setSelection({ kind: 'units', regionId, owner: me, unitIds: ids });
    setSection('map');
    setOrderMode(true);
  }

  function onTapRegion(regionId: string, stateId?: string) {
    if (orderMode && orderIds.length) {
      // Destino de un país con el que no hay guerra ni alianza: ataque directo, solo con confirmación (MIL-082 B).
      const ctrl = state.regions[regionId].controller;
      if (ctrl !== me && !atWar(state, me, ctrl) && !sameSide(state, me, ctrl)) {
        setPendingAttack({ regionId, enemy: ctrl });
        return;
      }
      controller.actBatch(
        orderIds.map((id) => ({ type: 'move' as const, unitId: id, target: regionId })),
        (n) => `${n} ${n > 1 ? 'batallones' : 'batallón'} en marcha hacia ${REGIONS[regionId].name}.`,
      );
      setOrderMode(false);
      return;
    }
    // Atlas: a escala Nación/Región se selecciona el estado real bajo el dedo (su ficha incluye la región del juego).
    select(stateId ? { kind: 'state', stateId, regionId } : { kind: 'region', regionId });
  }

  function onTapUnits(regionId: string, owner: CountryId) {
    const ids = Object.values(state.units).filter((u) => u.owner === owner && u.regionId === regionId).map((u) => u.id);
    select(ids.length ? { kind: 'units', regionId, owner, unitIds: ids } : { kind: 'region', regionId });
  }

  const sectionDef = SECTIONS.find((s) => s.id === section);
  const sideTitle = section === 'game' ? { title: 'Partida', subtitle: 'Guardar, cargar y noticias' }
    : { title: sectionDef?.label ?? '', subtitle: sectionDef?.available ? 'Sección' : 'En desarrollo' };
  const sideOpen = section !== 'map' || !collapsed;

  return (
    <div className="game">
      <TopBar state={state} optionsOpen={section === 'game'} onOptions={() => openSection(section === 'game' ? 'map' : 'game')} onInbox={() => openSection('diplomacy')} />
      <div className={`game-body${section !== 'map' ? ' wide' : ''}${sideOpen ? '' : ' collapsed'}`}>
        <NavRail active={section === 'game' ? 'map' : section} onSelect={(id) => openSection(id)} badges={{ diplomacy: inbox }} />

        <main className="stage">
          <MapView state={state} selection={selection} orderMode={orderMode} layers={layers}
            onToggleLayer={(id) => setLayers((l) => ({ ...l, [id]: !(l[id] !== false) }))}
            onTapRegion={onTapRegion} onTapUnits={onTapUnits}
            onTapCity={(cityId) => select({ kind: 'city', cityId })}
            onTapCrossing={(crossingId) => select({ kind: 'crossing', crossingId })}
            onTapFacility={(facilityId) => select({ kind: 'facility', facilityId })}
            onTapArmy={(country) => select({ kind: 'country', country })}
            onTapBattle={(battleId) => select({ kind: 'battle', battleId })}
            onTapEmpty={() => { setOrderMode(false); setSelection(NO_SELECTION); }} />

          {pendingAttack && (
            <AttackConfirm enemy={countryName(pendingAttack.enemy)} region={REGIONS[pendingAttack.regionId].name}
              onCancel={() => { setPendingAttack(null); setOrderMode(false); }}
              onConfirm={() => {
                controller.act({ type: 'directAttack', unitIds: orderIds, target: pendingAttack.regionId });
                setPendingAttack(null); setOrderMode(false);
              }} />
          )}

          {orderMode && !pendingAttack && (
            <div className="order-banner" role="status">
              <span>Toca la región de destino · {orderIds.length} {orderIds.length > 1 ? 'batallones' : 'batallón'}</span>
              <button type="button" className="small" onClick={() => setOrderMode(false)}>Cancelar</button>
            </div>
          )}

          <div className="toasts" aria-live="polite">
            {controller.toasts.map((t) => <div key={t.id} className={`toast${t.ok ? '' : ' err'}`}>{t.text}</div>)}
          </div>

          {section === 'map' && (
            <button type="button" className={`side-handle${sideOpen ? '' : ' closed'}`} data-action="toggle-panel" aria-expanded={sideOpen}
              aria-label={sideOpen ? 'Contraer panel de información' : 'Mostrar panel de información'} onClick={() => setCollapsed(sideOpen)}>
              <Icon name={sideOpen ? 'chevronRight' : 'chevronLeft'} size={18} />
            </button>
          )}
        </main>

        {sideOpen && (
          <aside className={`side${section === 'map' ? ' cards-mode' : ''}`} data-testid="side" aria-label="Información">
            {section !== 'map' && <header className="side-head">
              <div className="side-titles">
                <span className="side-sub">{sideTitle.subtitle}</span>
                <h2 className="side-title">{sideTitle.title}</h2>
              </div>
              <button type="button" className="icon-btn" aria-label="Volver al mapa" onClick={() => openSection('map')}>
                <Icon name="close" />
              </button>
            </header>}
            <div className="side-scroll">
              {section === 'map' && (
                <ContextPanel state={state} selection={selection} setSelection={select} startOrder={startOrder} openSection={openSection} onCollapse={() => setCollapsed(true)} />
              )}
              {section === 'economy' && <EconomyPanel state={state} />}
              {section === 'diplomacy' && <DiplomacyPanel key={diploCountry ?? 'all'} state={state} initialCountry={diploCountry} />}
              {section === 'army' && (
                <ArmyPanel state={state} onFocusUnit={(id) => {
                  const u = state.units[id];
                  if (u) select({ kind: 'units', regionId: u.regionId, owner: me, unitIds: [id] });
                }} onOpenBattle={(battleId) => select({ kind: 'battle', battleId })} />
              )}
              {section === 'stats' && <StatsPanel state={state} onPick={(c) => select({ kind: 'country', country: c })} />}
              {(section === 'government' || section === 'research' || section === 'espionage') && <FuturePanel section={section} />}
              {section === 'game' && <GamePanel state={state} />}
            </div>
          </aside>
        )}
      </div>

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

/**
 * Confirmación del ataque directo. Aparece bajo el dedo que tocó el mapa: sus
 * botones no responden durante 400 ms para que el «clic» de ese mismo toque no
 * confirme (ni cancele) el ataque sin querer.
 */
function AttackConfirm({ enemy, region, onCancel, onConfirm }: { enemy: string; region: string; onCancel: () => void; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { const t = setTimeout(() => setArmed(true), 400); return () => clearTimeout(t); }, []);
  return (
    <div className="attack-confirm" role="alertdialog" aria-label="Confirmar ataque directo">
      <p><strong>¿Atacar {enemy} sin declarar la guerra?</strong> Tus batallones marcharán hacia {region}. Empieza una guerra; el resto de países lo castigará en sus relaciones y tu estabilidad baja.</p>
      <div className="ac-actions">
        <button type="button" disabled={!armed} onClick={onCancel}>Cancelar</button>
        <button type="button" className="danger" data-action="confirm-attack" disabled={!armed} onClick={onConfirm}>Atacar</button>
      </div>
    </div>
  );
}
