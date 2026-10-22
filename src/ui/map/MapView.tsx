import { useEffect, useRef, useState } from 'react';
import type { CountryId, GameState, Unit } from '../../engine/types';
import { MAP, REGIONS, COUNTRY_IDS } from '../../engine/world';
import { COUNTRY_DEFS } from '../../data/countries';
import type { Selection } from '../selection';
import { selectedUnitIds } from '../selection';
import { MAP_LAYERS, type LayerVisibility } from './layers';
import { Icon } from '../icons';

interface Props {
  state: GameState;
  selection: Selection;
  orderMode: boolean;
  layers: LayerVisibility;
  onToggleLayer: (id: string) => void;
  onTapRegion: (regionId: string) => void;
  onTapUnits: (regionId: string, owner: CountryId) => void;
  onTapEmpty: () => void;
}

interface View { x: number; y: number; w: number }

const MIN_W = 120;
const MAX_W = MAP.width * 1.35;

function initialView(player: CountryId, aspect: number): View {
  const pts = Object.values(REGIONS).filter((r) => r.country === player).map((r) => r.anchor);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const spanX = Math.max(...xs) - Math.min(...xs), spanY = Math.max(...ys) - Math.min(...ys);
  // Encajar el país (con margen) en una vista apaisada.
  const w = Math.max(560, spanX * 2.2, (spanY * 1.9) / aspect);
  return { x: cx - w / 2, y: cy - (w * aspect) / 2, w };
}

function centroid(c: CountryId): [number, number] {
  const pts = Object.values(REGIONS).filter((r) => r.country === c).map((r) => r.anchor);
  return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
}
const COUNTRY_LABELS = Object.fromEntries(COUNTRY_IDS.map((c) => [c, centroid(c)])) as Record<CountryId, [number, number]>;

function unitPos(u: Unit): [number, number] {
  const a = REGIONS[u.regionId].anchor;
  if (!u.path.length || u.progress <= 0) return a;
  const b = REGIONS[u.path[0]].anchor;
  return [a[0] + (b[0] - a[0]) * u.progress, a[1] + (b[1] - a[1]) * u.progress];
}

