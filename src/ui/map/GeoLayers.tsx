/**
 * Capas cartográficas de MAP-001 (carreteras, pasos fronterizos y ciudades).
 *
 * Capa VISUAL: solo lee los datos de `src/geo` (cartografía) y nunca el motor.
 * Mostrar u ocultar estas capas no cambia el estado de la partida.
 *
 * Tamaños en píxeles de pantalla: se multiplican por `k` (unidades de mapa por
 * píxel) para que iconos y textos mantengan su tamaño al hacer zoom.
 */
import { memo } from 'react';
import { CITIES, CROSSINGS, ROAD_NETWORK, type City, type Crossing } from '../../geo';

export interface Box { x0: number; y0: number; x1: number; y1: number }

const DISPLAY = '"Saira Condensed", "Arial Narrow", "Roboto Condensed", system-ui, sans-serif';
const BODY = '"Source Sans 3", "Source Sans Pro", system-ui, -apple-system, "Segoe UI", sans-serif';
let ctx: CanvasRenderingContext2D | null | undefined;
const widthCache = new Map<string, number>();

/**
 * Ancho real (px) de un texto con la fuente disponible en este momento. Si no
 * hay canvas (pruebas sin navegador) se usa una estimación prudente.
 * `clearTextWidths` se llama cuando terminan de cargar las fuentes web.
 */
export function textWidth(text: string, px: number, weight: number, display: boolean, letterSpacingEm = 0): number {
  const key = `${text}|${weight}|${display}`;
  let w100 = widthCache.get(key);
  if (w100 === undefined) {
    if (ctx === undefined) ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
    if (ctx) { ctx.font = `${weight} 100px ${display ? DISPLAY : BODY}`; w100 = ctx.measureText(text).width; }
    else w100 = text.length * 62;
    widthCache.set(key, w100);
  }
  return (w100 * px) / 100 + text.length * letterSpacingEm * px;
}
export const clearTextWidths = () => widthCache.clear();

/** Umbrales de zoom (k = unidades de mapa por píxel; menor = más cerca). */
export const ZOOM = {
  /** Nombres de capitales y sedes de gobierno. */
  capitalNames: 1.6,
  /** Iconos de ciudades principales. */
  cityIcons: 1.0,
  /** Nombres de ciudades principales. */
  cityNames: 0.75,
} as const;

const isCapital = (c: City) => c.kind !== 'city';

/** Radio del icono de cada ciudad en píxeles de pantalla. */
export const cityRadius = (c: City) => (c.kind === 'capital' ? 6.5 : c.kind === 'seat' ? 5 : 3);
export const CROSSING_R = 5.5;

/** Ciudades cuyo icono se dibuja a este zoom (capitales siempre). */
export function visibleCities(k: number): City[] {
  return CITIES.filter((c) => isCapital(c) || k < ZOOM.cityIcons);
}

export function cityIconBox(c: City, k: number): Box {
  const r = (cityRadius(c) + 1.5) * k;
  return { x0: c.xy[0] - r, y0: c.xy[1] - r, x1: c.xy[0] + r, y1: c.xy[1] + r };
}

export function crossingIconBox(x: Crossing, k: number): Box {
  const r = (CROSSING_R + 1.5) * k;
  return { x0: x.xy[0] - r, y0: x.xy[1] - r, x1: x.xy[0] + r, y1: x.xy[1] + r };
}

/** Rótulos candidatos de ciudad: capitales primero y luego por relevancia. */
export function cityLabelItems(cities: City[], k: number) {
  return cities
    .filter((c) => (isCapital(c) ? k < ZOOM.capitalNames : k < ZOOM.cityNames))
    .sort((a, b) => Number(isCapital(b)) - Number(isCapital(a)) || a.rank - b.rank)
    .map((c) => {
      const fs = isCapital(c) ? 11 : 10;
      const w = (textWidth(c.name, fs, isCapital(c) ? 700 : 600, isCapital(c), isCapital(c) ? 0.03 : 0.01) + 6) * k;
      const r = cityRadius(c) * k;
      // Posición base: a la derecha del icono; placeLabels prueba otras.
      const x = c.xy[0] + r + 3 * k + w / 2, y = c.xy[1];
      // Alto generoso: algunas fuentes de sustitución tienen ascendentes mayores.
      const hh = (fs * 0.75 + 1) * k;
      return { c, x, y, w, fs, box: { x0: x - w / 2, y0: y - hh, x1: x + w / 2, y1: y + hh } as Box };
    });
}

/** Desplazamientos de prueba para rótulos de ciudad (px): derecha, izquierda, arriba, abajo. */
export function cityLabelCandidates(item: { w: number; c: City }, k: number): [number, number][] {
  const r = cityRadius(item.c);
  const span = item.w / k + 2 * r + 6; // de "a la derecha" a "a la izquierda"
  const half = item.w / k / 2 + r + 3;
  return [[0, 0], [-span, 0], [-half, -13], [-half, 13], [0, -12], [0, 12], [-span, -12], [-span, 12]];
}

