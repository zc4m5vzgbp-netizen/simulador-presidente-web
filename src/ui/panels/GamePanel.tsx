import { useState } from 'react';
import type { GameState, LogKind } from '../../engine/types';
import { formatDate } from '../../engine/core';
import { controller } from '../controller';
import { ConfirmButton, Section } from '../widgets';
import { COUNTRY_DEFS } from '../../data/countries';

const SLOTS = ['1', '2', '3'];
const KIND_LABEL: Record<LogKind, string> = { info: 'Gobierno', economy: 'Economía', diplomacy: 'Diplomacia', military: 'Ejército', war: 'Guerra', alert: 'Alerta' };

export function NewsList({ state, onlyMine, limit = 60 }: { state: GameState; onlyMine: boolean; limit?: number }) {
  const items = state.log.filter((l) => !onlyMine || l.countries.includes(state.player) || l.kind === 'war').slice(-limit).reverse();
  if (!items.length) return <p className="muted">Sin noticias todavía.</p>;
  return (
    <ol className="news">
      {items.map((l, i) => (
        <li key={`${l.hour}-${i}`} className={`news-item k-${l.kind}`}>
          <span className="news-meta">{formatDate(l.hour)} · {KIND_LABEL[l.kind]}</span>
          <span>{l.text}</span>
        </li>
      ))}
    </ol>
  );
}

export function GamePanel({ state }: { state: GameState }) {
  const [onlyMine, setOnlyMine] = useState(true);
  const saves = controller.saves;
  return (
    <div className="panel-body">
      {__PREVIEW__ && <VerificationTool />}
      <Section title="Guardar partida">
        <div className="slot-row">
          {SLOTS.map((s) => (
            <button key={s} type="button" className="slot" data-slot={s} onClick={() => controller.save(s)}>
              Ranura {s}
              <span className="muted small-text">{saves.find((x) => x.slot === s) ? formatDate(saves.find((x) => x.slot === s)!.hour) : 'vacía'}</span>
            </button>
          ))}
        </div>
        <p className="muted small-text">Se guarda en este navegador. Además hay un autoguardado cada mes de juego.</p>
      </Section>

      <Section title="Cargar partida">
        {saves.length === 0 && <p className="muted">No hay partidas guardadas.</p>}
        <ul className="plain saves">
          {saves.map((s) => (
            <li key={s.slot} className="row-between">
              <span>
                <strong>{s.slot === 'auto' ? 'Autoguardado' : `Ranura ${s.slot}`}</strong>
                <span className="muted small-text"> · {COUNTRY_DEFS[s.player].name} · {formatDate(s.hour)}</span>
              </span>
              <span className="row">
                <ConfirmButton className="small" label="Cargar" confirmLabel="Cargar (se pierde lo no guardado)" onConfirm={() => controller.load(s.slot)} />
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Noticias" aside={
        <label className="toggle" htmlFor="news-filter">
          <input id="news-filter" type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> Solo relevantes
        </label>}>
        <NewsList state={state} onlyMine={onlyMine} />
      </Section>

      <Section title="Partida">
        <ConfirmButton className="danger" label="Salir al menú principal" confirmLabel="Salir sin guardar" onConfirm={() => controller.quitToMenu()} />
        <p className="muted small-text">Datos iniciales simplificados y estimados para el juego; no son estadísticas oficiales. Fronteras: Natural Earth (dominio público).</p>
      </Section>
    </div>
  );
}

/**
 * Solo en la vista previa privada: acelera el reloj para comprobar en minutos lo
 * que en partida dura horas reales. NO es una velocidad del juego (las aprobadas
 * siguen siendo pausa, ×1, ×2 y ×4) ni existe en la compilación publicable.
 */
function VerificationTool() {
  const [on, setOn] = useState(controller.timeScale > 1);
  const toggle = () => { controller.timeScale = on ? 1 : 30; setOn(!on); controller.emit(); };
  return (
    <Section title="Herramienta de verificación (vista previa)">
      <label className="switch">
        <input type="checkbox" id="verify-fast" checked={on} onChange={toggle} />
        <span>{on ? 'Reloj acelerado ×30 activo' : 'Acelerar el reloj ×30 para pruebas'}</span>
      </label>
      <p className="notice warn small-text">Solo existe en esta vista previa privada para comprobar marchas y batallas en pocos minutos. No es una velocidad del juego: las velocidades aprobadas siguen siendo pausa, ×1, ×2 y ×4.</p>
    </Section>
  );
}
