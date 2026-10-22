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
import { CARTO_FONT, CitiesLayer, CrossingsLayer, cityIconBox, cityLabelCandidates, cityLabelItems, crossingIconBox, hitRadii, visibleCities, textWidth, clearTextWidths } from './GeoLayers';
import { FacilitiesLayer, HydroLayer, RoadTiersLayer, StatesLayer, facilityIconBox } from './AtlasLayers';
import mapData from '../../data/map.generated.json';
import { clampView, clampW, type View } from './bounds';
import { bandOf, DETAIL, SCALE_BANDS, nationView, viewForBand, type ScaleBand } from './scale';
import { territoryFill } from './palette';
import { FACILITIES, STATES, facilityById, stateById } from '../../atlas';
import { MilitarySymbol } from '../military/MilitarySymbol';
import { UNIT_ECHELON, affiliationOf, frameFor, strengthLabel } from '../military/symbology';
import { capitalOf } from '../../engine/world';

interface Props {
  state: GameState;
  selection: Selection;
  orderMode: boolean;
  layers: LayerVisibility;
  onToggleLayer: (id: string) => void;
  /** Toque sobre territorio: región del juego y, si se ven, el estado real bajo el dedo. */
  onTapRegion: (regionId: string, stateId?: string) => void;
  onTapUnits: (regionId: string, owner: CountryId) => void;
  onTapCity: (cityId: string) => void;
  onTapCrossing: (crossingId: string) => void;
  onTapFacility: (facilityId: string) => void;
  /** Agrupación militar de un país (escala continental). */
  onTapArmy: (country: CountryId) => void;
  onTapEmpty: () => void;
}

export type { View };

/** Desplazamiento máximo (px) para que un toque siga contando como toque y no como arrastre. */
export const TAP_SLOP = 10;
/** Un toque más largo que esto no selecciona (pulsación larga). */
const TAP_MAX_MS = 700;
/** Hueco reservado a la derecha para el tirador del panel (28 px + zona táctil ampliada). */
const HANDLE_ROOM = 46;
/** Ancho que necesita el menú de capas para leerse sin cortes. */
const LAYER_MENU_MIN = 190;
// Límites de zoom y de desplazamiento: ver ./bounds.ts

/**
 * Gesto táctil en curso.
 * - pending: un dedo apoyado, aún dentro de TAP_SLOP (puede acabar en toque).
 * - pan: arrastre con un dedo (nunca selecciona al soltar).
 * - pinch: dos dedos; el punto del mapa bajo el centro del gesto sigue al centro de los dedos.
 * `multi` marca que en algún momento hubo más de un dedo: ese gesto ya no puede ser un toque.
 */
type Gesture =
  | { mode: 'pending' | 'pan'; startX: number; startY: number; t: number; multi: boolean }
  | { mode: 'pinch'; d0: number; anchor: [number, number]; w0: number; multi: true };
// Rótulos de mares: datos del mapa generado (no forman parte del motor).
const SEA_LABELS = (mapData as unknown as { seaLabels?: { name: string; at: [number, number] }[] }).seaLabels ?? [];

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

