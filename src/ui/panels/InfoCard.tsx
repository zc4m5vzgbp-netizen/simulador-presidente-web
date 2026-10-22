/**
 * Fichas reutilizables del panel contextual (ATLAS-001).
 *
 * `InfoCard` es la carcasa común (cabecera con tipo, título, metadatos y cierre)
 * para estados, aeropuertos, puertos y, en el futuro, bases militares,
 * formaciones o composición de unidades. `Fact` es una fila etiqueta–valor.
 * Solo presentación: los datos los decide quien las usa.
 */
import type { ReactNode } from 'react';
import { Icon, type IconName } from '../icons';

export function InfoCard({ kind, kicker, icon, title, meta, onClose, closeLabel = 'Quitar selección', children }: {
  /** Clase de la ficha (state-card, facility-card…), útil para estilos y pruebas. */
  kind: string;
  kicker: string;
  icon: IconName;
  title: ReactNode;
  meta?: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  children?: ReactNode;
}) {
  return (
    <section className={`card geo-card info-card ${kind}`} aria-label={`${kicker}: ${typeof title === 'string' ? title : ''}`}>
      <header className="card-head small">
        <h3><Icon name={icon} size={15} /> {kicker}</h3>
        {onClose && (
          <button type="button" className="icon-btn ghost-btn" aria-label={closeLabel} onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        )}
      </header>
      <div className="card-body">
        <div className="ic-head">
          <h2 className="ic-name">{title}</h2>
          {meta && <div className="ic-meta">{meta}</div>}
        </div>
        {children}
      </div>
    </section>
  );
}

export function Fact({ label, value, children, muted }: { label: string; value?: ReactNode; children?: ReactNode; muted?: boolean }) {
  return (
    <div className={`fact${muted ? ' muted-fact' : ''}`}>
      <span className="fact-label">{label}</span>
      <span className="fact-value">{value}{children}</span>
    </div>
  );
}

/** Lista de enlaces dentro de una ficha (ciudades, instalaciones…). */
export function LinkList({ items }: { items: { key: string; icon?: IconName; label: ReactNode; hint?: ReactNode; onClick: () => void }[] }) {
  return (
    <ul className="link-list">
      {items.map((it) => (
        <li key={it.key}>
          <button type="button" className="link-row" onClick={it.onClick}>
            {it.icon && <Icon name={it.icon} size={16} />}
            <span className="link-row-label">{it.label}</span>
            {it.hint && <span className="link-row-hint">{it.hint}</span>}
            <Icon name="chevronRight" size={13} />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Nota sobre la fuente o los límites de los datos. */
export function SourceNote({ children }: { children: ReactNode }) {
  return <p className="source-note"><Icon name="info" size={13} /> <span>{children}</span></p>;
}
