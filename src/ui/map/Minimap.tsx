import type { GameState } from '../../engine/types';
import { MAP, COUNTRY_IDS } from '../../engine/world';
import { COUNTRY_DEFS } from '../../data/countries';
import type { View } from './MapView';

/** Minimapa del continente con el encuadre actual. Tocar recentra el mapa. */
export function Minimap({ state, view, viewH, onCenter }: { state: GameState; view: View; viewH: number; onCenter: (x: number, y: number) => void }) {
  const pad = 40;
  const vb = { x: -pad, y: -pad, w: MAP.width + pad * 2, h: MAP.height + pad * 2 };

  function handle(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    // preserveAspectRatio meet: calcular la zona útil
    const scale = Math.min(r.width / vb.w, r.height / vb.h);
    const ox = r.left + (r.width - vb.w * scale) / 2, oy = r.top + (r.height - vb.h * scale) / 2;
    onCenter(vb.x + (e.clientX - ox) / scale, vb.y + (e.clientY - oy) / scale);
  }

  return (
    <div className="minimap" aria-label="Minimapa: toca para desplazarte">
      <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} onPointerDown={(e) => { e.stopPropagation(); handle(e); }}
        onPointerMove={(e) => { if (e.buttons || e.pointerType === 'touch') handle(e); }}>
        {COUNTRY_IDS.map((c) => (
          <path key={c} d={MAP.countries[c]} fill={COUNTRY_DEFS[c].color} className={`mini-country${c === state.player ? ' me' : ''}`} />
        ))}
        <rect x={view.x} y={view.y} width={view.w} height={viewH} className="mini-view" />
      </svg>
    </div>
  );
}
