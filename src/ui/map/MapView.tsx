import { useEffect, useRef, useState } from 'react';
import type { CountryId, GameState, Unit } from '../../engine/types';
import { MAP, REGIONS, COUNTRY_IDS } from '../../engine/world';
import { atWar, sameSide } from '../../engine/war';
import { COUNTRY_DEFS } from '../../data/countries';
import type { Selection } from '../selection';
import { selectedUnitIds } from '../selection';
import { MAP_LAYERS, type LayerVisibility } from './layers';
import { Icon } from '../icons';
import { FlagSvg } from '../flags';
import { Minimap } from './Minimap';
import { reliefTexture } from './texture';
import { CROSSINGS, cityById, crossingById } from '../../geo';
import { CitiesLayer, CrossingsLayer, RoadsLayer, cityIconBox, cityLabelCandidates, cityLabelItems, crossingIconBox, hitRadii, visibleCities } from './GeoLayers';
import mapData from '../../data/map.generated.json';

interface Props {
  state: GameState;
  selection: Selection;
  orderMode: boolean;
  layers: LayerVisibility;
  onToggleLayer: (id: string) => void;
  onTapRegion: (regionId: string) => void;
  onTapUnits: (regionId: string, owner: CountryId) => void;
  onTapCity: (cityId: string) => void;
  onTapCrossing: (crossingId: string) => void;
  onTapEmpty: () => void;
}

export interface View { x: number; y: number; w: number }

const MIN_W = 120;
const MAX_W = MAP.width * 1.45;
// Rótulos de mares: datos del mapa generado (no forman parte del motor).
const SEA_LABELS = (mapData as unknown as { seaLabels?: { name: string; at: [number, number] }[] }).seaLabels ?? [];

function initialView(player: CountryId, aspect: number, screenW = 900): View {
  const pts = Object.values(REGIONS).filter((r) => r.country === player).map((r) => r.anchor);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const spanX = Math.max(...xs) - Math.min(...xs), spanY = Math.max(...ys) - Math.min(...ys);
  // Escala mínima de ~1,15 unidades de mapa por píxel: en pantallas pequeñas
  // se abre más cerca para que nombres y batallones no se amontonen.
  const w = Math.min(Math.max(820, spanX * 2.6, (spanY * 2.2) / aspect), Math.max(screenW * 1.15, spanX * 1.6, (spanY * 1.3) / aspect));
  return { x: cx - w / 2, y: cy - (w * aspect) / 2, w };
}

/** Anillos de un trazado "Mx,yLx,y…Z". */
function rings(d: string): [number, number][][] {
  return d.split('M').filter(Boolean).map((part) => part.replace(/Z/g, '').split('L').map((p) => p.split(',').map(Number) as [number, number]));
}

function inside(p: [number, number], ring: [number, number][]): boolean {
  let ins = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}

/**
 * Posición del rótulo de cada país: un punto interior, cercano al centro y lo
 * más alejado posible de los puntos donde se dibujan los batallones.
 */
function labelPoint(c: CountryId): [number, number] {
  const rs = rings(MAP.countries[c]);
  const anchors = Object.values(REGIONS).map((r) => r.anchor);
  const own = Object.values(REGIONS).filter((r) => r.country === c).map((r) => r.anchor);
  const cx = own.reduce((s, p) => s + p[0], 0) / own.length, cy = own.reduce((s, p) => s + p[1], 0) / own.length;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rs) for (const [x, y] of r) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  const span = Math.max(maxX - minX, maxY - minY);
  let best: [number, number] = [cx, cy], bestScore = -Infinity;
  for (let i = 1; i < 24; i++) {
    for (let j = 1; j < 24; j++) {
      const p: [number, number] = [minX + ((maxX - minX) * i) / 24, minY + ((maxY - minY) * j) / 24];
      if (!rs.some((r) => inside(p, r))) continue;
      const clear = Math.min(...anchors.map((a) => Math.hypot(a[0] - p[0], (a[1] - p[1]) * 1.6)));
      const score = Math.min(clear, span * 0.18) - 0.35 * Math.hypot(p[0] - cx, p[1] - cy);
      if (score > bestScore) { bestScore = score; best = p; }
    }
  }
  return best;
}
const COUNTRY_LABELS = Object.fromEntries(COUNTRY_IDS.map((c) => [c, labelPoint(c)])) as Record<CountryId, [number, number]>;

