/**
 * ATLAS-001 · Genera src/data/atlas/atlas.generated.json con la cartografía
 * del «Atlas de mando», proyectada exactamente sobre el mapa del juego
 * (src/data/projection.json, la misma que usan generate-map y generate-geo).
 *
 * Solo datos reales de Natural Earth (dominio público), extractos en
 * data-src/natural-earth/:
 *   - admin1-sa         → estados, departamentos y provincias (con su capital, si NE la identifica)
 *   - roads-sa          → vías en tres jerarquías (autopistas, troncales, secundarias)
 *   - rivers-sa, lakes-sa → hidrografía principal
 *   - airports-sa, ports-sa → aeropuertos y puertos (SELECCIÓN de NE: no es exhaustiva)
 *
 * No inventa nada: si un dato no existe en la fuente (p. ej. la capital de un
 * estado), queda en null y la interfaz lo muestra como no disponible.
 *
 * Ejecutar: npm run gen:atlas
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { geoArea, geoBounds, geoMercator, geoPath } from 'd3-geo';

type Pt = [number, number];
const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));

const proj = read('../src/data/projection.json');
const projection = geoMercator().scale(proj.scale).translate(proj.translate);
const P = (ll: number[]): Pt => { const r = projection(ll as [number, number])!; return [Math.round(r[0] * 100) / 100, Math.round(r[1] * 100) / 100]; };
const map = read('../src/data/map.generated.json');

const PLAYABLE = ['ARG', 'BOL', 'BRA', 'CHL', 'COL', 'ECU', 'GUY', 'PRY', 'PER', 'SUR', 'URY', 'VEN'];

// d3-geo exige anillos exteriores en sentido horario; Natural Earth no siempre lo cumple.
function rewind<T extends { geometry: any }>(f: T): T {
  const g = f.geometry;
  if (!g || !['Polygon', 'MultiPolygon'].includes(g.type)) return f;
  const fix = (rings: number[][][]) => (geoArea({ type: 'Polygon', coordinates: rings } as any) > 2 * Math.PI ? rings.map((r) => [...r].reverse()) : rings);
  g.coordinates = g.type === 'Polygon' ? fix(g.coordinates) : g.coordinates.map(fix);
  return f;
}

/** Trazado SVG proyectado y simplificado (descarta vértices a < tol unidades del anterior). */
function pathOf(geometry: any, tol: number): string {
  const raw = geoPath(projection)(geometry) ?? '';
  const out: string[] = [];
  for (const seg of raw.split('M').filter(Boolean)) {
    const closed = seg.endsWith('Z');
    const pts = seg.replace(/Z/g, '').split('L').map((p) => p.split(',').map(Number));
    const keep = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [x, y] = pts[i], [px, py] = keep[keep.length - 1];
      if (Math.hypot(x - px, y - py) >= tol || i === pts.length - 1) keep.push(pts[i]);
    }
    if (closed && keep.length < 4) continue;
    out.push('M' + keep.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L') + (closed ? 'Z' : ''));
  }
  return out.join('');
}

/** Codificación compacta: primer punto absoluto y el resto relativo ("M x,y l dx,dy …"), 1 decimal. */
function rel(d: string): string {
  return d.split('M').filter(Boolean).map((seg) => {
    const closed = seg.endsWith('Z');
    const pts = seg.replace(/Z/g, '').split('L').map((q) => q.split(',').map(Number));
    let [px, py] = pts[0];
    const parts = [`M${px},${py}`];
    const ds: string[] = [];
    for (let i = 1; i < pts.length; i++) {
      const dx = Math.round((pts[i][0] - px) * 10) / 10, dy = Math.round((pts[i][1] - py) * 10) / 10;
      if (!dx && !dy) continue;
      ds.push(`${dx},${dy}`); px = Math.round((px + dx) * 10) / 10; py = Math.round((py + dy) * 10) / 10;
    }
    return parts[0] + (ds.length ? 'l' + ds.join(' ') : '') + (closed ? 'Z' : '');
  }).join('');
}
/** Inversa de rel() para cálculos internos. */
function abs(d: string): string {
  return d.split('M').filter(Boolean).map((seg) => {
    const closed = seg.endsWith('Z');
    const [head, tail] = seg.replace(/Z/g, '').split('l');
    let [x, y] = head.split(',').map(Number);
    const pts = [[x, y]];
    if (tail) for (const q of tail.trim().split(' ')) { const [dx, dy] = q.split(',').map(Number); x = Math.round((x + dx) * 10) / 10; y = Math.round((y + dy) * 10) / 10; pts.push([x, y]); }
    return 'M' + pts.map((p) => p.join(',')).join('L') + (closed ? 'Z' : '');
  }).join('');
}

