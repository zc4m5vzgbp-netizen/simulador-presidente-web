import { useEffect, useRef, useState } from 'react';
import type { CountryId, GameState, Unit } from '../engine/types';
import { MAP, REGIONS, COUNTRY_IDS } from '../engine/world';
import { COUNTRY_DEFS } from '../data/countries';
import { atWar } from '../engine/war';

export interface MapSelection {
  regionId: string | null;
  unitIds: string[];
}

interface Props {
  state: GameState;
  selection: MapSelection;
  orderMode: boolean;
  onTapRegion: (regionId: string) => void;
  onTapUnits: (regionId: string, owner: CountryId) => void;
  onTapEmpty: () => void;
}

interface View { x: number; y: number; w: number }

const MIN_W = 140;
const MAX_W = MAP.width * 1.25;

function screenAspect(): number {
  if (typeof window === 'undefined') return 1.4;
  return Math.max(0.5, (window.innerHeight * 0.72) / Math.max(window.innerWidth, 1));
}

function initialView(player: CountryId, aspect = screenAspect()): View {
  const pts = Object.values(REGIONS).filter((r) => r.country === player).map((r) => r.anchor);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const w = Math.max(520, (Math.max(...xs) - Math.min(...xs)) * 2.4, (Math.max(...ys) - Math.min(...ys)) * 1.4);
  // Centrado en la mitad superior: la hoja inferior tapa parte del mapa en el móvil.
  return { x: cx - w / 2, y: cy - w * aspect * 0.42, w };
}

function countryLabelPos(c: CountryId): [number, number] {
  const pts = Object.values(REGIONS).filter((r) => r.country === c).map((r) => r.anchor);
  return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
}
const COUNTRY_LABELS = Object.fromEntries(COUNTRY_IDS.map((c) => [c, countryLabelPos(c)])) as Record<CountryId, [number, number]>;

function unitPos(u: Unit): [number, number] {
  const a = REGIONS[u.regionId].anchor;
  if (!u.path.length || u.progress <= 0) return a;
  const b = REGIONS[u.path[0]].anchor;
  return [a[0] + (b[0] - a[0]) * u.progress, a[1] + (b[1] - a[1]) * u.progress];
}

