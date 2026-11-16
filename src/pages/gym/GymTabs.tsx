import { Link } from '../../router';

const TABS = [
  { to: '/pesi', label: 'Allenati' },
  { to: '/pesi/storico', label: 'Storico' },
  { to: '/pesi/esercizi', label: 'Esercizi' },
];

export function GymTabs({ active }: { active: string }) {
  return (
    <nav className="segmented" aria-label="Sala pesi">
      {TABS.map((t) => (
        <Link key={t.to} to={t.to} className={active === t.to ? 'active' : undefined} aria-current={active === t.to ? 'page' : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
