/**
 * Genera src/data/map.generated.json a partir de las fronteras de Natural Earth
 * (dominio público) y de las definiciones de regiones (src/data/regionDefs.ts).
 *
 * Ejecutar: npx tsx scripts/generate-map.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { geoMercator } from 'd3-geo';
import { Delaunay } from 'd3-delaunay';
import { REGION_DEFS, COUNTRY_IDS } from '../src/data/regionDefs';

type Pt = [number, number];
type Ring = Pt[];

const WIDTH = 1000;
const SIMPLIFY_PX = 0.7;
const MIN_POLY_AREA = 6; // px², descarta islotes diminutos
const ADJ_DIST = 2.6; // px, tolerancia para considerar fronteras compartidas
const SA_BOX = { minLon: -82, maxLon: -33, minLat: -56.5, maxLat: 13.5 };

// Ajustes manuales de adyacencia (pasos terrestres que el cálculo no detecta
// o contactos de un solo punto que no deberían contar).
const ADD_EDGES: [string, string][] = [];
const REMOVE_EDGES: [string, string][] = [];

const geo = JSON.parse(readFileSync(new URL('../data-src/south-america-ne50.geojson', import.meta.url), 'utf8'));

function polygonsOf(geom: any): number[][][][] {
  if (geom.type === 'Polygon') return [geom.coordinates];
  if (geom.type === 'MultiPolygon') return geom.coordinates;
  return [];
}

function inBox(ring: number[][]): boolean {
  let lon = 0, lat = 0;
  for (const [x, y] of ring) { lon += x; lat += y; }
  lon /= ring.length; lat /= ring.length;
  return lon >= SA_BOX.minLon && lon <= SA_BOX.maxLon && lat >= SA_BOX.minLat && lat <= SA_BOX.maxLat;
}

// Recoger anillos exteriores por país (en lon/lat)
const raw: Record<string, number[][][]> = {};
for (const f of geo.features) {
  const iso = f.properties.iso as string;
  for (const poly of polygonsOf(f.geometry)) {
    const outer = poly[0];
    if (!inBox(outer)) continue;
    (raw[iso] ??= []).push(outer);
  }
}

const playable = { type: 'FeatureCollection', features: COUNTRY_IDS.map((iso) => ({
  type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: raw[iso].map((r) => [r]) },
})) };

const projection = geoMercator().fitWidth(WIDTH - 40, playable as any);
const t = projection.translate();
projection.translate([t[0] + 20, t[1] + 20]);

const proj = (p: number[]): Pt => {
  const r = projection(p as [number, number])!;
  return [Math.round(r[0] * 100) / 100, Math.round(r[1] * 100) / 100];
};

// ---------- geometría ----------
function area(r: Ring): number {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
  return a / 2;
}

function simplifyDP(points: Ring, tol: number): Ring {
  if (points.length < 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = 0, idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = segDist(points[i], points[s], points[e]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol && idx > 0) { keep[idx] = 1; stack.push([s, idx], [idx, e]); }
  }
  return points.filter((_, i) => keep[i]);
}

function segDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  let tt = len2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2 : 0;
  tt = Math.max(0, Math.min(1, tt));
  const x = a[0] + tt * dx, y = a[1] + tt * dy;
  return Math.hypot(p[0] - x, p[1] - y);
}

function signedArea(r: Ring): number {
  let a = 0;
  for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return a / 2;
}

/** Sutherland–Hodgman: recorta un polígono (puede ser cóncavo) con uno convexo. */
function clipConvex(subject: Ring, clip: Ring): Ring {
  const orient = signedArea(clip) > 0 ? 1 : -1;
  const inside = (p: Pt, a: Pt, b: Pt) => orient * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) >= 0;
  const inter = (p: Pt, q: Pt, a: Pt, b: Pt): Pt => {
    const a1 = q[1] - p[1], b1 = p[0] - q[0], c1 = a1 * p[0] + b1 * p[1];
    const a2 = b[1] - a[1], b2 = a[0] - b[0], c2 = a2 * a[0] + b2 * a[1];
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1e-12) return q;
    return [(b2 * c1 - b1 * c2) / det, (a1 * c2 - a2 * c1) / det];
  };
  let output = subject.slice();
  for (let i = 0; i < clip.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length];
    const input = output;
    output = [];
    if (!input.length) break;
    let s = input[input.length - 1];
    for (const e of input) {
      if (inside(e, a, b)) {
        if (!inside(s, a, b)) output.push(inter(s, e, a, b));
        output.push(e);
      } else if (inside(s, a, b)) output.push(inter(s, e, a, b));
      s = e;
    }
  }
  return output.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100] as Pt);
}

function pointInRing(p: Pt, r: Ring): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pathOf(rings: Ring[]): string {
  return rings.map((r) => 'M' + r.map(([x, y]) => `${+x.toFixed(1)},${+y.toFixed(1)}`).join('L') + 'Z').join('');
}

function centroid(r: Ring): Pt {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const f = r[j][0] * r[i][1] - r[i][0] * r[j][1];
    a += f; cx += (r[j][0] + r[i][0]) * f; cy += (r[j][1] + r[i][1]) * f;
  }
  a *= 0.5;
  return [cx / (6 * a), cy / (6 * a)];
}

