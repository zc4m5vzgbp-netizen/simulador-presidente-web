/**
 * Paleta del Atlas de mando: colores de país del juego, DESATURADOS para el
 * mapa (terreno sobrio, buen contraste con fronteras, vías y unidades). El país
 * del jugador conserva algo más de color para reconocerlo de un vistazo.
 * Solo afecta al dibujo del mapa; los colores originales siguen en COUNTRY_DEFS.
 */
import type { CountryId } from '../../engine/types';
import { COUNTRY_DEFS } from '../../data/countries';

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c: number[]) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

/** Mezcla un color con un gris neutro (desatura) y ajusta su luminosidad. */
export function desaturate(color: string, amount: number, lightness = 1): string {
  const [r, g, b] = hex(color);
  const l = 0.299 * r + 0.587 * g + 0.114 * b;
  return toHex([r, g, b].map((v) => (v + (l - v) * amount) * lightness));
}

const cache = new Map<string, string>();
/** Relleno del territorio controlado por `c` visto por el jugador `player`. */
export function territoryFill(c: CountryId, player: CountryId): string {
  const key = `${c}|${player}`;
  let v = cache.get(key);
  if (!v) {
    v = c === player ? desaturate(COUNTRY_DEFS[c].color, 0.42, 0.62) : desaturate(COUNTRY_DEFS[c].color, 0.68, 0.48);
    cache.set(key, v);
  }
  return v;
}