/**
 * Radio táctil (px) de cada icono: amplio para el dedo, pero nunca mayor que la
 * mitad de la distancia al icono vecino, para que dos iconos cercanos (p. ej.
 * Buenos Aires y el transbordador a Colonia) sigan siendo tocables por separado.
 */
export function hitRadii(cities: City[], crossings: Crossing[], k: number): Map<string, number> {
  const pts = [
    ...cities.map((c) => ({ id: c.id, xy: c.xy, min: cityRadius(c) + 1 })),
    ...crossings.map((x) => ({ id: x.id, xy: x.xy, min: CROSSING_R + 1 })),
  ];
  const out = new Map<string, number>();
  for (const p of pts) {
    let near = Infinity;
    for (const q of pts) if (q !== p) near = Math.min(near, Math.hypot(p.xy[0] - q.xy[0], p.xy[1] - q.xy[1]) / k);
    out.set(p.id, Math.max(p.min, Math.min(12, near / 2)));
  }
  return out;
}

// ---------------- Carreteras (estáticas: se memorizan) ----------------

/** Trazados viales reales; el grosor no depende del zoom (vector-effect). */
export const RoadsLayer = memo(function RoadsLayer() {
  return (
    <>
      {ROAD_NETWORK && <g data-road-network="true" className="road">
        <path d={ROAD_NETWORK} className="road-casing" vectorEffect="non-scaling-stroke" />
        <path d={ROAD_NETWORK} className="road-line" vectorEffect="non-scaling-stroke" />
      </g>}
    </>
  );
});

// ---------------- Pasos fronterizos ----------------

export function CrossingsLayer({ k, selectedId, hits }: { k: number; selectedId: string | null; hits: Map<string, number> }) {
  const s = CROSSING_R * k;
  return (
    <>
      {CROSSINGS.filter((x) => x.type === 'fluvial' && x.terminalsXY).map((x) => {
        const [a, b] = x.terminalsXY!;
        return <line key={`fl-${x.id}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className="crossing-link" vectorEffect="non-scaling-stroke" />;
      })}
      {CROSSINGS.map((x) => {
        const sel = x.id === selectedId;
        const [cx, cy] = x.xy;
        return (
          <g key={x.id} data-crossing={x.id} data-crossing-type={x.type} className={`crossing ${x.type}${sel ? ' sel' : ''}`}
            transform={`translate(${cx} ${cy})`} aria-label={`Paso fronterizo: ${x.name}`}>
            <circle r={(hits.get(x.id) ?? CROSSING_R * 2) * k} className="hit" />
            {x.type === 'terrestre' ? (
              <>
                <rect x={-s * 0.8} y={-s * 0.8} width={s * 1.6} height={s * 1.6} transform="rotate(45)" className="crossing-shape" style={{ strokeWidth: 1.2 * k }} />
                <path d={`M${-s * 0.5} 0H${s * 0.5}`} className="crossing-mark" style={{ strokeWidth: 1.4 * k }} />
              </>
            ) : (
              <>
                <circle r={s} className="crossing-shape" style={{ strokeWidth: 1.2 * k }} />
                <path d={`M${-s * 0.6} ${s * 0.1}q${s * 0.3} ${-s * 0.4} ${s * 0.6} 0t${s * 0.6} 0`} className="crossing-mark" style={{ strokeWidth: 1.2 * k }} />
              </>
            )}
          </g>
        );
      })}
    </>
  );
}

// ---------------- Ciudades ----------------

function star(r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push(`${(Math.cos(a) * rr).toFixed(3)},${(Math.sin(a) * rr).toFixed(3)}`);
  }
  return `M${pts.join('L')}Z`;
}

export function CitiesLayer({ cities, labels, k, selectedId, hits }: {
  hits: Map<string, number>;
  cities: City[];
  labels: { c: City; x: number; y: number; dx: number; dy: number; fs: number }[];
  k: number;
  selectedId: string | null;
}) {
  return (
    <>
      {cities.map((c) => {
        const r = cityRadius(c) * k;
        const sel = c.id === selectedId;
        return (
          <g key={c.id} data-city={c.id} data-city-kind={c.kind} className={`city ${c.kind}${sel ? ' sel' : ''}`}
            transform={`translate(${c.xy[0]} ${c.xy[1]})`} aria-label={`Ciudad: ${c.name}`}>
            <circle r={(hits.get(c.id) ?? 9) * k} className="hit" />
            {c.kind === 'capital' && <path d={star(r)} className="city-shape" style={{ strokeWidth: 1.1 * k }} />}
            {c.kind === 'seat' && (
              <>
                <circle r={r} className="city-shape ring" style={{ strokeWidth: 1.6 * k }} />
                <circle r={r * 0.38} className="city-core" />
              </>
            )}
            {c.kind === 'city' && <circle r={r} className="city-shape" style={{ strokeWidth: 1 * k }} />}
          </g>
        );
      })}
      <g pointerEvents="none">
        {labels.map(({ c, x, y, dx, dy, fs }) => (
          <text key={c.id} x={x + dx} y={y + dy} className={`label city-label ${c.kind}`} data-city-label={c.id} style={{ fontSize: fs * k }}>{c.name}</text>
        ))}
      </g>
    </>
  );
}