// ---------- geometría plana (coordenadas del mapa) ----------
type Ring = Pt[];
const ringsOfPath = (d: string): Ring[] => d.split('M').filter(Boolean).map((s) => s.replace(/Z/g, '').split('L').map((p) => p.split(',').map(Number) as Pt));
function inRing([x, y]: Pt, r: Ring): boolean {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}
const inRings = (p: Pt, rs: Ring[]) => rs.filter((r) => inRing(p, r)).length % 2 === 1;
const ringArea = (r: Ring) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(a / 2); };

const regionRings = (map.regions as { id: string; country: string; path: string }[]).map((r) => ({ id: r.id, country: r.country, rings: ringsOfPath(r.path) }));
const countryRings = Object.fromEntries(Object.entries(map.countries as Record<string, string>).map(([c, d]) => [c, ringsOfPath(d)]));

function regionAt(p: Pt, country?: string): string | null {
  for (const r of regionRings) if ((!country || r.country === country) && inRings(p, r.rings)) return r.id;
  return null;
}
/** País jugable bajo el punto; si cae en el agua junto a la costa (puertos), el más cercano a ≤ 4 unidades. */
function countryAt(p: Pt): string | null {
  for (const [c, rs] of Object.entries(countryRings)) if (inRings(p, rs)) return c;
  let best: string | null = null, bestD = 4;
  for (const [c, rs] of Object.entries(countryRings)) for (const r of rs) for (const q of r) { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bestD) { bestD = d; best = c; } }
  return best;
}
function nearestRegion(p: Pt, country: string): string | null {
  const own = regionAt(p, country);
  if (own) return own;
  let best: string | null = null, bestD = Infinity;
  for (const r of regionRings.filter((r) => r.country === country)) for (const ring of r.rings) for (const q of ring) { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bestD) { bestD = d; best = r.id; } }
  return best;
}

// ---------- estados ----------
// Correcciones ortográficas de nombres de Natural Earth (solo grafía; nunca cambian el dato).
const SPELLING: Record<string, string> = { Bogota: 'Bogotá', 'San Juan De Los Morros': 'San Juan de los Morros', 'Lima Province': 'Lima Metropolitana' };
const spell = (s: string | null) => (s ? SPELLING[s] ?? s : s);
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const admin1 = read('../data-src/natural-earth/admin1-sa.geojson').features.map(rewind);
const places = read('../data-src/natural-earth/populated-places-sa.geojson').features;
const capitals = places.filter((f: any) => f.properties.featurecla === 'Admin-1 capital' || f.properties.featurecla === 'Admin-0 capital');

