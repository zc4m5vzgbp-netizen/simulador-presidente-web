import { useState } from 'react';
import type { CountryId, GameState, PeaceTerms } from '../../engine/types';
import { COUNTRY_IDS, countryName, neighborCountries } from '../../engine/world';
import { atWar, inTruce, sameSide, warBetween, warsOf } from '../../engine/war';
import { diplomacyCost, evaluateProposal, getRelation, hasTrade, type ProposalInput } from '../../engine/diplomacy';
import { countryPower } from '../../engine/military';
import { pairKey } from '../../engine/core';
import { controller } from '../controller';
import { ConfirmButton, CountryTag, RelationBar, Section, Stat } from '../widgets';
import { money, people, relationLabel, int } from '../format';

const KIND: Record<string, string> = { trade: 'Acuerdo comercial', peace: 'Tratado de paz', military_support: 'Entrar en su guerra' };

function Hint({ state, to, input }: { state: GameState; to: CountryId; input: ProposalInput }) {
  const ev = evaluateProposal(state, to, state.player, input);
  return <span className={`hint ${ev.accept ? 'good-text' : 'bad-text'}`}>Asesores: {ev.accept ? 'probablemente acepte' : 'probablemente rechace'} ({ev.reason})</span>;
}

export function DiplomacyPanel({ state, initialCountry = null }: { state: GameState; initialCountry?: CountryId | null }) {
  const [sel, setSel] = useState<CountryId | null>(initialCountry && initialCountry !== state.player ? initialCountry : null);
  const [aid, setAid] = useState('');
  const me = state.player;
  const others = COUNTRY_IDS.filter((c) => c !== me);
  const neighbors = neighborCountries(me);
  const inbox = state.proposals.filter((p) => p.to === me);

  if (sel) {
    const c = state.countries[sel];
    const rel = getRelation(state, me, sel);
    const war = warBetween(state, me, sel);
    const myWars = warsOf(state, me).filter((w) => !w.attackers.includes(sel) && !w.defenders.includes(sel));
    const truce = inTruce(state, me, sel);
    const trucePeace = (state.truces[pairKey(me, sel)] ?? 0) - state.hour;
    return (
      <div className="panel-body">
        <button type="button" className="ghost back" onClick={() => setSel(null)}>← Todos los países</button>
        <header className="region-head">
          <div>
            <h2><CountryTag c={sel} /></h2>
            <div className="region-sub">
              <span>{relationLabel(rel)} ({int(rel)})</span>
              {war && <span className="chip war">en guerra</span>}
              {hasTrade(state, me, sel) && <span className="chip trade">comercio</span>}
              {truce && <span className="chip">tregua {Math.ceil(trucePeace / 24)} d</span>}
              {sameSide(state, me, sel) && <span className="chip ally">aliado de guerra</span>}
              {c.eliminated && <span className="chip war">sin territorio</span>}
            </div>
          </div>
        </header>
        <RelationBar value={rel} />
        <div className="stat-grid compact">
          <Stat label="PIB" value={money(c.gdp)} />
          <Stat label="Población" value={people(c.population)} />
          <Stat label="Estabilidad" value={int(c.stability)} />
          <Stat label="Fuerza militar" value={countryPower(state, sel).toFixed(0)} sub={`la tuya: ${countryPower(state, me).toFixed(0)}`} />
        </div>

        {!war && (
          <Section title="Relaciones">
            <div className="action-list">
              <button type="button" onClick={() => controller.act({ type: 'improveRelations', target: sel })}>Misión diplomática (+10) · {money(diplomacyCost(state, me))}</button>
              <button type="button" onClick={() => controller.act({ type: 'worsenRelations', target: sel })}>Protesta formal (−15)</button>
            </div>
          </Section>
        )}

        {!war && (
          <Section title="Ayuda económica">
            <div className="row">
              <input id="aid-amount" className="num-input" type="number" inputMode="decimal" min={0} step={0.1} placeholder="mil M USD" value={aid} onChange={(e) => setAid(e.target.value)} />
              <button type="button" onClick={() => { const r = controller.act({ type: 'sendAid', target: sel, amount: Number(aid) }); if (r.ok) setAid(''); }}>Enviar</button>
            </div>
            <p className="muted small-text">Se descuenta de tus reservas ({money(state.countries[me].reserves)}) y se suma a las suyas.</p>
          </Section>
        )}

        {!war && (
          <Section title="Comercio">
            {hasTrade(state, me, sel)
              ? <button type="button" onClick={() => controller.act({ type: 'cancelTrade', target: sel })}>Cancelar acuerdo comercial (−10)</button>
              : <div className="action-list">
                  <button type="button" onClick={() => controller.act({ type: 'propose', target: sel, kind: 'trade' })}>Proponer acuerdo comercial</button>
                  <Hint state={state} to={sel} input={{ kind: 'trade' }} />
                </div>}
          </Section>
        )}

        {myWars.length > 0 && !war && (
          <Section title="Apoyo militar">
            <div className="action-list">
              {myWars.map((w) => (
                <div key={w.id} className="action-list">
                  <button type="button" onClick={() => controller.act({ type: 'propose', target: sel, kind: 'military_support', warId: w.id })}>Pedir que entre en la {w.name}</button>
                  <Hint state={state} to={sel} input={{ kind: 'military_support', warId: w.id }} />
                </div>
              ))}
            </div>
          </Section>
        )}

        {war ? (
          <Section title="Negociar la paz">
            <div className="action-list">
              {(['white', 'status_quo'] as PeaceTerms[]).map((t) => (
                <div key={t} className="action-list">
                  <button type="button" onClick={() => controller.act({ type: 'propose', target: sel, kind: 'peace', terms: t })}>
                    {t === 'white' ? 'Paz blanca: se devuelven los territorios ocupados' : 'Status quo: cada parte se queda lo que ocupa'}
                  </button>
                  <Hint state={state} to={sel} input={{ kind: 'peace', terms: t }} />
                </div>
              ))}
            </div>
          </Section>
        ) : (
          <Section title="Guerra">
            <ConfirmButton className="danger" label={`Declarar la guerra a ${countryName(sel)}`} confirmLabel="Confirmar declaración de guerra"
              disabled={truce || sameSide(state, me, sel) || c.eliminated}
              onConfirm={() => controller.act({ type: 'declareWar', target: sel })} />
            <p className="muted small-text">Empeora tus relaciones con terceros países y, si no hay un conflicto previo (relación por encima de −40), resta estabilidad.</p>
          </Section>
        )}
      </div>
    );
  }

  return (
    <div className="panel-body">
      {inbox.length > 0 && (
        <Section title={`Propuestas recibidas (${inbox.length})`}>
          <div className="inbox">
            {inbox.map((p) => (
              <div key={p.id} className="proposal">
                <div><CountryTag c={p.from} /> propone: <strong>{KIND[p.kind]}</strong>
                  {p.kind === 'peace' && <> ({p.terms === 'white' ? 'paz blanca' : 'cada uno conserva lo ocupado'})</>}
                  {p.kind === 'military_support' && <> en la {state.wars.find((w) => w.id === p.warId)?.name ?? 'guerra'}</>}
                </div>
                <div className="muted small-text">Caduca en {Math.max(1, Math.ceil((p.expiresHour - state.hour) / 24))} días</div>
                <div className="row">
                  <button type="button" className="primary small" onClick={() => controller.act({ type: 'respondProposal', proposalId: p.id, accept: true })}>Aceptar</button>
                  <button type="button" className="small" onClick={() => controller.act({ type: 'respondProposal', proposalId: p.id, accept: false })}>Rechazar</button>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
      <Section title="Países">
        <ul className="country-list">
          {others.sort((a, b) => getRelation(state, me, b) - getRelation(state, me, a)).map((o) => {
            const rel = getRelation(state, me, o);
            return (
              <li key={o}>
                <button type="button" className="country-row" onClick={() => setSel(o)}>
                  <span className="row-between">
                    <CountryTag c={o} />
                    <span className="chips">
                      {atWar(state, me, o) && <span className="chip war">guerra</span>}
                      {sameSide(state, me, o) && <span className="chip ally">aliado</span>}
                      {hasTrade(state, me, o) && <span className="chip trade">comercio</span>}
                      {neighbors.includes(o) && <span className="chip">vecino</span>}
                      <span className="num rel">{rel > 0 ? '+' : ''}{int(rel)}</span>
                    </span>
                  </span>
                  <RelationBar value={rel} />
                </button>
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}

