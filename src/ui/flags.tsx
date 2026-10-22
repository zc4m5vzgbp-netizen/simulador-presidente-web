/**
 * Banderas simplificadas (SVG, proporción 3:2) de los 12 países.
 * Versiones esquemáticas para iconos pequeños; no reproducen los escudos.
 */
import type { ReactNode } from 'react';
import type { CountryId } from '../engine/types';

const W = 30, H = 20;

function stripesH(colors: string[]): ReactNode {
  const h = H / colors.length;
  return colors.map((c, i) => <rect key={i} x={0} y={i * h} width={W} height={h + 0.05} fill={c} />);
}

function stripesV(colors: string[]): ReactNode {
  const w = W / colors.length;
  return colors.map((c, i) => <rect key={i} x={i * w} y={0} width={w + 0.05} height={H} fill={c} />);
}

function star(cx: number, cy: number, r: number, fill: string) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.42 : r;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return <polygon points={pts.join(' ')} fill={fill} />;
}

const FLAGS: Record<CountryId, ReactNode> = {
  ARG: <>{stripesH(['#74acdf', '#ffffff', '#74acdf'])}<circle cx={15} cy={10} r={2.2} fill="#f6b40e" /></>,
  BOL: <>{stripesH(['#d52b1e', '#f9e300', '#007934'])}</>,
  BRA: <>
    <rect width={W} height={H} fill="#009c3b" />
    <polygon points="15,2.2 27.6,10 15,17.8 2.4,10" fill="#ffdf00" />
    <circle cx={15} cy={10} r={4.6} fill="#002776" />
    <path d="M10.6 9.2 Q15 7.6 19.4 10.4" stroke="#fff" strokeWidth={0.8} fill="none" />
  </>,
  CHL: <>
    <rect width={W} height={H / 2} fill="#ffffff" />
    <rect y={H / 2} width={W} height={H / 2} fill="#d52b1e" />
    <rect width={10} height={10} fill="#0039a6" />
    {star(5, 5, 2.7, '#ffffff')}
  </>,
  COL: <>
    <rect width={W} height={10} fill="#fcd116" />
    <rect y={10} width={W} height={5} fill="#003893" />
    <rect y={15} width={W} height={5} fill="#ce1126" />
  </>,
  ECU: <>
    <rect width={W} height={10} fill="#ffdd00" />
    <rect y={10} width={W} height={5} fill="#034ea2" />
    <rect y={15} width={W} height={5} fill="#ed1c24" />
    <ellipse cx={15} cy={10} rx={2.4} ry={3} fill="#7a5c2e" stroke="#ffdd00" strokeWidth={0.5} />
  </>,
  GUY: <>
    <rect width={W} height={H} fill="#009e49" />
    <polygon points="0,0 30,10 0,20" fill="#ffffff" />
    <polygon points="0,1.2 27,10 0,18.8" fill="#fcd116" />
    <polygon points="0,0 15,10 0,20" fill="#000000" />
    <polygon points="0,1.6 12.6,10 0,18.4" fill="#ce1126" />
  </>,
  PRY: <>{stripesH(['#d52b1e', '#ffffff', '#0038a8'])}<circle cx={15} cy={10} r={2.1} fill="none" stroke="#0038a8" strokeWidth={0.6} /></>,
  PER: <>{stripesV(['#d91023', '#ffffff', '#d91023'])}</>,
  SUR: <>
    <rect width={W} height={H} fill="#377e3f" />
    <rect y={4} width={W} height={12} fill="#ffffff" />
    <rect y={5.6} width={W} height={8.8} fill="#b40a2d" />
    {star(15, 10, 3.4, '#ecc81d')}
  </>,
  URY: <>
    {Array.from({ length: 9 }, (_, i) => <rect key={i} x={0} y={(i * H) / 9} width={W} height={H / 9 + 0.05} fill={i % 2 ? '#0038a8' : '#ffffff'} />)}
    <rect width={11} height={(H / 9) * 5} fill="#ffffff" />
    <circle cx={5.5} cy={5.5} r={2.6} fill="#fcd116" />
  </>,
  VEN: <>
    {stripesH(['#ffcc00', '#00247d', '#cf142b'])}
    {Array.from({ length: 8 }, (_, i) => {
      const a = Math.PI * (0.84 - (i * 0.68) / 7);
      return <circle key={i} cx={15 + 4.6 * Math.cos(a)} cy={11.6 - 4.6 * Math.sin(a)} r={0.62} fill="#ffffff" />;
    })}
  </>,
};

/** Bandera como SVG en línea (HTML). `size` = ancho en px. */
export function FlagIcon({ c, size = 24, className }: { c: CountryId; size?: number; className?: string }) {
  return (
    <svg className={`flag${className ? ` ${className}` : ''}`} width={size} height={(size * 2) / 3} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" preserveAspectRatio="none">
      {FLAGS[c]}
      <rect width={W} height={H} fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth={0.8} />
    </svg>
  );
}

/** Bandera dentro de un SVG (mapa). x, y = esquina superior izquierda; w = ancho en unidades del mapa. */
export function FlagSvg({ c, x, y, w }: { c: CountryId; x: number; y: number; w: number }) {
  const s = w / W;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {FLAGS[c]}
      <rect width={W} height={H} fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth={1} />
    </g>
  );
}