const usedIds = new Set<string>();
const excluded: string[] = [];
const states = admin1
  .filter((f: any) => f.properties.name && f.geometry?.coordinates?.length && PLAYABLE.includes(f.properties.adm0_a3))
  .map((f: any) => {
    const p = f.properties;
    let id = (p.iso_3166_2 ?? `${p.adm0_a3}-${norm(p.name)}`).replace(/[^A-Za-z0-9-]/g, '');
    while (usedIds.has(id)) id += 'x';
    usedIds.add(id);
    const path = pathOf(f.geometry, 0.12);
    const rings = ringsOfPath(path);
    // Punto de rótulo: centroide proyectado de la parte más grande, si cae dentro; si no, el vértice-media más interior.
    const parts = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates.map((c: any) => ({ type: 'Polygon', coordinates: c })) : [f.geometry];
    const gp = geoPath(projection);
    const big = parts.reduce((a: any, b: any) => (gp.area(b) > gp.area(a) ? b : a));
    let label = gp.centroid(big).map((n) => Math.round(n * 10) / 10) as Pt;
    if (!inRings(label, rings)) {
      const bigRing = rings.reduce((a, b) => (ringArea(b) > ringArea(a) ? b : a));
      let best = bigRing[0], bestD = -1;
      for (let i = 0; i < 400; i++) { // muestreo determinista dentro de la caja
        const xs = bigRing.map((q) => q[0]), ys = bigRing.map((q) => q[1]);
        const x = Math.min(...xs) + ((Math.max(...xs) - Math.min(...xs)) * ((i * 0.618) % 1)), y = Math.min(...ys) + ((Math.max(...ys) - Math.min(...ys)) * ((i * 0.414 + 0.2) % 1));
        if (!inRing([x, y], bigRing)) continue;
        const d = Math.min(...bigRing.map((q) => Math.hypot(q[0] - x, q[1] - y)));
        if (d > bestD) { bestD = d; best = [Math.round(x * 10) / 10, Math.round(y * 10) / 10]; }
      }
      label = best;
    }
    // Regiones del juego que ocupa (por vértices y punto de rótulo), de mayor a menor presencia.
    const votes = new Map<string, number>();
    const vote = (pt: Pt, w: number) => { const r = regionAt(pt, p.adm0_a3); if (r) votes.set(r, (votes.get(r) ?? 0) + w); };
    vote(label, 5);
    for (const r of rings) for (let i = 0; i < r.length; i += Math.max(1, Math.floor(r.length / 60))) vote(r[i], 1);
    const regions = [...votes.entries()].sort((a, b) => b[1] - a[1]).map(([r]) => r);
    // Capital por POSICIÓN (la tabla de NE asigna mal algunas provincias): la capital
    // provincial cuyo punto cae dentro del estado; si hay más de una, no se asigna.
    const inside = (kind: string) => capitals.filter((c: any) => c.properties.adm0_a3 === p.adm0_a3 && c.properties.featurecla === kind && inRings(P(c.geometry.coordinates), rings));
    // 1) La capital nacional, si está dentro (distritos capitales). 2) Si no, una única capital
    //    provincial que cumpla A LA VEZ posición y nombre de provincia en la tabla de NE.
    const a0 = inside('Admin-0 capital');
    const a1 = inside('Admin-1 capital').filter((c: any) => c.properties.adm1name && norm(c.properties.adm1name) === norm(p.name));
    const cap = a0.length === 1 ? a0[0] : a1.length === 1 ? a1[0] : null;
    return {
      id, name: spell(p.name) as string, type: (p.type as string | null) ?? null, country: p.adm0_a3 as string,
      path: rel(path), label, area: Math.round(rings.reduce((s, r) => s + ringArea(r), 0)),
      capital: cap ? spell(cap.properties.name as string) : null,
      region: regions[0] ?? nearestRegion(label, p.adm0_a3),
      regions,
    };
  })
  // Fuera del mapa del juego (p. ej. Galápagos, a 1000 km de la costa): se excluye y se documenta.
  .filter((s: any) => { const ok = s.label[0] > -20 && s.label[0] < map.width + 20 && s.label[1] > -20 && s.label[1] < map.height + 20; if (!ok) excluded.push(s.name); return ok; });

// ---------- vías (jerarquía tipo Apple Maps) ----------
// Natural Earth Roads 10m: type = 'Major Highway' (autopistas) | 'Road' | 'Unknown'; scalerank 3 (más importante) … 10.
const roadsSrc = read('../data-src/natural-earth/roads-sa.geojson').features;
const tierOf = (p: any): 'motorway' | 'trunk' | 'secondary' => (p.type === 'Major Highway' ? 'motorway' : p.type === 'Road' && p.scalerank <= 4 ? 'trunk' : 'secondary');
const roads = { motorway: [] as string[], trunk: [] as string[], secondary: [] as string[] };
for (const f of roadsSrc) roads[tierOf(f.properties)].push(rel(pathOf(f.geometry, tierOf(f.properties) === 'secondary' ? 0.4 : 0.25)));

