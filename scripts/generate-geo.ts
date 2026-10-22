/**
 * Genera src/data/geo/geo.generated.json (ciudades, pasos fronterizos y
 * carreteras) a partir de:
 *  - las definiciones curadas de src/data/geo/sources/*.def.ts
 *  - Natural Earth 1:10m (dominio público) en data-src/natural-earth/
 *  - la proyección del mapa (src/data/projection.json)
 *
 * Valida los datos y FALLA si algo no cuadra (ciudad inexistente, paso
 * fronterizo lejos de la frontera, corredor sin trazado continuo…).
 *
 * Ejecutar: npx tsx scripts/generate-geo.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { geoMercator } from 'd3-geo';
import { CITY_DEFS } from '../src/data/geo/sources/cities.def';
import { CROSSING_DEFS } from '../src/data/geo/sources/crossings.def';
import { ROAD_DEFS } from '../src/data/geo/sources/roads.def';
import { COUNTRY_IDS } from '../src/data/regionDefs';

type LonLat = [number, number];
type Pt = [number, number];

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const proj = read('../src/data/projection.json');
const projection = geoMercator().scale(proj.scale).translate(proj.translate);
const P = (ll: LonLat): Pt => { const r = projection(ll)!; return [Math.round(r[0] * 100) / 100, Math.round(r[1] * 100) / 100]; };

const map = read('../src/data/map.generated.json');
const countriesGeo = read('../data-src/south-america-ne50.geojson');
const places = read('../data-src/natural-earth/populated-places-sa.geojson');
const admin1 = read('../data-src/natural-earth/admin1-sa.geojson');
const roads = read('../data-src/natural-earth/roads-sa.geojson');

const errors: string[] = [];
const warnings: string[] = [];

// ---------------- geometría ----------------
function inRing(p: Pt | LonLat, ring: number[][]): boolean {
  let ins = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}
function polysOf(g: { type: string; coordinates: number[][][] | number[][][][] }): number[][][][] {
  return g.type === 'Polygon' ? [g.coordinates as number[][][]] : (g.coordinates as number[][][][]);
}
function inGeom(p: LonLat, g: { type: string; coordinates: number[][][] | number[][][][] }): boolean {
  return polysOf(g).some((poly) => inRing(p, poly[0]) && !poly.slice(1).some((h) => inRing(p, h)));
}
/** Distancia aproximada en km entre dos puntos lon/lat. */
function km(a: LonLat, b: LonLat): number {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad, dLon = (b[0] - a[0]) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
/** Distancia (km) de un punto al borde de una geometría (aprox. equirectangular). */
function distToBoundary(p: LonLat, g: { type: string; coordinates: number[][][] | number[][][][] }): number {
  const kx = 111.32 * Math.cos((p[1] * Math.PI) / 180), ky = 110.57;
  let best = Infinity;
  for (const poly of polysOf(g)) for (const ring of poly) {
    for (let i = 0; i < ring.length - 1; i++) {
      const ax = (ring[i][0] - p[0]) * kx, ay = (ring[i][1] - p[1]) * ky;
      const bx = (ring[i + 1][0] - p[0]) * kx, by = (ring[i + 1][1] - p[1]) * ky;
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
      best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
    }
  }
  return best;
}
function simplify(points: Pt[], tol: number): Pt[] {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length); keep[0] = keep[points.length - 1] = 1;
  const st: [number, number][] = [[0, points.length - 1]];
  while (st.length) {
    const [s, e] = st.pop()!; let m = 0, ix = -1;
    for (let i = s + 1; i < e; i++) {
      const [ax, ay] = points[s], [bx, by] = points[e], [px, py] = points[i];
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
      const d = Math.hypot(px - ax - t * dx, py - ay - t * dy);
      if (d > m) { m = d; ix = i; }
    }
    if (m > tol && ix > 0) { keep[ix] = 1; st.push([s, ix], [ix, e]); }
  }
  return points.filter((_, i) => keep[i]);
}

const countryGeom = (c: string) => countriesGeo.features.find((f: { properties: { iso: string } }) => f.properties.iso === c)?.geometry;

// Regiones del juego (anillos proyectados) para saber en qué región cae cada punto.
const regionRings: { id: string; country: string; rings: Pt[][] }[] = map.regions.map((r: { id: string; country: string; path: string }) => ({
  id: r.id, country: r.country,
  rings: r.path.split('M').filter(Boolean).map((s: string) => s.replace(/Z/g, '').split('L').map((q: string) => q.split(',').map(Number) as Pt)),
}));
function gameRegion(xy: Pt, country?: string): string | null {
  const hit = regionRings.find((r) => (!country || r.country === country) && r.rings.some((ring) => inRing(xy, ring)));
  if (hit) return hit.id;
  // Puntos costeros fuera del polígono simplificado: región más cercana del país.
  let best: string | null = null, bd = Infinity;
  for (const r of regionRings) {
    if (country && r.country !== country) continue;
    for (const ring of r.rings) for (const q of ring) { const d = Math.hypot(q[0] - xy[0], q[1] - xy[1]); if (d < bd) { bd = d; best = r.id; } }
  }
  return bd < 25 ? best : null;
}

