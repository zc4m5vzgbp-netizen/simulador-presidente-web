import { useEffect, useState } from 'react';
import type { GameState, Policy } from '../../engine/types';
import { annualFlows, interestRate, POLICY_LIMITS, taxEfficiency } from '../../engine/economy';
import { upkeepNeeded } from '../../engine/military';
import { tradeCount } from '../../engine/diplomacy';
import { controller } from '../controller';
import { Meter, Section, Stat } from '../widgets';
import { money, pct, people, signedPct } from '../format';

const LABELS: Record<keyof Policy, { name: string; help: string }> = {
  taxRate: { name: 'Impuestos', help: 'Más ingresos; resta estabilidad y algo de crecimiento.' },
  publicSpending: { name: 'Gasto público', help: 'Sostiene la estabilidad; cuesta dinero.' },
  investment: { name: 'Inversión pública', help: 'Impulsa el crecimiento a medio plazo.' },
  militaryBudget: { name: 'Presupuesto militar', help: 'Paga el mantenimiento de los batallones.' },
};

export function EconomyPanel({ state }: { state: GameState }) {
  const c = state.countries[state.player];
  const [draft, setDraft] = useState<Policy>({ ...c.policy });
  const [debtPay, setDebtPay] = useState('');
  const policyKey = JSON.stringify(c.policy);
  useEffect(() => { setDraft({ ...c.policy }); }, [policyKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const flows = annualFlows(state, c.id);
  const dirty = (Object.keys(draft) as (keyof Policy)[]).some((k) => draft[k] !== c.policy[k]);
  const projRevenue = c.gdp * draft.taxRate / 100 * taxEfficiency(c);
  const projSpending = c.gdp * (draft.publicSpending + draft.investment + draft.militaryBudget) / 100 + c.debt * interestRate(c);
  const projBalance = projRevenue - projSpending;
  const need = upkeepNeeded(state, c.id);
  const projSupply = need > 0 ? (c.gdp * draft.militaryBudget / 100) / need : 2;
  const debtRatio = c.gdp > 0 ? c.debt / c.gdp * 100 : 0;
  const rep = c.lastReport;

  return (
    <div className="panel-body">
      <div className="stat-grid">
        <Stat label="PIB anual" value={money(c.gdp)} sub={`${signedPct(c.growth)} / año`} tone={c.growth < 0 ? 'bad' : undefined} />
        <Stat label="Población" value={people(c.population)} />
        <Stat label="Reservas" value={money(c.reserves)} tone={c.reserves <= 0 ? 'bad' : undefined} />
        <Stat label="Deuda pública" value={money(c.debt)} sub={`${pct(debtRatio, 0)} del PIB · interés ${pct(interestRate(c) * 100)}`} tone={debtRatio > 100 ? 'bad' : debtRatio > 70 ? 'warn' : undefined} />
        <Stat label="Ingresos fiscales" value={`${money(flows.revenue)}/año`} />
        <Stat label="Gasto del Estado" value={`${money(flows.spending)}/año`} sub={`de ello intereses ${money(flows.interest)}`} />
        <Stat label="Saldo presupuestario" value={`${money(flows.balance)}/año`} tone={flows.balance < 0 ? 'bad' : 'good'} />
        <Stat label="Acuerdos comerciales" value={tradeCount(state, c.id)} sub="+0,35 % de crecimiento c/u" />
      </div>

      <Section title="Estabilidad nacional" aside={<span className="num">{Math.round(c.stability)} / 100</span>}>
        <Meter value={c.stability} tone={c.stability < 30 ? 'bad' : c.stability < 50 ? 'warn' : 'good'} label="Estabilidad" />
        {c.stability < 20 && <p className="notice bad">Riesgo de crisis de gobierno: si la estabilidad llega a 3, serás destituido.</p>}
      </Section>

      <Section title="Política económica" aside={<span className="muted small-text">% del PIB</span>}>
        <div className="sliders">
          {(Object.keys(LABELS) as (keyof Policy)[]).map((k) => {
            const [min, max] = POLICY_LIMITS[k];
            const changed = draft[k] !== c.policy[k];
            return (
              <label key={k} className={`slider${changed ? ' changed' : ''}`} htmlFor={`pol-${k}`}>
                <span className="slider-head">
                  <span>{LABELS[k].name}</span>
                  <span className="num">{pct(draft[k])}{changed && <span className="was"> (antes {pct(c.policy[k])})</span>}</span>
                </span>
                <input id={`pol-${k}`} type="range" min={min} max={max} step={0.1} value={draft[k]}
                  onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value) })} />
                <span className="slider-help">{LABELS[k].help}</span>
              </label>
            );
          })}
        </div>
        <div className="projection">
          <span>Proyección anual</span>
          <span className="num">Ingresos {money(projRevenue)}</span>
          <span className="num">Gastos {money(projSpending)}</span>
          <span className={`num ${projBalance < 0 ? 'bad-text' : 'good-text'}`}>Saldo {money(projBalance)}</span>
          <span className={`num ${projSupply < 1 ? 'bad-text' : ''}`}>Abastecimiento militar {pct(projSupply * 100, 0)}</span>
        </div>
        <div className="row">
          <button type="button" className="primary" disabled={!dirty} onClick={() => controller.act({ type: 'setPolicy', patch: draft })}>Aplicar cambios</button>
          <button type="button" className="ghost" disabled={!dirty} onClick={() => setDraft({ ...c.policy })}>Descartar</button>
        </div>
        <p className="muted small-text">Las subidas de impuestos y los recortes de gasto restan estabilidad al instante. El crecimiento y la estabilidad se recalculan en cada cierre mensual.</p>
      </Section>

      <Section title="Amortizar deuda">
        <div className="row">
          <input id="debt-pay" className="num-input" type="number" inputMode="decimal" min={0} step={0.1} placeholder="mil M USD" value={debtPay} onChange={(e) => setDebtPay(e.target.value)} />
          <button type="button" onClick={() => { const r = controller.act({ type: 'payDebt', amount: Number(debtPay) }); if (r.ok) setDebtPay(''); }}>Pagar</button>
        </div>
      </Section>

      {rep && (
        <Section title="Último cierre mensual">
          <div className="stat-grid compact">
            <Stat label="Recaudado" value={money(rep.revenue)} />
            <Stat label="Gastado" value={money(rep.spending)} />
            <Stat label="Saldo del mes" value={money(rep.balance)} tone={rep.balance < 0 ? 'bad' : 'good'} />
            <Stat label="Crecimiento" value={signedPct(rep.growth)} />
          </div>
        </Section>
      )}
    </div>
  );
}