function unitPos(u: Unit): [number, number] {
  const a = REGIONS[u.regionId].anchor;
  if (!u.path.length || u.progress <= 0) return a;
  const b = REGIONS[u.path[0]].anchor;
  return [a[0] + (b[0] - a[0]) * u.progress, a[1] + (b[1] - a[1]) * u.progress];
}

/** Relación del dueño de una unidad con el jugador → color del marcador. */
function relationClass(state: GameState, owner: CountryId): 'mine' | 'enemy' | 'ally' | 'other' {
  if (owner === state.player) return 'mine';
  if (atWar(state, owner, state.player)) return 'enemy';
  if (sameSide(state, owner, state.player)) return 'ally';
  return 'other';
}

type Box = import('./GeoLayers').Box;
const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
const shift = (b: Box, dx: number, dy: number): Box => ({ x0: b.x0 + dx, y0: b.y0 + dy, x1: b.x1 + dx, y1: b.y1 + dy });

/** Desplazamientos de prueba (en píxeles de pantalla) para colocar rótulos sin solapes. */
const LABEL_CANDIDATES: [number, number][] = [[0, 0], [0, -30], [0, 30], [-48, 0], [48, 0], [0, -54], [0, 54], [-48, -30], [48, -30], [-48, 30], [48, 30], [-80, 0], [80, 0]];

/**
 * Coloca cada rótulo en el primer hueco libre (sin tocar batallones ni otros
 * rótulos). Solo cambia dónde se dibuja el texto, nunca las unidades.
 */
function placeLabels<T extends { box: Box }>(items: T[], obstacles: Box[], k: number, placed: Box[] = [],
  candidates: (it: T) => [number, number][] = () => LABEL_CANDIDATES, dropCrowded = false): (T & { dx: number; dy: number; crowded: boolean })[] {
  return items.map((it) => {
    let best = { dx: 0, dy: 0, score: Infinity };
    for (const [px, py] of candidates(it)) {
      const b = shift(it.box, px * k, py * k);
      const score = [...obstacles, ...placed].reduce((sum, o) => sum + overlap(b, o), 0);
      if (score < best.score) best = { dx: px * k, dy: py * k, score };
      if (score === 0) break;
    }
    // Con dropCrowded, un rótulo sin hueco no se dibuja y no ocupa sitio.
    if (!dropCrowded || best.score === 0) placed.push(shift(it.box, best.dx, best.dy));
    return { ...it, dx: best.dx, dy: best.dy, crowded: best.score > 0 };
  });
}