export function MapView({ state, selection, orderMode, layers, onToggleLayer, onTapRegion, onTapUnits, onTapEmpty }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 640, h: 360 });
  const [view, setView] = useState<View>(() => initialView(state.player, 360 / 640));
  const [layerMenu, setLayerMenu] = useState(false);
  const fitted = useRef(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ startX: number; startY: number; moved: boolean; t: number; pinchDist?: number; pinchView?: View; pinchCenter?: [number, number] } | null>(null);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth || 640, h = el.clientHeight || 360;
      setSize({ w, h });
      if (!fitted.current && w > 50 && h > 50) { fitted.current = true; setView(initialView(state.player, h / w)); }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [state.player]);

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
    try { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); } catch { /* puntero no capturable */ }
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
    setLayerMenu(false);
    const target = document.elementFromPoint(e.clientX, e.clientY) as Element | null;
    const unitEl = target?.closest('[data-units]');
    const regionEl = target?.closest('[data-region]');
    if (unitEl && !orderMode) onTapUnits(unitEl.getAttribute('data-units')!, unitEl.getAttribute('data-owner') as CountryId);
    else if (regionEl) onTapRegion(regionEl.getAttribute('data-region')!);
    else if (unitEl) onTapRegion(unitEl.getAttribute('data-units')!);
    else onTapEmpty();
  }

  function onWheel(e: React.WheelEvent) {
    const [mx, my] = toMap(e.clientX, e.clientY);
    setView(zoomAt(e.deltaY > 0 ? 1.15 : 1 / 1.15, mx, my));
  }

  function zoomButton(f: number) {
    setView((v) => zoomAt(f, v.x + v.w / 2, v.y + (v.w * size.h / size.w) / 2, v));
  }

  // ----- batallones agrupados por región y país -----
  const groups = new Map<string, { regionId: string; owner: CountryId; units: Unit[] }>();
  const moving: Unit[] = [];
  for (const u of Object.values(state.units)) {
    if (u.path.length && u.progress > 0) { moving.push(u); continue; }
    const key = `${u.regionId}|${u.owner}`;
    if (!groups.has(key)) groups.set(key, { regionId: u.regionId, owner: u.owner, units: [] });
    groups.get(key)!.units.push(u);
  }
  const selIds = selectedUnitIds(selection);
  const selUnits = selIds.map((id) => state.units[id]).filter(Boolean);
  const zoomedIn = view.w < 560;
  const mW = 22 * k, mH = 15 * k;
  const offsets: Record<string, number> = {};
  const show = (id: string) => layers[id] !== false;

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
        aria-label="Mapa estratégico de Sudamérica"
        data-view-w={Math.round(view.w)}
      >
        <defs>
          {COUNTRY_IDS.map((c) => (
            <pattern key={c} id={`occ-${c}`} patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
              <rect width="3" height="7" fill={COUNTRY_DEFS[c].color} />
            </pattern>
          ))}
        </defs>

        <g data-layer="base">
          <rect x={-3000} y={-3000} width={7000} height={7000} className="sea" />
          <g className="graticule">
            {Array.from({ length: 14 }, (_, i) => <line key={`v${i}`} x1={i * 100 - 100} y1={-400} x2={i * 100 - 100} y2={MAP.height + 400} />)}
            {Array.from({ length: 22 }, (_, i) => <line key={`h${i}`} x1={-400} y1={i * 100 - 100} x2={MAP.width + 400} y2={i * 100 - 100} />)}
          </g>
          {MAP.neutral.map((n) => <path key={n.name} d={n.path} className="neutral" />)}
        </g>

        <g data-layer="territory">
          {Object.values(state.regions).map((r) => (
            <path key={r.id} d={REGIONS[r.id].path} data-region={r.id} fill={COUNTRY_DEFS[r.controller].color}
              className="region" style={{ strokeWidth: 0.5 * k }} />
          ))}
        </g>

        <g data-layer="occupation">
          {show('occupation') && Object.values(state.regions).filter((r) => r.controller !== r.owner).map((r) => (
            <path key={r.id} d={REGIONS[r.id].path} fill={`url(#occ-${r.owner})`} className="region-occ" />
          ))}
        </g>

        <g data-layer="borders">
          {COUNTRY_IDS.map((c) => (
            <path key={c} d={MAP.countries[c]} className={`country-edge${c === state.player ? ' player' : ''}`}
              style={{ strokeWidth: (c === state.player ? 1.8 : 1.1) * k }} />
          ))}
        </g>

        {/* Capas reservadas: vacías hasta disponer de datos verificados. */}
        {MAP_LAYERS.filter((l) => l.status === 'planned').map((l) => <g key={l.id} data-layer={l.id} data-status="planned" />)}

        <g data-layer="routes">
          {show('routes') && Object.values(state.units).filter((u) => u.owner === state.player && u.path.length).map((u) => {
            const pts = [unitPos(u), ...u.path.map((id) => REGIONS[id].anchor)];
            const sel = selIds.includes(u.id);
            return <polyline key={`route-${u.id}`} points={pts.map((p) => p.join(',')).join(' ')} className={`route${sel ? ' sel' : ''}`}
              style={{ strokeWidth: (sel ? 2 : 1.2) * k, strokeDasharray: `${5 * k} ${4 * k}` }} />;
          })}
        </g>

        <g data-layer="units">
          {show('units') && [...groups.values()].map((g) => {
            const [ax, ay] = REGIONS[g.regionId].anchor;
            const idx = offsets[g.regionId] ?? 0;
            offsets[g.regionId] = idx + 1;
            // Marcadores bajo el punto de la región: los nombres van encima y no se tapan.
            const x = ax + (idx === 0 ? 0 : (idx % 2 ? 1 : -1) * Math.ceil(idx / 2) * (mW + 4 * k));
            const y = ay + 5 * k;
            const mine = g.owner === state.player;
            const sel = g.units.some((u) => selIds.includes(u.id));
            const training = g.units.every((u) => u.status === 'training');
            const fighting = g.units.some((u) => u.status === 'combat');
            return (
              <g key={`${g.regionId}-${g.owner}`} data-units={g.regionId} data-owner={g.owner}
                className={`stack${mine ? ' mine' : ''}${sel ? ' sel' : ''}${training ? ' training' : ''}${fighting ? ' fighting' : ''}`}
                transform={`translate(${x - mW / 2} ${y})`}>
                <rect x={-8 * k} y={-8 * k} width={mW + 16 * k} height={mH + 16 * k} fill="transparent" />
                <rect width={mW} height={mH} rx={2 * k} fill={COUNTRY_DEFS[g.owner].color} className="stack-box" style={{ strokeWidth: (sel ? 2 : 0.9) * k }} />
                <path d={`M${3 * k} ${3 * k}L${mW - 3 * k} ${mH - 3 * k}M${mW - 3 * k} ${3 * k}L${3 * k} ${mH - 3 * k}`} className="stack-x" style={{ strokeWidth: 0.9 * k }} />
                <circle cx={mW} cy={0} r={6 * k} className="stack-badge" style={{ strokeWidth: 0.6 * k }} />
                <text x={mW} y={0.4 * k} className="stack-count" style={{ fontSize: 8.5 * k }}>{g.units.length}</text>
              </g>
            );
          })}
          {show('units') && moving.map((u) => {
            const [x, y] = unitPos(u);
            const sel = selIds.includes(u.id);
            return (
              <g key={u.id} data-units={u.regionId} data-owner={u.owner} className={`stack moving${u.owner === state.player ? ' mine' : ''}${sel ? ' sel' : ''}`}
                transform={`translate(${x - mW * 0.4} ${y - mH * 0.4})`}>
                <rect x={-6 * k} y={-6 * k} width={mW * 0.8 + 12 * k} height={mH * 0.8 + 12 * k} fill="transparent" />
                <rect width={mW * 0.8} height={mH * 0.8} rx={2 * k} fill={COUNTRY_DEFS[u.owner].color} className="stack-box" style={{ strokeWidth: (sel ? 2 : 0.9) * k }} />
                <path d={`M${mW * 0.25} ${mH * 0.18}L${mW * 0.55} ${mH * 0.4}L${mW * 0.25} ${mH * 0.62}`} className="stack-x" style={{ strokeWidth: 1.2 * k }} />
              </g>
            );
          })}
        </g>

        <g data-layer="battles" pointerEvents="none">
          {show('battles') && Object.values(state.regions).filter((r) => r.occupationHours > 0).map((r) => {
            const [x, y] = REGIONS[r.id].anchor;
            const need = REGIONS[r.id].capital ? 48 : 24;
            const w = 30 * k;
            return (
              <g key={`occ-${r.id}`}>
                <rect x={x - w / 2} y={y + 24 * k} width={w} height={3.5 * k} className="occ-track" />
                <rect x={x - w / 2} y={y + 24 * k} width={w * Math.min(1, r.occupationHours / need)} height={3.5 * k} fill={COUNTRY_DEFS[r.occupier ?? r.controller].color} />
              </g>
            );
          })}
          {show('battles') && Object.values(state.battles).map((b) => {
            const [x, y] = REGIONS[b.regionId].anchor;
            const s = 7 * k;
            return (
              <g key={`b-${b.regionId}`} className="battle" transform={`translate(${x + 20 * k} ${y - 2 * k})`}>
                <circle r={s * 1.3} className="battle-dot" style={{ strokeWidth: 0.8 * k }} />
                <path d={`M${-s * 0.6} ${-s * 0.6}L${s * 0.6} ${s * 0.6}M${s * 0.6} ${-s * 0.6}L${-s * 0.6} ${s * 0.6}`} style={{ strokeWidth: 1.6 * k }} />
              </g>
            );
          })}
        </g>

        <g data-layer="labels" pointerEvents="none">
          {show('labels') && !zoomedIn && COUNTRY_IDS.map((c) => {
            const [x, y] = COUNTRY_LABELS[c];
            return <text key={c} x={x} y={y - 18 * k} className="label country-label" style={{ fontSize: 11 * k }}>{COUNTRY_DEFS[c].name.toUpperCase()}</text>;
          })}
          {show('labels') && zoomedIn && Object.values(REGIONS).map((r) => (
            <text key={r.id} x={r.anchor[0]} y={r.anchor[1] - 6 * k} className="label region-label" style={{ fontSize: 10 * k }}>{r.name}</text>
          ))}
        </g>

        <g data-layer="selection" pointerEvents="none">
          {selection.kind === 'region' && <path d={REGIONS[selection.regionId].path} className="sel-outline" style={{ strokeWidth: 2.4 * k }} />}
          {selection.kind === 'units' && <path d={REGIONS[selection.regionId].path} className="sel-outline soft" style={{ strokeWidth: 1.6 * k }} />}
          {selection.kind === 'country' && <path d={MAP.countries[selection.country]} className="sel-outline" style={{ strokeWidth: 2.4 * k }} />}
          {selUnits.length > 0 && selection.kind === 'units' && (() => {
            const [x, y] = REGIONS[selection.regionId].anchor;
            return <circle cx={x} cy={y} r={2.5 * k} className="sel-dot" />;
          })()}
        </g>
      </svg>

      <div className="map-ctl" role="toolbar" aria-label="Controles del mapa">
        <button type="button" className="icon-btn" aria-label="Acercar" onClick={() => zoomButton(1 / 1.4)}><Icon name="plus" /></button>
        <button type="button" className="icon-btn" aria-label="Alejar" onClick={() => zoomButton(1.4)}><Icon name="minus" /></button>
        <button type="button" className="icon-btn" aria-label="Centrar en tu país" onClick={() => setView(initialView(state.player, size.h / size.w))}><Icon name="target" /></button>
        <button type="button" className={`icon-btn${layerMenu ? ' on' : ''}`} aria-label="Capas del mapa" aria-expanded={layerMenu} onClick={() => setLayerMenu((v) => !v)}><Icon name="layers" /></button>
      </div>
      {layerMenu && (
        <div className="layer-menu" role="dialog" aria-label="Capas del mapa">
          <div className="layer-title">Capas</div>
          {MAP_LAYERS.filter((l) => l.toggleable).map((l) => (
            <label key={l.id} className={`layer-row${l.status === 'planned' ? ' planned' : ''}`} htmlFor={`layer-${l.id}`}>
              <input id={`layer-${l.id}`} type="checkbox" disabled={l.status === 'planned'} checked={l.status === 'active' && layers[l.id] !== false}
                onChange={() => onToggleLayer(l.id)} />
              <span>{l.label}</span>
              {l.status === 'planned' && <span className="soon">Próximamente</span>}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
