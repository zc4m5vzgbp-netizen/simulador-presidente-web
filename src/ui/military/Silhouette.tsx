/**
 * Siluetas genéricas de perfil para la ficha ilustrada (MIL-143/144).
 * Son dibujos esquemáticos propios: no representan ningún modelo real.
 */
import type { EquipCategory } from '../../engine/equipment';

export type SilhouetteKind = EquipCategory | 'infantry';

const PATHS: Record<SilhouetteKind, string> = {
  // Carro de combate: casco bajo, torreta y cañón largo, tren de rodaje.
  tank: 'M6 15h34l4 3-3 4H8l-4-4zM14 10h14l3 4H12zM31 11.2h15v1.6H31zM9 22.5a2.2 2.2 0 1 0 0.01 0zM15 22.5a2.2 2.2 0 1 0 .01 0zM21 22.5a2.2 2.2 0 1 0 .01 0zM27 22.5a2.2 2.2 0 1 0 .01 0zM33 22.5a2.2 2.2 0 1 0 .01 0zM39 22.5a2.2 2.2 0 1 0 .01 0z',
  // Blindado de ruedas: casco alto inclinado, torreta pequeña, cuatro ruedas.
  armored: 'M5 19l3-8h24l9 4 3 4v2H5zM16 7h8v4h-8zM24 8.4h9v1.4h-9zM11 21.5a3 3 0 1 0 .01 0zM19 21.5a3 3 0 1 0 .01 0zM29 21.5a3 3 0 1 0 .01 0zM37 21.5a3 3 0 1 0 .01 0z',
  // Obús remolcado: tubo elevado, escudo, afuste y rueda.
  artillery: 'M10 15l26-11 1.2 2.2L12 17.6zM14 13h6v6h-6zM8 19l14 0 14 5h-3l-12-3H8zM17 21.5a3.5 3.5 0 1 0 .01 0z',
  // Dron de ala fija: fuselaje, ala recta, cola en V.
  drone: 'M6 14.2h32l4 1.8-4 1.8H6zM18 9h4l3 5h-6zM18 22.6h4l3-4.8h-6zM4 11l4 3.6H5zM4 21l4-3.6H5z',
  // Camión de transporte: cabina, caja con lona, tres ejes.
  transport: 'M4 8h26v12H4zM31 11h7l5 5v4H31zM33 12.5h4l3 3h-7zM9 21.5a2.8 2.8 0 1 0 .01 0zM16 21.5a2.8 2.8 0 1 0 .01 0zM37 21.5a2.8 2.8 0 1 0 .01 0z',
  // Fusilero: figura de pie con fusil.
  infantry: 'M24 3.5a2.6 2.6 0 1 0 .01 0zM21 8h6l1.6 7-1.6.6V24h-2.2l-.8-7-.8 7h-2.2v-8.4L19.4 15zM27.5 9.5l8.5-3 .5 1-8.6 3.6z',
};

export function Silhouette({ kind, width = 40, className, title }: { kind: SilhouetteKind; width?: number; className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 48 26" width={width} height={(width * 26) / 48} className={`silhouette ${className ?? ''}`} aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      <path d={PATHS[kind]} fill="currentColor" fillRule="nonzero" />
    </svg>
  );
}