export function MapView({ state, selection, orderMode, layers, onToggleLayer, onTapRegion, onTapUnits, onTapCity, onTapCrossing, onTapEmpty }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 640, h: 360 });
  const [view, setView] = useState<View>(() => initialView(state.player, 360 / 640));
  const [layerMenu, setLayerMenu] = useState(false);
  const [minimap, setMinimap] = useState(false); // oculto por defecto
  const [texture] = useState(reliefTexture);
  const fitted = useRef(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ startX: number; startY: number; moved: boolean; t: number; pinchDist?: number; pinchView?: View; pinchCenter?: [number, number] } | null>(null);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth || 640, h = el.clientHeight || 360;
      setSize({ w, h });
      if (!fitted.current && w > 50 && h > 50) { fitted.current = true; setView(initialView(state.player, h / w, w)); }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [state.player]);

  // Gancho de pruebas y capturas: fijar la vista del mapa (no toca el motor).
  useEffect(() => {
    (window as unknown as { __setView?: (v: View) => void }).__setView = (v) => setView({ ...v, w: Math.min(MAX_W, Math.max(MIN_W, v.w)) });
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
    const cityEl = target?.closest('[data-city]');
    const crossingEl = target?.closest('[data-crossing]');
    // Región bajo el dedo aunque haya un icono encima (ciudades, pasos).
    const regionEl = target?.closest('[data-region]')
      ?? document.elementsFromPoint(e.clientX, e.clientY).find((el) => el.hasAttribute('data-region'));
    // Prioridad: batallones > ciudad / paso > región. Al dar una orden de
    // marcha solo cuentan las regiones (los iconos no son destinos).
    if (unitEl && !orderMode) onTapUnits(unitEl.getAttribute('data-units')!, unitEl.getAttribute('data-owner') as CountryId);
    else if (cityEl && !orderMode) onTapCity(cityEl.getAttribute('data-city')!);
    else if (crossingEl && !orderMode) onTapCrossing(crossingEl.getAttribute('data-crossing')!);
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
  const zoomedIn = k < 0.62;
  const tW = 30 * k, tH = 20 * k; // marcador: 30×20 px en pantalla
  const offsets: Record<string, number> = {};
  const show = (id: string) => layers[id] !== false;

  // Posiciones de los marcadores estacionados (las mismas que se dibujan).
  const stackItems = [...groups.values()].map((g) => {
    const [ax, ay] = REGIONS[g.regionId].anchor;
    const idx = offsets[g.regionId] ?? 0;
    offsets[g.regionId] = idx + 1;
    const x = ax + (idx === 0 ? 0 : (idx % 2 ? 1 : -1) * Math.ceil(idx / 2) * (tW + 4 * k));
    const y = ay - 2 * k;
    return { g, x, y, box: { x0: x - tW / 2 - 3 * k, y0: y - 3 * k, x1: x + tW / 2 + 3 * k, y1: y + tH + 3 * k } as Box };
  });
  // Ciudades y pasos visibles a este zoom: sus iconos también son obstáculos.
  const cities = show('cities') ? visibleCities(k) : [];
  const obstacles = [
    ...(show('units') ? stackItems.map((t) => t.box) : []),
    ...cities.map((c) => cityIconBox(c, k)),
    ...(show('crossings') ? CROSSINGS.map((x) => crossingIconBox(x, k)) : []),
  ];
  const placedLabels: Box[] = [];
  const hits = hitRadii(cities, show('crossings') ? CROSSINGS : [], k);

  const countryLabels = show('labels') && !zoomedIn ? placeLabels(COUNTRY_IDS.map((c) => {
    const [x, y] = COUNTRY_LABELS[c];
    const name = COUNTRY_DEFS[c].name.toUpperCase();
    const w = Math.max(22, name.length * 9.6 + 4) * k;
    return { c, x, y, name, box: { x0: x - w / 2, y0: y - 23 * k, x1: x + w / 2, y1: y + 10 * k } as Box };
  }), obstacles, k, placedLabels) : [];

  // Nombres de ciudades: junto a su icono; si no caben, no se dibujan.
  const cityLabels = show('labels') ? placeLabels(cityLabelItems(cities, k), obstacles, k, placedLabels, (it) => cityLabelCandidates(it, k), true)
    .filter((l) => !l.crowded) : [];

  const regionLabels = show('labels') && zoomedIn ? placeLabels(Object.values(REGIONS).map((r) => {
    const w = Math.max(30, r.name.length * 6) * k;
    const x = r.anchor[0], y = r.anchor[1] + 28 * k;
    return { r, x, y, box: { x0: x - w / 2, y0: y - 7 * k, x1: x + w / 2, y1: y + 7 * k } as Box };
  }), obstacles, k, placedLabels, undefined, true) : [];

  function tile(key: string, x: number, y: number, owner: CountryId, count: number | null, extra: string, regionId: string, sel: boolean) {
    const rel = relationClass(state, owner);
    const w = count === null ? tH : tW;
    return (
      <g key={key} data-units={regionId} data-owner={owner} className={`stack ${rel}${sel ? ' sel' : ''}${extra}`} transform={`translate(${x - w / 2} ${y})`}>
        <rect x={-6 * k} y={-6 * k} width={w + 12 * k} height={tH + 12 * k} fill="transparent" />
        <rect width={w} height={tH} rx={4 * k} className="stack-box" style={{ strokeWidth: (sel ? 2 : 1) * k }} />
        <g transform={`translate(${2 * k} ${2 * k}) scale(${(16 * k) / 24})`} className="stack-icon">
          <circle cx="12" cy="5.5" r="2.6" />
          <path d="M8 10.5h8l-1.2 5.2h-1.7l-.6 6H11.5l-.6-6H9.2z" />
        </g>
        {count !== null && <text x={w - 7 * k} y={tH / 2 + 0.5 * k} className="stack-count" style={{ fontSize: 11 * k }}>{count}</text>}
      </g>
    );
  }

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
          <radialGradient id="sea-grad" cx="0.55" cy="0.42" r="0.75">
            <stop offset="0" stopColor="#123552" />
            <stop offset="0.55" stopColor="#0b2236" />
            <stop offset="1" stopColor="#06121e" />
          </radialGradient>
          {texture && (
            <pattern id="relief" patternUnits="userSpaceOnUse" width="160" height="160">
              <image href={texture} width="160" height="160" />
            </pattern>
          )}
          {COUNTRY_IDS.map((c) => (
            <pattern key={c} id={`occ-${c}`} patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
              <rect width="3" height="7" fill={COUNTRY_DEFS[c].color} />
            </pattern>
          ))}
        </defs>

        <g data-layer="base">
          <rect x={-4000} y={-4000} width={9000} height={9000} className="sea-far" />
          <rect x={-200} y={-300} width={MAP.width + 400} height={MAP.height + 500} fill="url(#sea-grad)" />
          <g className="graticule">
            {Array.from({ length: 14 }, (_, i) => <line key={`v${i}`} x1={i * 100 - 150} y1={-300} x2={i * 100 - 150} y2={MAP.height + 200} />)}
            {Array.from({ length: 22 }, (_, i) => <line key={`h${i}`} x1={-200} y1={i * 100 - 250} x2={MAP.width + 200} y2={i * 100 - 250} />)}
          </g>
          {SEA_LABELS.map((s) => (
            <text key={s.name} x={s.at[0]} y={s.at[1]} className="sea-label" style={{ fontSize: 12 * k, letterSpacing: `${4 * k}px` }}>{s.name}</text>
          ))}
          {MAP.neutral.map((n) => <path key={n.name} d={n.path} className="neutral" />)}
          {COUNTRY_IDS.map((c) => <path key={c} d={MAP.countries[c]} className="land" />)}
        </g>

        <g data-layer="territory">
          {Object.values(state.regions).map((r) => (
            <path key={r.id} d={REGIONS[r.id].path} data-region={r.id} fill={COUNTRY_DEFS[r.controller].color}
              className="region" style={{ strokeWidth: 0.7 * k, strokeDasharray: `${3 * k} ${2.5 * k}` }} />
          ))}
          {texture && COUNTRY_IDS.map((c) => <path key={`tx-${c}`} d={MAP.countries[c]} fill="url(#relief)" className="relief" />)}
        </g>

        <g data-layer="occupation">
          {show('occupation') && Object.values(state.regions).filter((r) => r.controller !== r.owner).map((r) => (
            <path key={r.id} d={REGIONS[r.id].path} fill={`url(#occ-${r.owner})`} className="region-occ" />
          ))}
        </g>

        <g data-layer="borders">
          {/* Fronteras internacionales: línea clara sobre un borde oscuro, distinta
              de las divisiones regionales (finas y discontinuas). */}
          {COUNTRY_IDS.map((c) => <path key={`cs-${c}`} d={MAP.countries[c]} className="country-casing" style={{ strokeWidth: 3.4 * k }} />)}
          <path d={MAP.countries[state.player]} className="player-glow" style={{ strokeWidth: 7 * k }} />
          {COUNTRY_IDS.map((c) => (
            <path key={c} d={MAP.countries[c]} className={`country-edge${c === state.player ? ' player' : ''}`}
              style={{ strokeWidth: (c === state.player ? 2 : 1.2) * k }} />
          ))}
        </g>

        {/* Capas cartográficas en el orden del registro. Las previstas quedan
            vacías hasta disponer de datos verificados. */}
        {MAP_LAYERS.filter((l) => l.status === 'planned' || ['roads', 'crossings', 'cities'].includes(l.id)).map((l) => {
          if (l.status === 'planned') return <g key={l.id} data-layer={l.id} data-status="planned" />;
          if (l.id === 'roads') return <g key={l.id} data-layer="roads" pointerEvents="none">{show('roads') && <RoadsLayer />}</g>;
          if (l.id === 'crossings') return <g key={l.id} data-layer="crossings">{show('crossings') && <CrossingsLayer k={k} selectedId={selection.kind === 'crossing' ? selection.crossingId : null} hits={hits} />}</g>;
          return <g key={l.id} data-layer="cities">{show('cities') && <CitiesLayer cities={cities} labels={cityLabels} k={k} selectedId={selection.kind === 'city' ? selection.cityId : null} hits={hits} />}</g>;
        })}

        <g data-layer="routes">
          {show('routes') && Object.values(state.units).filter((u) => u.owner === state.player && u.path.length).map((u) => {
            const pts = [unitPos(u), ...u.path.map((id) => REGIONS[id].anchor)];
            const sel = selIds.includes(u.id);
            return <polyline key={`route-${u.id}`} points={pts.map((p) => p.join(',')).join(' ')} className={`route${sel ? ' sel' : ''}`}
              style={{ strokeWidth: (sel ? 2.2 : 1.4) * k, strokeDasharray: `${6 * k} ${4 * k}` }} />;
          })}
        </g>

        <g data-layer="labels-countries" pointerEvents="none">
          {countryLabels.map(({ c, x, y, name, dx, dy, crowded }) => {
            const fw = 22 * k;
            return (
              <g key={c} className={`country-tag${crowded ? ' crowded' : ''}`} data-country-label={c} transform={`translate(${dx} ${dy})`}>
                {!crowded && <FlagSvg c={c} x={x - fw / 2} y={y - 22 * k} w={fw} />}
                <text x={x} y={y + 2 * k} className="label country-label" style={{ fontSize: 12 * k }}>{name}</text>
              </g>
            );
          })}
        </g>

        <g data-layer="units">
          {show('units') && stackItems.map(({ g, x, y }) => {
            const sel = g.units.some((u) => selIds.includes(u.id));
            const training = g.units.every((u) => u.status === 'training');
            const fighting = g.units.some((u) => u.status === 'combat');
            return tile(`${g.regionId}-${g.owner}`, x, y, g.owner, g.units.length, `${training ? ' training' : ''}${fighting ? ' fighting' : ''}`, g.regionId, sel);
          })}
          {show('units') && moving.map((u) => {
            const [x, y] = unitPos(u);
            return tile(u.id, x, y - tH / 2, u.owner, null, ' moving', u.regionId, selIds.includes(u.id));
          })}
        </g>

        <g data-layer="battles" pointerEvents="none">
          {show('battles') && Object.values(state.regions).filter((r) => r.occupationHours > 0).map((r) => {
            const [x, y] = REGIONS[r.id].anchor;
            const need = REGIONS[r.id].capital ? 48 : 24;
            const w = 30 * k;
            return (
              <g key={`occ-${r.id}`}>
                <rect x={x - w / 2} y={y + 22 * k} width={w} height={3.5 * k} rx={1.5 * k} className="occ-track" />
                <rect x={x - w / 2} y={y + 22 * k} width={w * Math.min(1, r.occupationHours / need)} height={3.5 * k} rx={1.5 * k} fill={COUNTRY_DEFS[r.occupier ?? r.controller].color} />
              </g>
            );
          })}
          {show('battles') && Object.values(state.battles).map((b) => {
            const [x, y] = REGIONS[b.regionId].anchor;
            const s = 7 * k;
            return (
              <g key={`b-${b.regionId}`} className="battle" transform={`translate(${x + 24 * k} ${y - 4 * k})`}>
                <circle r={s * 1.35} className="battle-dot" style={{ strokeWidth: 1 * k }} />
                <path d={`M${-s * 0.6} ${-s * 0.6}L${s * 0.6} ${s * 0.6}M${s * 0.6} ${-s * 0.6}L${-s * 0.6} ${s * 0.6}`} style={{ strokeWidth: 1.6 * k }} />
              </g>
            );
          })}
        </g>

        <g data-layer="labels" pointerEvents="none">
          {regionLabels.filter((l) => !l.crowded).map(({ r, x, y, dx, dy }) => (
            <text key={r.id} x={x + dx} y={y + dy} className="label region-label" data-region-label={r.id} style={{ fontSize: 10.5 * k }}>{r.name}</text>
          ))}
        </g>

        <g data-layer="selection" pointerEvents="none">
          {selection.kind === 'region' && <path d={REGIONS[selection.regionId].path} className="sel-outline" style={{ strokeWidth: 2.4 * k }} />}
          {selection.kind === 'units' && <path d={REGIONS[selection.regionId].path} className="sel-outline soft" style={{ strokeWidth: 1.6 * k }} />}
          {selection.kind === 'country' && <path d={MAP.countries[selection.country]} className="sel-outline" style={{ strokeWidth: 2.4 * k }} />}
          {selection.kind === 'city' && cityById(selection.cityId) && (
            <circle cx={cityById(selection.cityId)!.xy[0]} cy={cityById(selection.cityId)!.xy[1]} r={11 * k} className="sel-ring" style={{ strokeWidth: 2 * k }} />
          )}
          {selection.kind === 'crossing' && crossingById(selection.crossingId) && (
            <circle cx={crossingById(selection.crossingId)!.xy[0]} cy={crossingById(selection.crossingId)!.xy[1]} r={11 * k} className="sel-ring" style={{ strokeWidth: 2 * k }} />
          )}
        </g>
      </svg>

      <div className="map-corner">
        {minimap && (
          <Minimap state={state} view={{ ...view }} viewH={h} onCenter={(cx, cy) => setView((v) => ({ ...v, x: cx - v.w / 2, y: cy - (v.w * size.h / size.w) / 2 }))} />
        )}
        <div className="map-ctl" role="toolbar" aria-label="Controles del mapa">
          <button type="button" className={`icon-btn${minimap ? ' on' : ''}`} data-action="minimap" aria-pressed={minimap}
            aria-label={minimap ? 'Ocultar minimapa' : 'Mostrar minimapa'} title={minimap ? 'Ocultar minimapa' : 'Mostrar minimapa'} onClick={() => setMinimap((v) => !v)}>
            <Icon name="map" />
          </button>
          <button type="button" className={`icon-btn${layerMenu ? ' on' : ''}`} aria-label="Capas del mapa" aria-expanded={layerMenu} onClick={() => setLayerMenu((v) => !v)}><Icon name="layers" /></button>
          <button type="button" className="icon-btn" aria-label="Acercar" onClick={() => zoomButton(1 / 1.4)}><Icon name="plus" /></button>
          <button type="button" className="icon-btn" aria-label="Alejar" onClick={() => zoomButton(1.4)}><Icon name="minus" /></button>
          <button type="button" className="icon-btn" aria-label="Centrar en tu país" onClick={() => setView(initialView(state.player, size.h / size.w, size.w))}><Icon name="target" /></button>
        </div>
        {layerMenu && (
          <div className="layer-menu" role="dialog" aria-label="Capas del mapa">
            <div className="layer-title">Capas del mapa</div>
            {MAP_LAYERS.filter((l) => l.toggleable).map((l) => (
              <label key={l.id} className={`layer-row${l.status === 'planned' ? ' planned' : ''}`} htmlFor={`layer-${l.id}`}>
                <input id={`layer-${l.id}`} type="checkbox" disabled={l.status === 'planned'} checked={l.status === 'active' && layers[l.id] !== false}
                  onChange={() => onToggleLayer(l.id)} />
                <span>{l.label}</span>
                {l.status === 'planned' && <Icon name="lock" size={13} className="soon" />}
              </label>
            ))}
            <p className="layer-note">Con candado: capas previstas, aún sin datos. Las ciudades secundarias y sus nombres aparecen al acercar.</p>
          </div>
        )}
      </div>
    </div>
  );
}
