/** Iconografía de línea coherente (24×24, trazo 1,7). Sin emojis ni fuentes de iconos externas. */
import type { ReactNode } from 'react';

const PATHS: Record<string, ReactNode> = {
  city: <><path d="M3 20.5h18M5 20.5V10l4-2.5v13M9 20.5V4.5h6.5v16M15.5 20.5v-9H19v9" /><path d="M11.5 8h1.5M11.5 11.5h1.5M11.5 15h1.5" /></>,
  crossing: <><path d="M5 21V4M3 21h4" /><path d="M5 7.5h15.5v3.5H5" /><path d="M9 7.5 11 11M13.5 7.5l2 3.5M18 7.5l2 3.5" /></>,
  ferry: <><path d="M2.5 18c1.6 1.3 3.2 1.3 4.8 0s3.2-1.3 4.8 0 3.2 1.3 4.8 0 3.2-1.3 4.8 0" /><path d="M5 15l1.2-5h11.6L19 15M9 10V6.5h6V10" /></>,
  road: <><path d="M8.5 3 5 21M15.5 3 19 21" /><path d="M12 4.5v2.5M12 10.5V13M12 16.5V19" /></>,
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
  gdp: <><path d="M7 21h10a3 3 0 0 0 3-3c0-4.5-3.5-8-5.5-9.5L16 5H8l1.5 3.5C7.5 10 4 13.5 4 18a3 3 0 0 0 3 3z" /><path d="M12 11.5v6M10 13.2c0-.9.9-1.5 2-1.5s2 .6 2 1.5-1 1.3-2 1.5-2 .6-2 1.5.9 1.5 2 1.5 2-.6 2-1.5" /></>,
  reserves: <><rect x="3.5" y="4.5" width="17" height="15" rx="1.5" /><circle cx="12" cy="12" r="3.5" /><path d="M12 8.5v1.2M12 14.3v1.2M15.5 12h-1.2M9.7 12H8.5M6 19.5v1.5M18 19.5v1.5" /></>,
  population: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" /><circle cx="17" cy="9" r="2.3" /><path d="M15.5 14.3c.5-.2 1-.3 1.5-.3 2.3 0 4 1.6 4 4" /></>,
  stability: <><path d="M12 4v16M5 20h14M6 8h12" /><path d="M6 8 3.5 14h5zM18 8l-2.5 6h5z" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="1.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /><path d="M7.5 13.5h2M11 13.5h2M14.5 13.5h2M7.5 17h2M11 17h2" /></>,
  mail: <><rect x="3" y="5.5" width="18" height="13" rx="1.5" /><path d="m3.5 6.5 8.5 6.5 8.5-6.5" /></>,
  soldier: <><circle cx="12" cy="5.5" r="2.3" /><path d="M8.5 10.5h7l-1 5h-1.5l-.5 6h-2l-.5-6h-1.5z" /><path d="M15.5 10.5l3 -2.5" /></>,
  lock: <><rect x="5.5" y="10.5" width="13" height="10" rx="1.5" /><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" /></>,
  user: <><circle cx="12" cy="8.5" r="4" /><path d="M4.5 21c0-4.2 3.4-7 7.5-7s7.5 2.8 7.5 7" /></>,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.6 2.6 2.6 14.4 0 17M12 3.5c-2.6 2.6-2.6 14.4 0 17" /></>,
  handshake: <><path d="M2.5 9.5 6 6l3.5 1.5L12 6.5l3 1L18 6l3.5 3.5" /><path d="M2.5 9.5 7 15l2 1.5 1.5-1 1.5 1.5 1.5-1 1.5 1 1.5-1.5L21.5 9.5" /><path d="m9.5 7.5-2.5 3 1.5 1.5 3.5-3 4 3.5" /></>,
  tank: <><rect x="3" y="12.5" width="18" height="6" rx="3" /><path d="M6 12.5V10h9l2 2.5M11 10V8h9" /><circle cx="7" cy="15.5" r="1" /><circle cx="12" cy="15.5" r="1" /><circle cx="17" cy="15.5" r="1" /></>,
  chevronUp: <path d="m5 15 7-7 7 7" />,
  chevronDown: <path d="m5 9 7 7 7-7" />,
  up: <path d="M12 19V5M6 11l6-6 6 6" />,
  down: <path d="M12 5v14M6 13l6 6 6-6" />,
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
