import type { ReactNode } from 'react';
import { Link, useRoute } from './router';
import { useActiveWorkout } from './db/repo';
import { useSyncStatus } from './sync/controller';
import { GymHome } from './pages/gym/GymHome';
import { TemplateEditor } from './pages/gym/TemplateEditor';
import { WorkoutPage } from './pages/gym/WorkoutPage';
import { HistoryList } from './pages/gym/HistoryList';
import { WorkoutDetail } from './pages/gym/WorkoutDetail';
import { ExerciseList } from './pages/gym/ExerciseList';
import { ExerciseDetail } from './pages/gym/ExerciseDetail';
import { SettingsPage } from './pages/SettingsPage';
import { ComingSoon } from './pages/ComingSoon';

const icon = (path: ReactNode) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {path}
  </svg>
);

const NAV = [
  {
    to: '/pesi',
    label: 'Pesi',
    icon: icon(
      <>
        <path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12" />
      </>,
    ),
  },
  {
    to: '/corsa',
    label: 'Corsa',
    icon: icon(
      <>
        <circle cx="14" cy="4.5" r="1.5" />
        <path d="M8 21l3-6 3 2v4M7 12l3-4 4 1 3 3h3M10 8l-1 5" />
      </>,
    ),
  },
  {
    to: '/alimentazione',
    label: 'Alimentazione',
    icon: icon(
      <>
        <path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2 1-3 4-3 8h3" />
      </>,
    ),
  },
  {
    to: '/impostazioni',
    label: 'Impostazioni',
    icon: icon(
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </>,
    ),
  },
];

function Screen({ parts, fresh }: { parts: string[]; fresh: boolean }) {
  const [section, sub, id] = parts;
  if (section === 'corsa')
    return <ComingSoon title="Corsa" text="Qui arriverà il log delle uscite: distanza, tempo, passo e confronto con i ritmi obiettivo." />;
  if (section === 'alimentazione')
    return <ComingSoon title="Alimentazione" text="Qui arriverà il diario dell'alimentazione." />;
  if (section === 'impostazioni') return <SettingsPage />;

  // sala pesi
  if (sub === 'scheda' && id) return <TemplateEditor key={id} id={id} />;
  if (sub === 'workout' && id) return <WorkoutPage key={id} id={id} />;
  if (sub === 'storico' && id) return <WorkoutDetail key={id} id={id} fresh={fresh} />;
  if (sub === 'storico') return <HistoryList />;
  if (sub === 'esercizi' && id) return <ExerciseDetail key={id} id={id} />;
  if (sub === 'esercizi') return <ExerciseList />;
  return <GymHome />;
}

export function App() {
  const { parts, query } = useRoute();
  const active = useActiveWorkout();
  const sync = useSyncStatus();
  const section = parts[0] ?? 'pesi';
  // la pillola "Riprendi" serve fuori dalla schermata del workout e dalla home schede (che ha già il suo banner)
  const hidePill = parts[1] === 'workout' || (section === 'pesi' && parts.length <= 1);

  return (
    <div className="app">
      <main>
        <Screen parts={parts.length ? parts : ['pesi']} fresh={query.get('fine') === '1'} />
      </main>
      {active && !hidePill && (
        <Link to={`/pesi/workout/${active.id}`} className="resume-pill">
          Allenamento in corso · Riprendi
        </Link>
      )}
      <nav className="bottom-nav" aria-label="Sezioni">
        {NAV.map((n) => {
          const on = `/${section}` === n.to;
          return (
            <Link key={n.to} to={n.to} className={on ? 'active' : undefined} aria-current={on ? 'page' : undefined}>
              {n.icon}
              <span>{n.label}</span>
              {n.to === '/impostazioni' && sync.state === 'error' && <i className="nav-dot" title="Sincronizzazione non riuscita" />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