// ---------- hidrografía ----------
const rivers = read('../data-src/natural-earth/rivers-sa.geojson').features
  .filter((f: any) => geoBounds(f)[1][0] < -30 && geoBounds(f)[0][1] > -57)
  .map((f: any) => ({ name: (f.properties.name_es ?? f.properties.name ?? null) as string | null, rank: f.properties.scalerank as number, path: rel(pathOf(f.geometry, 0.35)) }))
  .filter((r: any) => r.path);
const lakes = read('../data-src/natural-earth/lakes-sa.geojson').features.map(rewind)
  .map((f: any) => ({ name: (f.properties.name_es ?? f.properties.name ?? null) as string | null, rank: f.properties.scalerank as number, path: rel(pathOf(f.geometry, 0.25)) }))
  .filter((l: any) => l.path);

// ---------- instalaciones (selección de Natural Earth) ----------
const stateRings = states.map((s: any) => ({ id: s.id, country: s.country, rings: ringsOfPath(abs(s.path)) }));
const stateAt = (p: Pt, c: string | null) => {
  const own = stateRings.find((s: any) => s.country === c && inRings(p, s.rings));
  if (own) return own.id;
  let best: string | null = null, bestD = 4;
  for (const s of stateRings.filter((s: any) => s.country === c)) for (const r of s.rings) for (const q of r) { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bestD) { bestD = d; best = s.id; } }
  return best;
};
const slug = (s: string) => norm(s).slice(0, 24);
function facility(kind: 'airport' | 'port', f: any) {
  const p = f.properties, lonlat = f.geometry.coordinates as Pt, xy = P(lonlat);
  const country = countryAt(xy);
  if (!country) return null;
  return {
    id: `${kind === 'airport' ? 'ap' : 'pt'}-${(p.iata_code || slug(p.name)).toLowerCase()}`,
    kind, name: p.name as string, iata: (p.iata_code as string) || null,
    neType: (p.type as string) ?? null, rank: p.scalerank as number, country,
    state: stateAt(xy, country), region: nearestRegion(xy, country),
    lonlat, xy, wikidata: (p.wikidataid as string) ?? null,
    source: kind === 'airport' ? 'Natural Earth 1:10m Airports (dominio público)' : 'Natural Earth 1:10m Ports (dominio público)',
  };
}
const airports = read('../data-src/natural-earth/airports-sa.geojson').features.map((f: any) => facility('airport', f)).filter(Boolean);
const ports = read('../data-src/natural-earth/ports-sa.geojson').features.map((f: any) => facility('port', f)).filter(Boolean);
const dedupe = (xs: any[]) => { const seen = new Set<string>(); return xs.filter((x) => { while (seen.has(x.id)) x.id += 'x'; seen.add(x.id); return true; }); };

const out = {
  generatedFrom: {
    naturalEarth: 'Natural Earth 1:10m (Admin-1, Roads, Rivers, Lakes, Airports, Ports) v5.1.2 · commit ca96624 · dominio público',
    projection: proj,
    notes: [
      'Aeropuertos y puertos: selección de Natural Earth (instalaciones principales). No es un inventario completo.',
      'Capital de un estado: la capital nacional si está dentro; si no, la única "Admin-1 capital" de NE que coincide en posición y nombre de provincia. Si no hay certeza, null.',
    ],
    excludedStates: excluded,
  },
  states,
  roads: { motorway: roads.motorway.join(''), trunk: roads.trunk.join(''), secondary: roads.secondary.join('') },
  rivers,
  lakes,
  airports: dedupe(airports),
  ports: dedupe(ports),
};
mkdirSync(new URL('../src/data/atlas/', import.meta.url), { recursive: true });
const json = JSON.stringify(out);
writeFileSync(new URL('../src/data/atlas/atlas.generated.json', import.meta.url), json);
console.log(`Atlas: ${states.length} estados · vías ${roadsSrc.length} (autopistas ${roads.motorway.length}, troncales ${roads.trunk.length}, secundarias ${roads.secondary.length}) · ${rivers.length} ríos · ${lakes.length} lagos · ${out.airports.length} aeropuertos · ${out.ports.length} puertos · ${(json.length / 1024).toFixed(0)} KB`);
const noCap = states.filter((s: any) => !s.capital).length, noReg = states.filter((s: any) => !s.region).length;
console.log(`  estados sin capital identificada en NE: ${noCap} · sin región del juego: ${noReg}`);
