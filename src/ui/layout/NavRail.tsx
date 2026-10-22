import { Icon, type IconName } from '../icons';

export type SectionId = 'map' | 'economy' | 'diplomacy' | 'army' | 'government' | 'research' | 'espionage' | 'stats' | 'game';

export interface SectionDef {
  id: SectionId;
  label: string;
  short: string;
  icon: IconName;
  /** false = sección prevista pero aún sin funcionalidad (se muestra con candado). */
  available: boolean;
}

export const SECTIONS: SectionDef[] = [
  { id: 'map', label: 'Mapa', short: 'Mapa', icon: 'globe', available: true },
  { id: 'economy', label: 'Economía', short: 'Economía', icon: 'economy', available: true },
  { id: 'diplomacy', label: 'Diplomacia', short: 'Diplom.', icon: 'handshake', available: true },
  { id: 'army', label: 'Ejército', short: 'Ejército', icon: 'tank', available: true },
  { id: 'research', label: 'Investigación', short: 'Investig.', icon: 'research', available: false },
  { id: 'government', label: 'Gobierno', short: 'Gobierno', icon: 'government', available: false },
  { id: 'espionage', label: 'Espionaje', short: 'Espionaje', icon: 'espionage', available: false },
  { id: 'stats', label: 'Estadísticas', short: 'Estadíst.', icon: 'stats', available: true },
];

export function NavRail({ active, onSelect, badges }: { active: SectionId; onSelect: (id: SectionId) => void; badges: Partial<Record<SectionId, number>> }) {
  return (
    <nav className="rail" aria-label="Secciones">
      {SECTIONS.map((s) => (
        <button key={s.id} type="button" className={`rail-btn${active === s.id ? ' on' : ''}${s.available ? '' : ' future'}`}
          data-tab={s.id} aria-current={active === s.id ? 'page' : undefined}
          aria-label={s.available ? s.label : `${s.label} (en desarrollo)`} onClick={() => onSelect(s.id)}>
          <Icon name={s.icon} size={22} />
          <span className="rail-label">{s.label}</span>
          <span className="rail-short" aria-hidden="true">{s.short}</span>
          {!s.available && <Icon name="lock" size={14} className="rail-lock" />}
          {!!badges[s.id] && <span className="badge">{badges[s.id]}</span>}
        </button>
      ))}
    </nav>
  );
}
