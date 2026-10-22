/**
 * Fichas del Atlas (ATLAS-001): estado/provincia e instalación.
 * Solo hechos geográficos de Natural Earth y datos que el juego ya tiene;
 * no se muestran poblaciones, producciones ni capacidades inventadas.
 */
import type { CountryId } from '../../engine/types';
import { REGIONS, countryName } from '../../engine/world';
import { CITIES, formatLonLat } from '../../geo';
import { FACILITY_KIND_LABEL, facilitiesInState, facilityById, facilityName, facilityTypeLabel, stateById } from '../../atlas';
import type { Selection } from '../selection';
import { FlagIcon } from '../flags';
import { Fact, InfoCard, LinkList, SourceNote } from './InfoCard';

type SetSel = (s: Selection) => void;
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function CountryLink({ c, setSelection }: { c: CountryId; setSelection: SetSel }) {
  return (
    <button type="button" className="link-btn inline ic-country" onClick={() => setSelection({ kind: 'country', country: c })}>
      <FlagIcon c={c} size={18} /> {countryName(c)}
    </button>
  );
}

export function StateCard({ stateId, regionId, setSelection }: { stateId: string; regionId: string; setSelection: SetSel }) {
  const st = stateById(stateId);
  if (!st) return null;
  // Ciudades del juego situadas en este estado (MAP-001 calcula su provincia por posición).
  const cities = CITIES.filter((c) => c.country === st.country && c.province && norm(c.province) === norm(st.name)).sort((a, b) => a.rank - b.rank);
  const facilities = facilitiesInState(st.id);
  const otherRegions = st.regions.filter((r) => r !== regionId);
  return (
    <InfoCard kind="state-card" kicker={st.type ?? 'Estado'} icon="state" title={st.name}
      meta={<CountryLink c={st.country} setSelection={setSelection} />} onClose={() => setSelection({ kind: 'region', regionId })}>
      <Fact label="Capital" value={st.capital ?? <span className="muted">No identificada en la fuente</span>} />
      <Fact label="Región del juego" value={REGIONS[regionId].name} />
      {otherRegions.length > 0 && <Fact label="También en" value={otherRegions.map((r) => REGIONS[r].name).join(' · ')} />}
      {cities.length > 0 && (
        <>
          <div className="ic-sec">Ciudades del mapa</div>
          <LinkList items={cities.slice(0, 4).map((c) => ({ key: c.id, icon: 'city', label: c.name, hint: c.kind === 'capital' ? 'Capital' : undefined, onClick: () => setSelection({ kind: 'city', cityId: c.id }) }))} />
        </>
      )}
      {facilities.length > 0 && (
        <>
          <div className="ic-sec">Infraestructura</div>
          <LinkList items={facilities.map((f) => ({ key: f.id, icon: f.kind === 'airport' ? 'airport' : 'port', label: facilityName(f), hint: f.iata ?? undefined, onClick: () => setSelection({ kind: 'facility', facilityId: f.id }) }))} />
        </>
      )}
      <SourceNote>Límites y capital: Natural Earth. Los datos de la partida (población, PIB, control y tropas) son los de su región del juego, abajo.</SourceNote>
    </InfoCard>
  );
}

export function FacilityCard({ facilityId, setSelection }: { facilityId: string; setSelection: SetSel }) {
  const f = facilityById(facilityId);
  if (!f) return null;
  const st = f.state ? stateById(f.state) : undefined;
  return (
    <InfoCard kind={`facility-card ${f.kind}`} kicker={FACILITY_KIND_LABEL[f.kind]} icon={f.kind === 'airport' ? 'airport' : 'port'} title={facilityName(f)}
      meta={<>
        <CountryLink c={f.country} setSelection={setSelection} />
        {f.iata && <span className="chip" data-testid="facility-code">{f.iata}</span>}
      </>}
      onClose={() => setSelection({ kind: 'none' })}>
      <Fact label="Tipo (fuente)" value={facilityTypeLabel(f)} />
      {st && f.region && (
        <Fact label="Estado">
          <button type="button" className="link-btn inline" onClick={() => setSelection({ kind: 'state', stateId: st.id, regionId: f.region! })}>{st.name}</button>
        </Fact>
      )}
      {f.region && (
        <Fact label="Región del juego">
          <button type="button" className="link-btn inline" onClick={() => setSelection({ kind: 'region', regionId: f.region! })}>{REGIONS[f.region].name}</button>
        </Fact>
      )}
      <Fact label="Coordenadas" value={formatLonLat(f.lonlat)} />
      <Fact label="Uso en la partida" value={<span className="muted">Pendiente: todavía no influye en el juego</span>} muted />
      <SourceNote>{f.source}. Selección de instalaciones principales, no un inventario completo.</SourceNote>
    </InfoCard>
  );
}
