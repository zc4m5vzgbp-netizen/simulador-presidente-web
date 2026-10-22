/**
 * Símbolo militar reutilizable (mapa, paneles y futuras fichas de composición).
 * Dibuja en unidades de símbolo (1 = 1 px a escala 1); quien lo usa aplica la escala.
 */
import { ECHELON_MARK, CATEGORIES, frameFor, glyphFor, type Affiliation, type Echelon, type UnitCategory } from './symbology';

export function MilitarySymbol({ category, affiliation, echelon, frameClass = '', title }: {
  category: UnitCategory;
  affiliation: Affiliation;
  echelon?: Echelon | null;
  /** Clase extra del marco (p. ej. "stack-box" en el mapa). */
  frameClass?: string;
  title?: string;
}) {
  const frame = frameFor(affiliation, CATEGORIES[category].domain);
  const glyph = glyphFor(category, frame.inner);
  return (
    <g className={`msym ${affiliation} cat-${category}`}>
      {title && <title>{title}</title>}
      <path d={frame.d} className={`msym-frame ${frameClass}`.trim()} />
      {category === 'formation' && <path d={frame.d} className="msym-inner" transform="scale(0.78)" />}
      {glyph.stroke && <path d={glyph.stroke} className="msym-glyph" />}
      {glyph.fill && <path d={glyph.fill} className="msym-glyph-fill" />}
      {echelon && <text y={frame.top - 2.5} className="msym-ech">{ECHELON_MARK[echelon]}</text>}
    </g>
  );
}

/** Icono de símbolo para listas y paneles (SVG autónomo). */
export function MilitarySymbolIcon({ category, affiliation, size = 28, echelon }: { category: UnitCategory; affiliation: Affiliation; size?: number; echelon?: Echelon | null }) {
  return (
    <svg className="msym-icon" width={size} height={size * 0.8} viewBox="-15 -14 30 24" aria-hidden="true">
      <MilitarySymbol category={category} affiliation={affiliation} echelon={echelon} />
    </svg>
  );
}