export function MapView({ state, selection, orderMode, onTapRegion, onTapUnits, onTapEmpty }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 390, h: 600 });
  const [view, setView] = useState<View>(() => initialView(state.player));
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ startX: number; startY: number; moved: boolean; t: number; pinchDist?: number; pinchView?: View; pinchCenter?: [number, number] } | null>(null);

  useEffect(() => { setView(initialView(state.player)); }, [state.player]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth || 390, h: el.clientHeight || 600 }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const h = view.w * (size.h / size.w);
  const k = view.w / size.w; // unidades de mapa por píxel de pantalla

  function toMap(clientX: number, clientY: number): [number, number] {
    const rect = svgRef.current!.getBoundingClientRect();
    return [view.x + ((clientX - rect.left) / rect.width) * view.w, view.y + ((clientY - rect.top) / rect.height) * h];
  }

  function zoomAt(factor: number, mx: number, my: number, base: View = view): View {
    const w = Math.min(MAX_W, Math.max(MIN_W, base.w * factor));
    const f = w / base.w;
    return { x: mx - (mx - base.x) * f, y: my - (my - base.y) * f, w };
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      gesture.current = { startX: e.clientX, startY: e.clientY, moved: false, t: performance.now() };
    } else if (pointers.current.size === 2) {
      const [p, q] = [...pointers.current.values()];
      gesture.current = {
        startX: 0, startY: 0, moved: true, t: 0,
        pinchDist: Math.hypot(p.x - q.x, p.y - q.y),
        pinchView: view,
        pinchCenter: toMap((p.x + q.x) / 2, (p.y + q.y) / 2),
      };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    if (pointers.current.size >= 2 && g.pinchDist && g.pinchView && g.pinchCenter) {
      const [p, q] = [...pointers.current.values()];
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      setView(zoomAt(g.pinchDist / Math.max(d, 1), g.pinchCenter[0], g.pinchCenter[1], g.pinchView));
      return;
    }
    if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) > 8) g.moved = true;
    if (g.moved) {
      const dx = (e.clientX - prev.x) * k, dy = (e.clientY - prev.y) * k;
      setView((v) => ({ ...v, x: v.x - dx, y: v.y - dy }));
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const g = gesture.current;
    const wasSingle = pointers.current.size === 1;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) gesture.current = null;
    if (!g || !wasSingle || g.moved || performance.now() - g.t > 700) return;
    const target = document.elementFromPoint(e.clientX, e.clientY) as Element | null;
    const unitEl = target?.closest('[data-units]');
    const regionEl = target?.closest('[data-region]');
    if (unitEl && !orderMode) {
      onTapUnits(unitEl.getAttribute('data-units')!, unitEl.getAttribute('data-owner') as CountryId);
    } else if (regionEl) {
      onTapRegion(regionEl.getAttribute('data-region')!);
    } else if (unitEl) {
      onTapRegion(unitEl.getAttribute('data-units')!);
    } else onTapEmpty();
  }

  function onWheel(e: React.WheelEvent) {
    const [mx, my] = toMap(e.clientX, e.clientY);
    setView(zoomAt(e.deltaY > 0 ? 1.15 : 1 / 1.15, mx, my));
  }

  function zoomButton(f: number) {
    setView((v) => zoomAt(f, v.x + v.w / 2, v.y + (v.w * size.h / size.w) / 2, v));
  }

  // ----- unidades agrupadas -----
  const stacks = (() => {
    const groups = new Map<string, { regionId: string; owner: CountryId; units: Unit[] }>();
    const moving: Unit[] = [];
    for (const u of Object.values(state.units)) {
      if (u.path.length && u.progress > 0) { moving.push(u); continue; }
      const key = `${u.regionId}|${u.owner}`;
      if (!groups.has(key)) groups.set(key, { regionId: u.regionId, owner: u.owner, units: [] });
      groups.get(key)!.units.push(u);
    }
    return { groups: [...groups.values()], moving };
  })();

  const selectedUnits = selection.unitIds.map((id) => state.units[id]).filter(Boolean);
  const showRegionLabels = view.w < 520;
  const markerW = 30 * k, markerH = 20 * k;

  // Desplazamiento horizontal de varios grupos en la misma región
  const offsets: Record<string, number> = {};

  return (
    <div className="map-wrap">
      <svg
        ref={svgRef}
        className={`map${orderMode ? ' order-mode' : ''}`}
        viewBox={`${view.x} ${view.y} ${view.w} ${h}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={(e) => { pointers.current.delete(e.pointerId); gesture.current = null; }}
        onWheel={onWheel}
        role="application"
        aria-label="Mapa político de Sudamérica"
      >
        <defs>
          {COUNTRY_IDS.map((c) => (
            <pattern key={c} id={`occ-${c}`} patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
              <rect width="3.5" height="8" fill={COUNTRY_DEFS[c].color} />
            </pattern>
          ))}
        </defs>
        <rect x={-2000} y={-2000} width={6000} height={6000} className="sea" />
        <g className="graticule">
          {Array.from({ length: 12 }, (_, i) => <line key={`v${i}`} x1={i * 100} y1={-200} x2={i * 100} y2={MAP.height + 200} />)}
          {Array.from({ length: 20 }, (_, i) => <line key={`h${i}`} x1={-200} y1={i * 100} x2={MAP.width + 200} y2={i * 100} />)}
        </g>
        {MAP.neutral.map((n) => <path key={n.name} d={n.path} className="neutral" />)}

        {Object.values(state.regions).map((r) => {
          const reg = REGIONS[r.id];
          const selected = selection.regionId === r.id;
          const enemy = atWar(state, state.player, r.controller);
          return (
            <g key={r.id} data-region={r.id} className={`region${selected ? ' selected' : ''}${enemy ? ' enemy' : ''}`}>
              <path d={reg.path} fill={COUNTRY_DEFS[r.controller].color} className="region-fill" />
              {r.controller !== r.owner && <path d={reg.path} fill={`url(#occ-${r.owner})`} className="region-occ" />}
              <path d={reg.path} className="region-edge" style={{ strokeWidth: (selected ? 2.6 : 0.6) * k }} />
            </g>
          );
        })}
        {COUNTRY_IDS.map((c) => (
          <path key={c} d={MAP.countries[c]} className={`country-edge${c === state.player ? ' player' : ''}`}
            style={{ strokeWidth: (c === state.player ? 2.2 : 1.3) * k }} />
        ))}

        {/* Etiquetas */}
        {!showRegionLabels && COUNTRY_IDS.map((c) => {
          const [x, y] = COUNTRY_LABELS[c];
          return <text key={c} x={x} y={y - 26 * k} className="label country-label" style={{ fontSize: 13 * k }}>{COUNTRY_DEFS[c].name.toUpperCase()}</text>;
        })}
        {showRegionLabels && Object.values(REGIONS).map((r) => (
          <text key={r.id} x={r.anchor[0]} y={r.anchor[1] - 18 * k} className="label region-label" style={{ fontSize: 11 * k }}>{r.name}</text>
        ))}

        {/* Ruta de las unidades seleccionadas */}
        {selectedUnits.filter((u) => u.path.length).map((u) => {
          const pts = [unitPos(u), ...u.path.map((id) => REGIONS[id].anchor)];
          return <polyline key={`route-${u.id}`} points={pts.map((p) => p.join(',')).join(' ')} className="route" style={{ strokeWidth: 2.2 * k, strokeDasharray: `${6 * k} ${4 * k}` }} />;
        })}

        {/* Ocupación en curso */}
        {Object.values(state.regions).filter((r) => r.occupationHours > 0).map((r) => {
          const [x, y] = REGIONS[r.id].anchor;
          const need = REGIONS[r.id].capital ? 48 : 24;
          const w = 34 * k;
          return (
            <g key={`occ-${r.id}`} className="occ-progress">
              <rect x={x - w / 2} y={y + 13 * k} width={w} height={4 * k} className="occ-track" />
              <rect x={x - w / 2} y={y + 13 * k} width={w * Math.min(1, r.occupationHours / need)} height={4 * k} fill={COUNTRY_DEFS[r.occupier ?? r.controller].color} />
            </g>
          );
        })}

        {/* Batallones estacionados */}
        {stacks.groups.map((g) => {
          const [ax, ay] = REGIONS[g.regionId].anchor;
          const idx = offsets[g.regionId] ?? 0;
          offsets[g.regionId] = idx + 1;
          const x = ax + (idx === 0 ? 0 : (idx % 2 ? 1 : -1) * Math.ceil(idx / 2) * (markerW + 3 * k));
          const mine = g.owner === state.player;
          const sel = g.units.some((u) => selection.unitIds.includes(u.id));
          const training = g.units.every((u) => u.status === 'training');
          const fighting = g.units.some((u) => u.status === 'combat');
          return (
            <g key={`${g.regionId}-${g.owner}`} data-units={g.regionId} data-owner={g.owner} className={`stack${mine ? ' mine' : ''}${sel ? ' sel' : ''}${training ? ' training' : ''}${fighting ? ' fighting' : ''}`}
              transform={`translate(${x - markerW / 2} ${ay - markerH / 2})`}>
              <rect width={markerW + 12 * k} x={-6 * k} y={-6 * k} height={markerH + 12 * k} fill="transparent" />
              <rect width={markerW} height={markerH} rx={3 * k} fill={COUNTRY_DEFS[g.owner].color} className="stack-box" style={{ strokeWidth: (sel ? 2.4 : 1.1) * k }} />
              <line x1={4 * k} y1={4 * k} x2={markerW - 4 * k} y2={markerH - 4 * k} className="stack-x" style={{ strokeWidth: 1 * k }} />
              <line x1={markerW - 4 * k} y1={4 * k} x2={4 * k} y2={markerH - 4 * k} className="stack-x" style={{ strokeWidth: 1 * k }} />
              <circle cx={markerW} cy={0} r={7 * k} className="stack-badge" />
              <text x={markerW} y={0.5 * k} className="stack-count" style={{ fontSize: 9.5 * k }}>{g.units.length}</text>
            </g>
          );
        })}

        {/* Batallones en marcha */}
        {stacks.moving.map((u) => {
          const [x, y] = unitPos(u);
          const sel = selection.unitIds.includes(u.id);
          return (
            <g key={u.id} data-units={u.regionId} data-owner={u.owner} className={`stack moving${u.owner === state.player ? ' mine' : ''}${sel ? ' sel' : ''}`}
              transform={`translate(${x - markerW * 0.4} ${y - markerH * 0.4})`}>
              <rect width={markerW * 0.8} height={markerH * 0.8} rx={3 * k} fill={COUNTRY_DEFS[u.owner].color} className="stack-box" style={{ strokeWidth: (sel ? 2.4 : 1.1) * k }} />
              <path d={`M${markerW * 0.22} ${markerH * 0.2} L${markerW * 0.58} ${markerH * 0.4} L${markerW * 0.22} ${markerH * 0.6}`} className="stack-x" style={{ strokeWidth: 1.4 * k }} />
            </g>
          );
        })}

        {/* Batallas */}
        {Object.values(state.battles).map((b) => {
          const [x, y] = REGIONS[b.regionId].anchor;
          const s = 9 * k;
          return (
            <g key={`b-${b.regionId}`} className="battle" transform={`translate(${x} ${y - 24 * k})`} pointerEvents="none">
              <circle r={s * 1.25} className="battle-dot" />
              <line x1={-s * 0.6} y1={-s * 0.6} x2={s * 0.6} y2={s * 0.6} style={{ strokeWidth: 1.8 * k }} />
              <line x1={s * 0.6} y1={-s * 0.6} x2={-s * 0.6} y2={s * 0.6} style={{ strokeWidth: 1.8 * k }} />
            </g>
          );
        })}
      </svg>
      <div className="zoom-ctl">
        <button type="button" aria-label="Acercar" onClick={() => zoomButton(1 / 1.4)}>+</button>
        <button type="button" aria-label="Alejar" onClick={() => zoomButton(1.4)}>−</button>
        <button type="button" aria-label="Centrar en tu país" onClick={() => setView(initialView(state.player))}>◎</button>
      </div>
    </div>
  );
}
