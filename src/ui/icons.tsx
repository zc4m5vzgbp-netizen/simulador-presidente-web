/** Iconografía de línea coherente (24×24, trazo 1,7). Sin emojis ni fuentes de iconos externas. */
import type { ReactNode } from 'react';

const PATHS: Record<string, ReactNode> = {
  map: <><path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z" /><path d="M9 4v13.5M15 6.5V20" /></>,
  economy: <><path d="M4 20V10M10 20V5M16 20v-7M22 20H2" /></>,
  diplomacy: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.6 2.6 2.6 14.4 0 17M12 3.5c-2.6 2.6-2.6 14.4 0 17" /></>,
  army: <><path d="M12 3 4.5 6v5.5c0 4.4 3.1 7.9 7.5 9.5 4.4-1.6 7.5-5.1 7.5-9.5V6z" /><path d="m8.5 12 2.4 2.4L15.8 9.5" /></>,
  government: <><path d="M3 9.5 12 4l9 5.5M5 9.5V18M9.5 9.5V18M14.5 9.5V18M19 9.5V18M3 20.5h18" /></>,
  research: <><path d="M9.5 3.5h5M10.5 3.5v5.2L5 18.5A1.6 1.6 0 0 0 6.4 21h11.2a1.6 1.6 0 0 0 1.4-2.5l-5.5-9.8V3.5" /><path d="M7.6 14h8.8" /></>,
  espionage: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>,
  stats: <><path d="M3 3.5v17h17.5" /><path d="m7 15 4-4.5 3 2.5 5.5-6.5" /></>,
  options: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  target: <><circle cx="12" cy="12" r="7.5" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
  layers: <><path d="m12 3.5 9 4.5-9 4.5-9-4.5z" /><path d="m3 12 9 4.5 9-4.5M3 16l9 4.5 9-4.5" /></>,
  chevronRight: <path d="m9 5 7 7-7 7" />,
  chevronLeft: <path d="m15 5-7 7 7 7" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  move: <><path d="M4 12h14M13 6.5l5.5 5.5-5.5 5.5" /></>,
  stop: <rect x="6" y="6" width="12" height="12" rx="1.5" />,
  rotate: <><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M20.5 15.5a8.5 8.5 0 0 1-4 4.3M3.5 8.5a8.5 8.5 0 0 1 4-4.3" /></>,
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={`icon${className ? ` ${className}` : ''}`} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
