/**
 * Capas cartográficas del Atlas de mando (ATLAS-001): estados reales, ríos y
 * lagos, vías por jerarquía e instalaciones (aeropuertos y puertos).
 *
 * Capa VISUAL: solo lee `src/atlas` (Natural Earth), nunca el motor. Mostrar u
 * ocultar estas capas no cambia la partida. Los trazados son estáticos y se
 * memorizan; las líneas usan vector-effect para no engordar al hacer zoom.
 */
import { memo } from 'react';
import { LAKES, RIVERS, ROAD_TIERS, STATES, type Facility } from '../../atlas';
import type { RoadTier } from './scale';
import type { Box } from './GeoLayers';

/** Radio del icono de instalación en píxeles de pantalla. */
export const FACILITY_R = 7;

export function facilityIconBox(f: Facility, k: number): Box {
  const r = (FACILITY_R + 1.5) * k;
  return { x0: f.xy[0] - r, y0: f.xy[1] - r, x1: f.xy[0] + r, y1: f.xy[1] + r };
}

/** Límites de estados/provincias. Cada estado es un trazado propio: sirve también para saber cuál se tocó. */
export const StatesLayer = memo(function StatesLayer() {
  return (
    <>
      {STATES.map((s) => <path key={s.id} d={s.path} data-state={s.id} className="state-line" vectorEffect="non-scaling-stroke" />)}
    </>
  );
});

/** Ríos (hasta un rango) y lagos. */
export const HydroLayer = memo(function HydroLayer({ maxRank }: { maxRank: number }) {
  return (
    <>
      {LAKES.filter((l) => l.rank <= maxRank + 1).map((l, i) => <path key={`l${i}`} d={l.path} className="lake" vectorEffect="non-scaling-stroke" />)}
      {RIVERS.filter((r) => r.rank <= maxRank).map((r, i) => (
        <path key={`r${i}`} d={r.path} className={`river r${Math.min(8, Math.max(3, r.rank))}`} vectorEffect="non-scaling-stroke" />
      ))}
    </>
  );
});

/** Vías en tres jerarquías: autopistas, troncales y secundarias (como Apple Maps, según la escala). */
export const RoadTiersLayer = memo(function RoadTiersLayer({ tiers }: { tiers: RoadTier[] }) {
  // Orden de dibujo: las menos importantes debajo.
  const order: RoadTier[] = ['secondary', 'trunk', 'motorway'];
  return (
    <g data-road-network="true" className="road">
      {order.filter((t) => tiers.includes(t)).map((t) => (
        <g key={t} data-road-tier={t} className={`road-tier ${t}`}>
          {t !== 'secondary' && <path d={ROAD_TIERS[t]} className="road-casing" vectorEffect="non-scaling-stroke" />}
          <path d={ROAD_TIERS[t]} className="road-line" vectorEffect="non-scaling-stroke" />
        </g>
      ))}
    </g>
  );
});

function AirportGlyph({ s }: { s: number }) {
  return <path d="M0,-5L0.9,-1.4L4.6,0.6V1.7L0.9,0.8L0.7,3.1L2,4V4.7L0,4.2L-2,4.7V4L-0.7,3.1L-0.9,0.8L-4.6,1.7V0.6L-0.9,-1.4Z" className="fac-glyph-fill" transform={`scale(${s})`} />;
}
function PortGlyph({ s }: { s: number }) {
  return (
    <g transform={`scale(${s})`} className="fac-glyph">
      <path d="M0,-3.4V4M-2,-1.7H2M-3.6,1.2C-3,3.4-1.4,4.2,0,4.2S3,3.4,3.6,1.2" />
      <circle cx="0" cy="-4.2" r="1" />
    </g>
  );
}

/** Aeropuertos y puertos: icono redondo con zona táctil amplia. */
export function FacilitiesLayer({ items, k, selectedId, labels }: {
  items: Facility[];
  k: number;
  selectedId: string | null;
  labels: { f: Facility; x: number; y: number; dx: number; dy: number; anchor: 'start' | 'end' }[];
}) {
  const r = FACILITY_R * k;
  return (
    <>
      {items.map((f) => (
        <g key={f.id} data-facility={f.id} data-facility-kind={f.kind} className={`facility ${f.kind}${f.id === selectedId ? ' sel' : ''}`}
          transform={`translate(${f.xy[0]} ${f.xy[1]})`} aria-label={`${f.kind === 'airport' ? 'Aeropuerto' : 'Puerto'}: ${f.name}`}>
          <circle r={14 * k} className="hit" />
          <circle r={r} className="fac-shape" style={{ strokeWidth: 0.9 * k }} />
          {f.kind === 'airport' ? <AirportGlyph s={k} /> : <PortGlyph s={k} />}
        </g>
      ))}
      <g pointerEvents="none">
        {labels.map(({ f, x, y, dx, dy, anchor }) => (
          <text key={f.id} x={x + dx} y={y + dy} textAnchor={anchor} className="label facility-label" data-facility-label={f.id} style={{ fontSize: 9 * k }}>
            {f.iata}
          </text>
        ))}
      </g>
    </>
  );
}