export function MapView({ state, selection, orderMode, layers, onToggleLayer, onTapRegion, onTapUnits, onTapCity, onTapCrossing, onTapFacility, onTapArmy, onTapEmpty }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 640, h: 360 });
  const [view, setView] = useState<View>(() => nationView(state.player, 360 / 640));
  const [layerMenu, setLayerMenu] = useState(false);
  const [minimap, setMinimap] = useState(false); // oculto por defecto
  const [texture] = useState(reliefTexture);
  const fitted = useRef(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  // Copias síncronas de la vista y el tamaño para los gestores de punteros:
  // varios eventos pueden llegar antes de que React vuelva a dibujar.
  const viewRef = useRef(view);
  viewRef.current = view;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const aspect = () => sizeRef.current.h / sizeRef.current.w;
  /** Única vía para cambiar el encuadre: aplica siempre los límites. */
  const moveView = (next: View | ((v: View) => View)) =>
    setView((v) => clampView(typeof next === 'function' ? next(v) : next, aspect()));

  // Safari (iOS) lanza sus propios eventos de pellizco y puede ampliar la
  // página entera aunque el mapa gestione el gesto: se anulan sobre el mapa.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const stop = (e: Event) => e.preventDefault();
    for (const t of ['gesturestart', 'gesturechange', 'gestureend']) el.addEventListener(t, stop, { passive: false });
    return () => { for (const t of ['gesturestart', 'gesturechange', 'gestureend']) el.removeEventListener(t, stop); };
  }, []);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth || 640, h = el.clientHeight || 360;
      setSize({ w, h });
      if (!fitted.current && w > 50 && h > 50) { fitted.current = true; setView(nationView(state.player, h / w, w)); }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [state.player]);

  // Al terminar de cargar las fuentes web, volver a medir los rótulos.
  const [, setFontsReady] = useState(0);
  useEffect(() => {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!fonts) return;
    const done = () => { clearTextWidths(); setFontsReady((n) => n + 1); };
    fonts.ready.then(done);
    fonts.addEventListener?.('loadingdone', done);
    return () => fonts.removeEventListener?.('loadingdone', done);
  }, []);

  // Gancho de pruebas y capturas: fijar la vista del mapa (no toca el motor).
  useEffect(() => {
    (window as unknown as { __setView?: (v: View) => void }).__setView = (v) => moveView(v);
  }, []);

  const h = view.w * (size.h / size.w);
  const k = view.w / size.w; // unidades de mapa por píxel de pantalla

  function toMap(clientX: number, clientY: number, v: View = viewRef.current): [number, number] {
    const rect = svgRef.current!.getBoundingClientRect();
    return [v.x + ((clientX - rect.left) / rect.width) * v.w, v.y + ((clientY - rect.top) / rect.height) * v.w * (rect.height / rect.width)];
  }

  function zoomAt(factor: number, mx: number, my: number, base: View): View {
    const w = clampW(base.w * factor);
    const f = w / base.w;
    return { x: mx - (mx - base.x) * f, y: my - (my - base.y) * f, w };
  }

  /** Inicia un pellizco con los dos primeros dedos apoyados. */
  function startPinch() {
    const [p, q] = [...pointers.current.values()];
    const v = viewRef.current;
    gesture.current = { mode: 'pinch', multi: true, d0: Math.max(Math.hypot(p.x - q.x, p.y - q.y), 1), anchor: toMap((p.x + q.x) / 2, (p.y + q.y) / 2, v), w0: v.w };
  }

  function onPointerDown(e: React.PointerEvent) {
    try { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); } catch { /* puntero no capturable */ }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      gesture.current = { mode: 'pending', startX: e.clientX, startY: e.clientY, t: performance.now(), multi: false };
    } else {
      startPinch();
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    if (g.mode === 'pinch') {
      if (pointers.current.size < 2) return;
      // Zoom centrado en el gesto: el punto del mapa que estaba bajo el centro
      // de los dedos al empezar se mantiene bajo el centro actual (si los dedos
      // se desplazan juntos, el mapa se desplaza con ellos).
      const [p, q] = [...pointers.current.values()];
      const rect = svgRef.current!.getBoundingClientRect();
      const w = clampW((g.w0 * g.d0) / Math.max(Math.hypot(p.x - q.x, p.y - q.y), 1));
      const fx = ((p.x + q.x) / 2 - rect.left) / rect.width, fy = ((p.y + q.y) / 2 - rect.top) / rect.height;
      moveView({ x: g.anchor[0] - fx * w, y: g.anchor[1] - fy * w * (rect.height / rect.width), w });
      return;
    }
    if (g.mode === 'pending') {
      if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) <= TAP_SLOP) return;
      // Supera el margen del toque: pasa a arrastre y el mapa alcanza al dedo.
      g.mode = 'pan';
      const dx = e.clientX - g.startX, dy = e.clientY - g.startY;
      moveView((v) => { const kk = v.w / sizeRef.current.w; return { ...v, x: v.x - dx * kk, y: v.y - dy * kk }; });
      return;
    }
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    moveView((v) => { const kk = v.w / sizeRef.current.w; return { ...v, x: v.x - dx * kk, y: v.y - dy * kk }; });
  }

  /** Fin (o cancelación) de un puntero. Devuelve true si el gesto completo fue un toque. */
  function endPointer(e: React.PointerEvent): boolean {
    const g = gesture.current;
    const wasSingle = pointers.current.size === 1;
    pointers.current.delete(e.pointerId);
    const left = pointers.current.size;
    if (left === 0) gesture.current = null;
    else if (left === 1 && g?.mode === 'pinch') {
      // De dos dedos a uno: se sigue arrastrando con el dedo que queda, sin saltos y sin seleccionar.
      const [p] = [...pointers.current.values()];
      gesture.current = { mode: 'pan', startX: p.x, startY: p.y, t: 0, multi: true };
    } else if (left >= 2) startPinch();
    return !!g && wasSingle && g.mode === 'pending' && !g.multi && performance.now() - g.t <= TAP_MAX_MS;
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!endPointer(e)) return;
    setLayerMenu(false);
    const target = document.elementFromPoint(e.clientX, e.clientY) as Element | null;
    const unitEl = target?.closest('[data-units]');
    const armyEl = target?.closest('[data-army]');
    const cityEl = target?.closest('[data-city]');
    const crossingEl = target?.closest('[data-crossing]');
    const facilityEl = target?.closest('[data-facility]');
    // Región bajo el dedo aunque haya un icono encima (ciudades, pasos).
    const regionEl = target?.closest('[data-region]')
      ?? document.elementsFromPoint(e.clientX, e.clientY).find((el) => el.hasAttribute('data-region'));
    // Prioridad: agrupaciones/batallones > ciudad / instalación / paso > región (y estado).
    // Al dar una orden de marcha solo cuentan las regiones (los iconos no son destinos).
    if (armyEl && !orderMode) onTapArmy(armyEl.getAttribute('data-army') as CountryId);
    else if (unitEl && !orderMode) onTapUnits(unitEl.getAttribute('data-units')!, unitEl.getAttribute('data-owner') as CountryId);
    else if (cityEl && !orderMode) onTapCity(cityEl.getAttribute('data-city')!);
    else if (crossingEl && !orderMode) onTapCrossing(crossingEl.getAttribute('data-crossing')!);
    else if (facilityEl && !orderMode) onTapFacility(facilityEl.getAttribute('data-facility')!);
    else if (regionEl) onTapRegion(regionEl.getAttribute('data-region')!, orderMode ? undefined : stateAt(e.clientX, e.clientY));
    else if (unitEl) onTapRegion(unitEl.getAttribute('data-units')!);
    else onTapEmpty();
  }

  /** Estado real bajo un punto de pantalla (solo si la capa de estados está visible a esta escala). */
  function stateAt(clientX: number, clientY: number): string | undefined {
    if (!detail.states || !show('provinces')) return undefined;
    const [mx, my] = toMap(clientX, clientY);
    const pt = new DOMPoint(mx, my);
    for (const el of svgRef.current!.querySelectorAll<SVGGeometryElement>('[data-state]')) {
      if (el.isPointInFill(pt)) return el.getAttribute('data-state')!;
    }
    return undefined;
  }

  function onWheel(e: React.WheelEvent) {
    const [mx, my] = toMap(e.clientX, e.clientY);
    moveView((v) => zoomAt(e.deltaY > 0 ? 1.15 : 1 / 1.15, mx, my, v));
  }

  function zoomButton(f: number) {
    moveView((v) => zoomAt(f, v.x + v.w / 2, v.y + (v.w * aspect()) / 2, v));
  }

  // Menú de capas: si no cabe junto al minimapa (pantallas estrechas con el
  // panel abierto), el minimapa se oculta mientras el menú está abierto.
  const MINIMAP_ROOM = 110; // minimapa (≤104 px) + separación
  const menuRoom = size.w - 8 - HANDLE_ROOM - 46 /* controles + separación */;
  const showMinimap = minimap && !(layerMenu && menuRoom - MINIMAP_ROOM < LAYER_MENU_MIN);

  // ----- escala y nivel de detalle (Atlas) -----
  const band: ScaleBand = bandOf(view.w, size.w);
  /** Mapa estrecho (iPhone SE con panel): selector de escala compacto. */
  const narrow = size.w < 420;
  const detail = DETAIL[band];

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
  const show = (id: string) => layers[id] !== false;
  const regionScale = band === 'region';
  /** Separación entre marcadores de una misma región (px). */
  const STEP = 34;
  const offsets: Record<string, number> = {};

  /** Huecos que ocupa un marcador centrado en (x, y): marco + escalón + efectivos, e insignia si es una pila. */
  const unitBoxes = (x: number, y: number, badge: boolean): Box[] => [
    { x0: x - 13.5 * k, y0: y - 18 * k, x1: x + 13.5 * k, y1: y + 22.5 * k },
    ...(badge ? [{ x0: x + 7 * k, y0: y - 14.5 * k, x1: x + 20 * k, y1: y - 1.5 * k }] : []),
  ];

  // Posiciones de los marcadores (las mismas que se dibujan). Centro del símbolo en (x, y).
  const stackItems = detail.units === 'region' ? [...groups.values()].map((g) => {
    const [ax, ay] = REGIONS[g.regionId].anchor;
    const idx = offsets[g.regionId] ?? 0;
    offsets[g.regionId] = idx + 1;
    const x = ax + (idx === 0 ? 0 : (idx % 2 ? 1 : -1) * Math.ceil(idx / 2) * STEP * k);
    const y = ay + 6 * k;
    return { g, x, y, boxes: unitBoxes(x, y, g.units.length > 1) };
  }) : [];
  // Escala continental: agrupaciones estratégicas, una por país, en su región capital.
  const armies = detail.units === 'country' ? COUNTRY_IDS.map((c) => {
    const us = Object.values(state.units).filter((u) => u.owner === c);
    if (!us.length) return null;
    const [x, y] = REGIONS[capitalOf(c)].anchor;
    return { c, units: us, men: us.reduce((s2, u) => s2 + u.men, 0), x, y: y + 6 * k, boxes: [] as Box[] };
  }).filter(Boolean) as { c: CountryId; units: Unit[]; men: number; x: number; y: number; boxes: Box[] }[] : [];
  // Agrupaciones de capitales cercanas (Bogotá–Quito en pantallas pequeñas): se separan
  // lo justo para que no se tapen ni compartan zona táctil. Solo cambia el dibujo.
  for (let it = 0; it < 6; it++) {
    for (let i = 0; i < armies.length; i++) for (let j = i + 1; j < armies.length; j++) {
      const a = armies[i], b = armies[j];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, min = 44 * k;
      if (d >= min) continue;
      const push = (min - d) / 2, ux = dx / d, uy = dy / d;
      a.x -= ux * push; a.y -= uy * push; b.x += ux * push; b.y += uy * push;
    }
  }
  for (const a of armies) a.boxes = unitBoxes(a.x, a.y, a.units.length > 1);

  // Ciudades, pasos e instalaciones visibles: sus iconos también son obstáculos.
  const cities = show('cities') ? visibleCities(k) : [];
  // Solo las que caen en pantalla (con margen): menos nodos que dibujar al mover el mapa.
  const inView = (x: number, y: number, m: number) => x > view.x - m && x < view.x + view.w + m && y > view.y - m && y < view.y + h + m;
  const facilities = FACILITIES.filter((f) => detail.facilities(f) && show(f.kind === 'airport' ? 'airports' : 'ports') && inView(f.xy[0], f.xy[1], 20 * k));
  const obstacles = [
    ...(show('units') ? [...stackItems.flatMap((t) => t.boxes), ...armies.flatMap((a) => a.boxes)] : []),
    ...cities.map((c) => cityIconBox(c, k)),
    ...(show('crossings') ? CROSSINGS.map((x) => crossingIconBox(x, k)) : []),
  ];
  // Zonas de la interfaz sobre el mapa (columna de controles, selector de escala,
  // tirador del panel): ningún rótulo debajo. En píxeles → unidades de mapa.
  const px = (x0: number, y0: number, x1: number, y1: number): Box => ({ x0: view.x + x0 * k, y0: view.y + y0 * k, x1: view.x + x1 * k, y1: view.y + y1 * k });
  const uiZones: Box[] = [
    px(0, size.h - 8 - 5 * 42 - 10, 58, size.h),
    px(size.w - HANDLE_ROOM - (narrow ? 135 : 270), size.h - 50, size.w - HANDLE_ROOM + 4, size.h),
    px(size.w - 44, size.h / 2 - 44, size.w, size.h / 2 + 44),
  ];
  obstacles.push(...uiZones);
  const placedLabels: Box[] = [];
  const hits = hitRadii(cities, show('crossings') ? CROSSINGS : [], k);

  const countryLabels = show('labels') && band !== 'region' ? placeLabels(COUNTRY_IDS.map((c) => {
    const [x, y] = COUNTRY_LABELS[c];
    const name = COUNTRY_DEFS[c].name.toUpperCase();
    const w = Math.max(22, textWidth(name, 12, 600, true, 0.18, CARTO_FONT) + 6) * k;
    return { c, x, y, name, box: { x0: x - w / 2, y0: y - 23 * k, x1: x + w / 2, y1: y + 10 * k } as Box };
  }), obstacles, k, placedLabels, undefined, true).filter((l) => !l.crowded) : []; // Atlas: sin hueco, no se dibuja

  // Nombres de ciudades: junto a su icono; si no caben, no se dibujan.
  const cityLabels = show('labels') ? placeLabels(cityLabelItems(cities, k), obstacles, k, placedLabels, (it) => cityLabelCandidates(it, k), true)
    .filter((l) => !l.crowded) : [];

  // Instalaciones (como los puntos de interés de Apple Maps): ceden su sitio a ciudades,
  // nombres de ciudad, pasos fronterizos y unidades; entre ellas, gana la de menor rango.
  const facilityBoxes: Box[] = [];
  const blocking = [...obstacles, ...placedLabels];
  const shownFacilities = [...facilities].sort((a, b) => a.rank - b.rank).filter((f) => {
    const b = facilityIconBox(f, k);
    if (blocking.some((o) => overlap(b, o) > 0) || facilityBoxes.some((o) => overlap(b, o) > 0)) return false;
    facilityBoxes.push(b);
    return true;
  });
  obstacles.push(...facilityBoxes);

  // Mares y océanos: rótulos de baja prioridad; si no caben, no se dibujan.
  const seaLabels = band !== 'region' ? placeLabels(SEA_LABELS.map((sl) => {
    const w = (textWidth(sl.name, 12, 500, false, 0.3, CARTO_FONT) + 6) * k;
    const [x, y] = sl.at;
    return { sl, x, y, box: { x0: x - w / 2, y0: y - 9 * k, x1: x + w / 2, y1: y + 9 * k } as Box };
  }), obstacles, k, placedLabels, () => [[0, 0], [0, -24], [0, 24]], true).filter((l) => !l.crowded) : [];

  // Nombres de instalaciones (escala regional): código IATA o nombre del puerto.
  const facilityLabels = show('labels') && detail.facilityLabels ? placeLabels(shownFacilities.filter((f) => f.iata).map((f) => {
    const text = f.iata!;
    const w = (textWidth(text, 9, 600, false) + 4) * k;
    const x = f.xy[0] + (9 + 2) * k + w / 2, y = f.xy[1];
    return { f, x, y, w, box: { x0: x - w / 2, y0: y - 6 * k, x1: x + w / 2, y1: y + 6 * k } as Box };
  }), obstacles, k, placedLabels, (it) => [[0, 0], [-(it.w / k) - 22, 0]], true).filter((l) => !l.crowded)
    .map((l) => ({ ...l, x: l.x - l.w / 2, anchor: 'start' as const })) : [];

  // Estados (Nación y Región): rótulo centrado; si no cabe, se omite.
  const stateLabels = show('labels') && show('provinces') && detail.stateLabels ? placeLabels(STATES.filter((st) => {
    const [x, y] = st.label;
    return x > view.x && x < view.x + view.w && y > view.y && y < view.y + h && st.area / (k * k) > (regionScale ? 900 : 1300);
  }).sort((a, b) => b.area - a.area).map((st) => {
    const name = st.name.toUpperCase();
    const fs = regionScale ? 9.5 : 8;
    const w = (textWidth(name, fs, 600, false, 0.1) + 10) * k; // incluye el halo del texto
    const [x, y] = st.label;
    return { st, x, y, fs, box: { x0: x - w / 2, y0: y - (fs * 0.7) * k, x1: x + w / 2, y1: y + (fs * 0.7) * k } as Box };
  }), obstacles, k, placedLabels, () => [[0, 0], [0, -11], [0, 11], [0, -20], [0, 20]], true).filter((l) => !l.crowded) : [];

  const regionLabels = show('labels') && detail.regionLabels && !show('provinces') ? placeLabels(Object.values(REGIONS).map((r) => {
    const w = Math.max(30, textWidth(r.name, 10.5, 600, true, 0.02) + 6) * k;
    const x = r.anchor[0], y = r.anchor[1] + 28 * k;
    return { r, x, y, box: { x0: x - w / 2, y0: y - 7 * k, x1: x + w / 2, y1: y + 7 * k } as Box };
  }), obstacles, k, placedLabels, undefined, true) : [];

  /** Marcador militar: símbolo APP-6 simplificado + nº de batallones + efectivos reales. */
  function tile(key: string, x: number, y: number, owner: CountryId, units: Unit[], extra: string, attrs: Record<string, string>, sel: boolean, mode: 'stack' | 'moving' | 'army') {
    const rel = relationClass(state, owner);
    const aff = affiliationOf(rel);
    const category = mode === 'army' ? 'formation' : 'infantry';
    const frame = frameFor(aff, 'land');
    const men = units.reduce((s2, u) => s2 + u.men, 0);
    const label = strengthLabel(men);
    const pillW = Math.max(20, label.length * 5.6 + 9);
    const s = mode === 'moving' ? 0.8 : 1;
    return (
      <g key={key} {...attrs} data-owner={owner} className={`stack ${rel}${sel ? ' sel' : ''}${mode === 'army' ? ' formation' : ''}${extra}`} transform={`translate(${x} ${y})`}>
        {/* Zona táctil: al menos 44 × 44 px de pantalla, centrada en el símbolo. */}
        <rect className="stack-hit" x={-22 * k} y={-22 * k} width={44 * k} height={44 * k} fill="transparent" />
        <g transform={`scale(${k * s})`}>
          {sel && <path d={frame.d} className="stack-halo" transform="scale(1.3)" />}
          <MilitarySymbol category={category} affiliation={aff} echelon={mode === 'army' ? null : UNIT_ECHELON} frameClass="stack-box" />
          {units.length > 1 && (
            <g className="stack-count-badge" transform={`translate(${frame.halfW + 1} ${frame.top + 1})`}>
              <circle r="6.2" />
              <text className="stack-count" y="0.4">{units.length}</text>
            </g>
          )}
          {mode !== 'moving' && (
            <g className="stack-strength" transform={`translate(0 ${frame.bottom + 8})`}>
              <rect x={-pillW / 2} y="-5.8" width={pillW} height="11.6" rx="5.8" />
              <text y="0.3">{label}</text>
            </g>
          )}
        </g>
      </g>
    );
  }

  /** Cambiar de escala con el selector: encuadre centrado en el país del jugador. */
  function goToBand(b: ScaleBand) {
    moveView(viewForBand(b, state.player, size.h / size.w, size.w));
  }

  // Selector de escala: oculto mientras el menú de capas está abierto.
  const showScale = !layerMenu;

  return (
    <div className="map-wrap">
      <svg
        ref={svgRef}
        className={`map${orderMode ? ' order-mode' : ''}`}
        viewBox={`${view.x} ${view.y} ${view.w} ${h}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={(e) => { endPointer(e); /* el sistema canceló el gesto: nunca selecciona */ }}
        onWheel={onWheel}
        role="application"
        aria-label="Mapa estratégico de Sudamérica"
        data-view-w={Math.round(view.w)}
        data-scale={band}
      >
        <defs>
          <radialGradient id="sea-grad" cx="0.55" cy="0.42" r="0.75">
            <stop offset="0" stopColor="#14303f" />
            <stop offset="0.55" stopColor="#0e2230" />
            <stop offset="1" stopColor="#0a1620" />
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
          {/* Mucho más grande que el encuadre máximo: su borde nunca se ve. */}
          <rect x={-1800} y={-1800} width={MAP.width + 3600} height={MAP.height + 3600} fill="url(#sea-grad)" />
          <g className="graticule">
            {Array.from({ length: 14 }, (_, i) => <line key={`v${i}`} x1={i * 100 - 150} y1={-300} x2={i * 100 - 150} y2={MAP.height + 200} />)}
            {Array.from({ length: 22 }, (_, i) => <line key={`h${i}`} x1={-200} y1={i * 100 - 250} x2={MAP.width + 200} y2={i * 100 - 250} />)}
          </g>
          {MAP.neutral.map((n) => <path key={n.name} d={n.path} className="neutral" />)}
          {COUNTRY_IDS.map((c) => <path key={c} d={MAP.countries[c]} className="land" />)}
        </g>

        <g data-layer="territory">
          {Object.values(state.regions).map((r) => (
            <path key={r.id} d={REGIONS[r.id].path} data-region={r.id} fill={territoryFill(r.controller, state.player)}
              className={`region${r.controller === state.player ? ' own' : ''}`} style={{ strokeWidth: 0.8 * k }} />
          ))}
          {texture && COUNTRY_IDS.map((c) => <path key={`tx-${c}`} d={MAP.countries[c]} fill="url(#relief)" className="relief" />)}
        </g>

        <g data-layer="hydro" pointerEvents="none">{show('hydro') && <HydroLayer maxRank={detail.riverRank} />}</g>

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
        {MAP_LAYERS.filter((l) => l.status === 'planned' || ['provinces', 'roads', 'crossings', 'ports', 'airports', 'cities'].includes(l.id)).map((l) => {
          if (l.status === 'planned') return <g key={l.id} data-layer={l.id} data-status="planned" />;
          if (l.id === 'provinces') return <g key={l.id} data-layer="provinces" pointerEvents="none">{show('provinces') && detail.states && <StatesLayer />}</g>;
          if (l.id === 'roads') return <g key={l.id} data-layer="roads" pointerEvents="none">{show('roads') && detail.roads.length > 0 && <RoadTiersLayer tiers={detail.roads} />}</g>;
          if (l.id === 'crossings') return <g key={l.id} data-layer="crossings">{show('crossings') && <CrossingsLayer k={k} selectedId={selection.kind === 'crossing' ? selection.crossingId : null} hits={hits} />}</g>;
          if (l.id === 'ports' || l.id === 'airports') {
            const kind = l.id === 'ports' ? 'port' : 'airport';
            return (
              <g key={l.id} data-layer={l.id} data-status={l.status}>
                <FacilitiesLayer items={shownFacilities.filter((f) => f.kind === kind)} k={k} labels={facilityLabels.filter((x) => x.f.kind === kind)}
                  selectedId={selection.kind === 'facility' ? selection.facilityId : null} />
              </g>
            );
          }
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

        <g data-layer="labels-seas" pointerEvents="none">
          {seaLabels.map(({ sl, x, y, dx, dy }) => (
            <text key={sl.name} x={x + dx} y={y + dy} className="sea-label" style={{ fontSize: 12 * k, letterSpacing: `${0.3 * 12 * k}px` }}>{sl.name}</text>
          ))}
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
            const fighting = g.units.some((u) => u.status === 'combat');
            return tile(`${g.regionId}-${g.owner}`, x, y, g.owner, g.units, fighting ? ' fighting' : '', { 'data-units': g.regionId }, sel, 'stack');
          })}
          {show('units') && detail.units === 'region' && moving.map((u) => {
            const [x, y] = unitPos(u);
            return tile(u.id, x, y, u.owner, [u], ' moving', { 'data-units': u.regionId }, selIds.includes(u.id), 'moving');
          })}
          {show('units') && armies.map((a) => tile(`army-${a.c}`, a.x, a.y, a.c, a.units, '', { 'data-army': a.c }, selection.kind === 'country' && selection.country === a.c, 'army'))}
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
          {stateLabels.map(({ st, x, y, dx, dy, fs }) => (
            <text key={st.id} x={x + dx} y={y + dy} className={`label state-label${selection.kind === 'state' && selection.stateId === st.id ? ' sel' : ''}`} data-state-label={st.id}
              style={{ fontSize: fs * k }}>{st.name.toUpperCase()}</text>
          ))}
        </g>

        <g data-layer="selection" pointerEvents="none">
          {selection.kind === 'region' && <path d={REGIONS[selection.regionId].path} className="sel-outline" style={{ strokeWidth: 2.4 * k }} />}
          {selection.kind === 'units' && <path d={REGIONS[selection.regionId].path} className="sel-outline soft" style={{ strokeWidth: 1.6 * k }} />}
          {selection.kind === 'country' && <path d={MAP.countries[selection.country]} className="sel-outline" style={{ strokeWidth: 2.4 * k }} />}
          {selection.kind === 'city' && cityById(selection.cityId) && (
            <circle cx={cityById(selection.cityId)!.xy[0]} cy={cityById(selection.cityId)!.xy[1]} r={11 * k} className="sel-ring" style={{ strokeWidth: 2 * k }} />
          )}
          {selection.kind === 'state' && stateById(selection.stateId) && (
            <>
              <path d={stateById(selection.stateId)!.path} className="sel-state-fill" />
              <path d={stateById(selection.stateId)!.path} className="sel-outline" style={{ strokeWidth: 2.2 * k }} />
            </>
          )}
          {selection.kind === 'facility' && facilityById(selection.facilityId) && (
            <circle cx={facilityById(selection.facilityId)!.xy[0]} cy={facilityById(selection.facilityId)!.xy[1]} r={12 * k} className="sel-ring" style={{ strokeWidth: 2 * k }} />
          )}
          {selection.kind === 'crossing' && crossingById(selection.crossingId) && (
            <circle cx={crossingById(selection.crossingId)!.xy[0]} cy={crossingById(selection.crossingId)!.xy[1]} r={11 * k} className="sel-ring" style={{ strokeWidth: 2 * k }} />
          )}
        </g>
      </svg>

      {showScale && (
        <div className={`scale-switch${narrow ? ' narrow' : ''}`} role="radiogroup" aria-label="Escala del mapa" style={{ right: HANDLE_ROOM }}>
          {SCALE_BANDS.map((sb) => (
            <button key={sb.id} type="button" role="radio" aria-checked={band === sb.id} className={band === sb.id ? 'on' : ''} data-scale-btn={sb.id}
              aria-label={`Escala: ${sb.label}`} onClick={() => goToBand(sb.id)}>
              <span className="scale-dot" aria-hidden="true" />{narrow ? sb.short : sb.label}
            </button>
          ))}
        </div>
      )}

      <div className="map-corner" style={{ right: HANDLE_ROOM }}>
        {showMinimap && (
          <Minimap state={state} view={{ ...view }} viewH={h} onCenter={(cx, cy) => moveView((v) => ({ ...v, x: cx - v.w / 2, y: cy - (v.w * aspect()) / 2 }))} />
        )}
        <div className="map-ctl" role="toolbar" aria-label="Controles del mapa">
          <button type="button" className={`icon-btn${minimap ? ' on' : ''}`} data-action="minimap" aria-pressed={minimap}
            aria-label={minimap ? 'Ocultar minimapa' : 'Mostrar minimapa'} title={minimap ? 'Ocultar minimapa' : 'Mostrar minimapa'} onClick={() => setMinimap((v) => !v)}>
            <Icon name="map" />
          </button>
          <button type="button" className={`icon-btn${layerMenu ? ' on' : ''}`} aria-label="Capas del mapa" aria-expanded={layerMenu} onClick={() => setLayerMenu((v) => !v)}><Icon name="layers" /></button>
          <button type="button" className="icon-btn" aria-label="Acercar" onClick={() => zoomButton(1 / 1.4)}><Icon name="plus" /></button>
          <button type="button" className="icon-btn" aria-label="Alejar" onClick={() => zoomButton(1.4)}><Icon name="minus" /></button>
          <button type="button" className="icon-btn" aria-label="Centrar en tu país" onClick={() => moveView(nationView(state.player, size.h / size.w, size.w))}><Icon name="target" /></button>
        </div>
        {layerMenu && (
          <div className="layer-menu" role="dialog" aria-label="Capas del mapa">
            <div className="layer-title">Capas del mapa</div>
            {MAP_LAYERS.filter((l) => l.toggleable).map((l) => (
              <label key={l.id} className={`layer-row${l.status === 'planned' ? ' planned' : ''}${l.status === 'partial' ? ' partial' : ''}`} htmlFor={`layer-${l.id}`}>
                <input id={`layer-${l.id}`} type="checkbox" disabled={l.status === 'planned'} checked={l.status !== 'planned' && layers[l.id] !== false}
                  onChange={() => onToggleLayer(l.id)} />
                <span className="layer-text"><span>{l.label}</span>{l.note && l.status !== 'planned' && <small>{l.note}</small>}</span>
                {l.status === 'partial' && <span className="layer-badge" title="Datos reales pero incompletos">Parcial</span>}
                {l.status === 'planned' && <Icon name="lock" size={13} className="soon" />}
              </label>
            ))}
            <p className="layer-note">«Parcial»: datos reales de Natural Earth, solo los principales. Con candado: capas previstas, aún sin datos. Más detalle al acercar.</p>
          </div>
        )}
      </div>
    </div>
  );
}
