import type { SectionId } from '../layout/NavRail';

const PLANNED: Partial<Record<SectionId, { title: string; scope: string[] }>> = {
  government: {
    title: 'Gobierno',
    scope: ['Ministerios y su presupuesto', 'Leyes y decretos', 'Apoyo parlamentario y opinión pública'],
  },
  research: {
    title: 'Investigación',
    scope: ['Árbol de tecnologías civiles y militares', 'Inversión en ciencia', 'Efectos sobre economía y ejército'],
  },
  espionage: {
    title: 'Espionaje',
    scope: ['Agencias de inteligencia', 'Información sobre otros países', 'Operaciones encubiertas y contraespionaje'],
  },
};

/** Sección prevista pero sin funcionalidad todavía: lo indica sin simular nada. */
export function FuturePanel({ section }: { section: SectionId }) {
  const p = PLANNED[section];
  if (!p) return null;
  return (
    <div className="panel-body future-panel" data-future={section}>
      <span className="chip">En desarrollo</span>
      <p>La sección <strong>{p.title}</strong> no está disponible en la Beta 1.0. No afecta todavía a la partida.</p>
      <div>
        <p className="muted small-text">Alcance previsto:</p>
        <ul className="future-list">{p.scope.map((s) => <li key={s}>{s}</li>)}</ul>
      </div>
    </div>
  );
}