// ---------------- ciudades ----------------
const placeByName = (name: string, country: string) => places.features
  .filter((f: { properties: { name: string; adm0_a3: string } }) => f.properties.name === name && f.properties.adm0_a3 === country)
  .sort((a: { properties: { scalerank: number } }, b: { properties: { scalerank: number } }) => a.properties.scalerank - b.properties.scalerank)[0];

function province(ll: LonLat, country: string) {
  const f = admin1.features.find((a: { properties: { adm0_a3: string }; geometry: never }) => a.properties.adm0_a3 === country && inGeom(ll, a.geometry));
  if (f) return { name: f.properties.name as string, type: (f.properties.type as string) ?? null };
  // Ciudades costeras justo fuera del contorno simplificado: provincia más cercana.
  let best = null as null | { name: string; type: string | null }, bd = Infinity;
  for (const a of admin1.features) {
    if (a.properties.adm0_a3 !== country) continue;
    const d = distToBoundary(ll, a.geometry);
    if (d < bd) { bd = d; best = { name: a.properties.name, type: a.properties.type ?? null }; }
  }
  return bd < 15 ? best : null;
}

const cities: Record<string, unknown[]> = {};
for (const c of COUNTRY_IDS) {
  cities[c] = [];
  const defs = CITY_DEFS[c];
  if (!defs.some((d) => d.kind === 'capital')) errors.push(`${c}: falta la capital`);
  for (const d of defs) {
    const f = placeByName(d.ne, c);
    if (!f) { errors.push(`Ciudad no encontrada en Natural Earth: ${d.ne} (${c})`); continue; }
    const ll: LonLat = [f.properties.longitude, f.properties.latitude];
    if (!inGeom(ll, countryGeom(c)) && distToBoundary(ll, countryGeom(c)) > 10) errors.push(`${d.ne} queda fuera de ${c}`);
    const xy = P(ll);
    const prov = province(ll, c);
    if (!prov) warnings.push(`${d.ne}: provincia no determinada`);
    cities[c].push({
      id: d.id, name: d.name ?? d.ne, country: c, kind: d.kind, note: d.note ?? null,
      lonlat: [Math.round(ll[0] * 1e4) / 1e4, Math.round(ll[1] * 1e4) / 1e4], xy,
      province: prov?.name ?? null, provinceType: prov?.type ?? null,
      region: gameRegion(xy, c),
      rank: f.properties.scalerank,
      source: 'Natural Earth 1:10m Populated Places (dominio público)',
    });
  }
}

// ---------------- pasos fronterizos ----------------
const crossings: Record<string, unknown[]> = {};
const MAX_BORDER_KM = 15;
for (const [c, list] of Object.entries(CROSSING_DEFS)) {
  crossings[c] = [];
  for (const d of list ?? []) {
    const [a, b] = d.countries;
    if (!d.source.length) errors.push(`${d.id}: sin fuente`);
    if (d.type === 'terrestre') {
      if (!d.coord) { errors.push(`${d.id}: sin coordenadas`); continue; }
      const da = distToBoundary(d.coord, countryGeom(a)), db = distToBoundary(d.coord, countryGeom(b));
      if (da > MAX_BORDER_KM || db > MAX_BORDER_KM) {
        errors.push(`${d.id}: a ${da.toFixed(1)} km de ${a} y ${db.toFixed(1)} km de ${b} (máx. ${MAX_BORDER_KM})`);
        continue;
      }
      const xy = P(d.coord);
      crossings[c].push({
        id: d.id, name: d.name, type: d.type, countries: d.countries, places: d.places, precision: d.precision,
        detail: d.detail ?? null, source: d.source, lonlat: d.coord, xy,
        regions: [gameRegion(xy, a), gameRegion(xy, b)],
        check: { kmToBorderA: Math.round(da * 10) / 10, kmToBorderB: Math.round(db * 10) / 10 },
      });
    } else {
      if (!d.terminals) { errors.push(`${d.id}: sin terminales`); continue; }
      const ok = d.terminals.every((t, i) => {
        const g = countryGeom(d.countries[i]);
        return inGeom(t, g) || distToBoundary(t, g) <= 5;
      });
      if (!ok) { errors.push(`${d.id}: algún terminal no está en su país`); continue; }
      const [t0, t1] = d.terminals.map(P);
      const mid: LonLat = [(d.terminals[0][0] + d.terminals[1][0]) / 2, (d.terminals[0][1] + d.terminals[1][1]) / 2];
      crossings[c].push({
        id: d.id, name: d.name, type: d.type, countries: d.countries, places: d.places, precision: d.precision,
        detail: d.detail ?? null, source: d.source,
        terminals: d.terminals, terminalsXY: [t0, t1], lonlat: [Math.round(mid[0] * 1e4) / 1e4, Math.round(mid[1] * 1e4) / 1e4], xy: P(mid),
        regions: [gameRegion(t0, a), gameRegion(t1, b)],
        lengthKm: Math.round(km(d.terminals[0], d.terminals[1])),
      });
    }
  }
}