// ---------- proyectar países ----------
const countryRings: Record<string, Ring[]> = {};
for (const [iso, rings] of Object.entries(raw)) {
  countryRings[iso] = rings
    .map((r) => simplifyDP(r.map(proj), SIMPLIFY_PX))
    .filter((r) => r.length >= 4 && Math.abs(area(r)) >= MIN_POLY_AREA);
}

// ---------- regiones ----------
interface RegionOut { id: string; country: string; path: string; anchor: Pt; rings: Ring[]; area: number }
const regions: RegionOut[] = [];

for (const iso of COUNTRY_IDS) {
  const defs = REGION_DEFS.filter((d) => d.country === iso);
  const rings = countryRings[iso];
  if (defs.length === 1) {
    const d = defs[0];
    regions.push({ id: d.id, country: iso, path: pathOf(rings), anchor: proj(d.seed), rings, area: rings.reduce((s, r) => s + Math.abs(area(r)), 0) });
    continue;
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rings) for (const [x, y] of r) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  const seeds = defs.map((d) => proj(d.seed));
  const vor = Delaunay.from(seeds).voronoi([minX - 60, minY - 60, maxX + 60, maxY + 60]);
  defs.forEach((d, i) => {
    const cell = vor.cellPolygon(i) as unknown as Ring;
    const cellRing = cell.slice(0, -1) as Ring;
    const parts = rings.map((r) => clipConvex(r, cellRing)).filter((r) => r.length >= 3 && Math.abs(area(r)) >= MIN_POLY_AREA);
    if (!parts.length) throw new Error(`Región vacía: ${d.id}`);
    const anchor = seeds[i];
    regions.push({ id: d.id, country: iso, path: pathOf(parts), anchor, rings: parts, area: parts.reduce((s, r) => s + Math.abs(area(r)), 0) });
  });
}

// Verificar que el ancla esté dentro de su región
for (const r of regions) {
  if (!r.rings.some((ring) => pointInRing(r.anchor, ring))) {
    const biggest = r.rings.slice().sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)))[0];
    const c = centroid(biggest);
    console.warn(`Ancla fuera de ${r.id}; usando centroide`, c);
    r.anchor = [Math.round(c[0] * 10) / 10, Math.round(c[1] * 10) / 10];
  }
}

// ---------- adyacencias ----------
function closeCount(a: RegionOut, b: RegionOut): number {
  let n = 0;
  for (const ra of a.rings) for (const p of ra) {
    for (const rb of b.rings) {
      for (let i = 0; i < rb.length; i++) {
        const q1 = rb[i], q2 = rb[(i + 1) % rb.length];
        if (Math.abs(p[0] - q1[0]) > 40 && Math.abs(p[0] - q2[0]) > 40) continue;
        if (segDist(p, q1, q2) <= ADJ_DIST) { n++; break; }
      }
    }
  }
  return n;
}

const neighbors: Record<string, Set<string>> = {};
for (const r of regions) neighbors[r.id] = new Set();
for (let i = 0; i < regions.length; i++) {
  for (let j = i + 1; j < regions.length; j++) {
    const n = closeCount(regions[i], regions[j]) + closeCount(regions[j], regions[i]);
    if (n >= 3) { neighbors[regions[i].id].add(regions[j].id); neighbors[regions[j].id].add(regions[i].id); }
  }
}
for (const [a, b] of ADD_EDGES) { neighbors[a].add(b); neighbors[b].add(a); }
for (const [a, b] of REMOVE_EDGES) { neighbors[a].delete(b); neighbors[b].delete(a); }

// ---------- tierras neutrales (contexto) ----------
const neutral: { name: string; path: string }[] = [];
const neutralNames: Record<string, string> = { FRA: 'Guayana Francesa', PAN: 'Panamá', CRI: 'Costa Rica' };
for (const iso of ['FRA', 'PAN', 'CRI']) {
  if (countryRings[iso]?.length) neutral.push({ name: neutralNames[iso], path: pathOf(countryRings[iso]) });
}

let maxY = 0;
for (const r of regions) for (const ring of r.rings) for (const [, y] of ring) maxY = Math.max(maxY, y);

// Rótulos de mares y océanos (posiciones geográficas reales, solo decorativas).
const seaLabels = [
  { name: 'Mar Caribe', at: proj([-72.5, 14.2]) },
  { name: 'Océano Pacífico', at: proj([-87, -16]) },
  { name: 'Océano Atlántico', at: proj([-31, -24]) },
];

const out = {
  source: 'Natural Earth 1:50m Admin 0 (dominio público), proyección Mercator, simplificado',
  width: WIDTH,
  height: Math.ceil(maxY + 20),
  countries: Object.fromEntries(COUNTRY_IDS.map((iso) => [iso, pathOf(countryRings[iso])])),
  neutral,
  seaLabels,
  regions: regions.map((r) => ({
    id: r.id, country: r.country, path: r.path, anchor: r.anchor, area: Math.round(r.area),
    neighbors: [...neighbors[r.id]].sort(),
  })),
};

writeFileSync(new URL('../src/data/map.generated.json', import.meta.url), JSON.stringify(out));
console.log(`Mapa: ${out.width}x${out.height}, ${regions.length} regiones`);
for (const r of out.regions) console.log(r.id.padEnd(6), r.neighbors.join(' '));