// ---------------- carreteras ----------------
type Node = string;
const key = (p: number[]) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`;
const adj = new Map<Node, { to: Node; w: number; coords: LonLat[] }[]>();
const nodePos = new Map<Node, LonLat>();
function addEdge(coords: LonLat[]) {
  const a = key(coords[0]), b = key(coords[coords.length - 1]);
  if (a === b) return;
  let len = 0;
  for (let i = 1; i < coords.length; i++) len += km(coords[i - 1], coords[i]);
  for (const [n, p] of [[a, coords[0]], [b, coords[coords.length - 1]]] as [Node, LonLat][]) {
    if (!adj.has(n)) adj.set(n, []);
    nodePos.set(n, p);
  }
  adj.get(a)!.push({ to: b, w: len, coords });
  adj.get(b)!.push({ to: a, w: len, coords: [...coords].reverse() });
}
for (const f of roads.features) for (const line of f.geometry.coordinates as LonLat[][]) if (line.length >= 2) addEdge(line);

// Unir extremos casi coincidentes (huecos < 1 km en los datos) con tramos mínimos.
const nodes = [...nodePos.entries()];
const grid = new Map<string, Node[]>();
for (const [n, p] of nodes) { const g = `${Math.floor(p[0] * 50)},${Math.floor(p[1] * 50)}`; if (!grid.has(g)) grid.set(g, []); grid.get(g)!.push(n); }
let joins = 0;
for (const [n, p] of nodes) {
  const gx = Math.floor(p[0] * 50), gy = Math.floor(p[1] * 50);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    for (const m of grid.get(`${gx + dx},${gy + dy}`) ?? []) {
      if (m <= n) continue;
      const q = nodePos.get(m)!;
      const d = km(p, q);
      if (d > 0 && d < 1) { adj.get(n)!.push({ to: m, w: d, coords: [p, q] }); adj.get(m)!.push({ to: n, w: d, coords: [q, p] }); joins++; }
    }
  }
}

function nearestNode(ll: LonLat): { n: Node; d: number } {
  let best = '', bd = Infinity;
  for (const [n, p] of nodePos) { const d = km(ll, p); if (d < bd) { bd = d; best = n; } }
  return { n: best, d: bd };
}

function shortestPath(a: Node, b: Node): LonLat[] | null {
  const dist = new Map<Node, number>([[a, 0]]);
  const prev = new Map<Node, { from: Node; coords: LonLat[] }>();
  const done = new Set<Node>();
  // Cola de prioridad simple (montículo binario)
  const heap: [number, Node][] = [[0, a]];
  const push = (x: [number, Node]) => { heap.push(x); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0]; const last = heap.pop()!; if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  while (heap.length) {
    const [d, u] = pop();
    if (done.has(u)) continue;
    done.add(u);
    if (u === b) break;
    for (const e of adj.get(u) ?? []) {
      const nd = d + e.w;
      if (nd < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, nd); prev.set(e.to, { from: u, coords: e.coords }); push([nd, e.to]); }
    }
  }
  if (!prev.has(b) && a !== b) return null;
  const parts: LonLat[][] = [];
  for (let at = b; at !== a; at = prev.get(at)!.from) parts.unshift(prev.get(at)!.coords);
  const out: LonLat[] = [];
  for (const p of parts) out.push(...(out.length ? p.slice(1) : p));
  return out;
}

const roadsOut: Record<string, unknown[]> = {};
const roadReport: string[] = [];
for (const [c, list] of Object.entries(ROAD_DEFS)) {
  roadsOut[c] = [];
  for (const d of list ?? []) {
    const fa = placeByName(d.from, d.countries[0]) ?? COUNTRY_IDS.map((cc) => placeByName(d.from, cc)).find(Boolean);
    const fb = COUNTRY_IDS.map((cc) => placeByName(d.to, cc)).find(Boolean);
    if (!fa || !fb) { errors.push(`${d.id}: ciudad extrema no encontrada`); continue; }
    const la: LonLat = [fa.properties.longitude, fa.properties.latitude], lb: LonLat = [fb.properties.longitude, fb.properties.latitude];
    const na = nearestNode(la), nb = nearestNode(lb);
    if (na.d > 30 || nb.d > 30) { warnings.push(`${d.id}: descartado (ciudad a más de 30 km de la red)`); roadReport.push(`${d.id}: DESCARTADO`); continue; }
    const path = shortestPath(na.n, nb.n);
    if (!path) { warnings.push(`${d.id}: descartado (sin trazado continuo en la red)`); roadReport.push(`${d.id}: DESCARTADO (sin camino)`); continue; }
    let len = 0; for (let i = 1; i < path.length; i++) len += km(path[i - 1], path[i]);
    const ratio = len / km(la, lb);
    if (ratio > 2) { warnings.push(`${d.id}: descartado (trazado implausible, ${ratio.toFixed(2)}× la línea recta)`); roadReport.push(`${d.id}: DESCARTADO (ratio ${ratio.toFixed(2)})`); continue; }
    const xy = simplify(path.map(P), 0.45);
    roadsOut[c].push({
      id: d.id, name: `Corredor ${fa.properties.name === 'Bogota' ? 'Bogotá' : fa.properties.name} – ${fb.properties.name === 'Bogota' ? 'Bogotá' : fb.properties.name}`,
      countries: d.countries, from: d.from, to: d.to,
      lengthKm: Math.round(len), straightKm: Math.round(km(la, lb)),
      path: 'M' + xy.map(([x, y]) => `${+x.toFixed(1)},${+y.toFixed(1)}`).join('L'),
      source: 'Natural Earth 1:10m Roads (dominio público), camino más corto por la red',
    });
    roadReport.push(`${d.id}: ${Math.round(len)} km de trazado (${ratio.toFixed(2)}× la línea recta), ${xy.length} vértices`);
  }
}

if (errors.length) {
  console.error('ERRORES:\n - ' + errors.join('\n - '));
  process.exit(1);
}

// MAP-002: renderizar la red cartográfica disponible, no solamente los corredores
// seleccionados entre ciudades. Los corredores siguen disponibles como metadatos.
// Agrupamos las geometrías en un único trazado SVG para evitar miles de nodos DOM.
// Natural Earth es una red generalizada: no implica que todos los caminos locales
// existan en esta fuente. No inventamos conexiones entre extremos separados.
const networkSegments: string[] = [];
let networkCount = 0;
for (const feature of roads.features) {
  const geometry = feature.geometry;
  const lines: LonLat[][] = geometry.type === 'MultiLineString'
    ? geometry.coordinates : geometry.type === 'LineString' ? [geometry.coordinates] : [];
  for (const line of lines) {
    if (line.length < 2) continue;
    const xy = simplify(line.map(P), 0.25);
    if (xy.length < 2) continue;
    networkSegments.push('M' + xy.map(([x, y]) => `${+x.toFixed(1)},${+y.toFixed(1)}`).join('L'));
    networkCount++;
  }
}
console.log(`Red vial cartográfica: ${networkCount} segmentos (frente a ${Object.values(roadsOut).reduce((n, list) => n + list.length, 0)} corredores seleccionados)`);

const out = {
  generatedFrom: {
    naturalEarth: 'Natural Earth 1:10m (Populated Places, Admin-1, Roads) y 1:50m (Admin-0), dominio público',
    crossings: 'Fuentes citadas en cada paso fronterizo (consultadas el 22-10-2026)',
    projection: proj,
  },
  cities, crossings, roads: roadsOut,
  roadNetwork: networkSegments.join(''),
};
mkdirSync(new URL('../src/data/geo/', import.meta.url), { recursive: true });
writeFileSync(new URL('../src/data/geo/geo.generated.json', import.meta.url), JSON.stringify(out));

const count = (o: Record<string, unknown[]>) => Object.values(o).reduce((s, l) => s + l.length, 0);
console.log(`Ciudades: ${count(cities)} · Pasos: ${count(crossings)} · Corredores: ${count(roadsOut)} · uniones de red < 1 km: ${joins}`);
for (const l of Object.values(crossings).flat() as { id: string; check?: { kmToBorderA: number; kmToBorderB: number }; lengthKm?: number }[]) {
  console.log(`  paso ${l.id}: ${l.check ? `${l.check.kmToBorderA} / ${l.check.kmToBorderB} km de la frontera` : `fluvial, ${l.lengthKm} km entre terminales`}`);
}
for (const r of roadReport) console.log('  ' + r);
for (const w of warnings) console.warn('  AVISO: ' + w);
