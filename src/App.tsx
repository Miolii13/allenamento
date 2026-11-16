import { Dumbbell, Footprints, Settings, Utensils } from 'lucide-react';
import { Link, useRoute } from './router';
import { useSyncStatus } from './sync/controller';
import { GymHome } from './pages/gym/GymHome';
import { TemplateEditor } from './pages/gym/TemplateEditor';
import { WorkoutPage } from './pages/gym/WorkoutPage';
import { HistoryList } from './pages/gym/HistoryList';
import { WorkoutDetail } from './pages/gym/WorkoutDetail';
import { ExerciseList } from './pages/gym/ExerciseList';
import { ExerciseDetail } from './pages/gym/ExerciseDetail';
import { StatsPage } from './pages/gym/StatsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ComingSoon } from './pages/ComingSoon';
import { RestTimerBar } from './components/RestTimer';

const NAV = [
  { to: '/pesi', label: 'Pesi', icon: Dumbbell },
  { to: '/corsa', label: 'Corsa', icon: Footprints, soon: true },
  { to: '/alimentazione', label: 'Cibo', icon: Utensils, soon: true },
  { to: '/impostazioni', label: 'Impostazioni', icon: Settings },
];

function Screen({ parts, fresh }: { parts: string[]; fresh: boolean }) {
  const [section, sub, id] = parts;
  if (section === 'corsa')
    return (
      <ComingSoon
        icon={<Footprints size={28} />}
        title="Corsa"
        text="Qui registrerai le uscite: distanza, tempo e passo, confrontati con i tuoi ritmi obiettivo."
      />
    );
  if (section === 'alimentazione')
    return <ComingSoon icon={<Utensils size={28} />} title="Alimentazione" text="Qui arriverà il diario dell'alimentazione." />;
  if (section === 'impostazioni') return <SettingsPage />;

  // sala pesi
  if (sub === 'scheda' && id) return <TemplateEditor key={id} id={id} />;
  if (sub === 'workout' && id) return <WorkoutPage key={id} id={id} />;
  if (sub === 'storico' && id) return <WorkoutDetail key={id} id={id} fresh={fresh} />;
  if (sub === 'storico') return <HistoryList />;
  if (sub === 'statistiche') return <StatsPage />;
  if (sub === 'esercizi' && id) return <ExerciseDetail key={id} id={id} />;
  if (sub === 'esercizi') return <ExerciseList />;
  return <GymHome />;
}

export function App() {
  const { parts, query } = useRoute();
  const sync = useSyncStatus();
  const section = parts[0] ?? 'pesi';

  return (
    <div className="app">
      <main>
        <Screen parts={parts.length ? parts : ['pesi']} fresh={query.get('fine') === '1'} />
      </main>
      <RestTimerBar />
      <nav className="bottom-nav" aria-label="Sezioni">
        {NAV.map(({ to, label, icon: Icon, soon }) => {
          const on = `/${section}` === to;
          return (
            <Link
              key={to}
              to={to}
              className={[on ? 'active' : '', soon ? 'soon' : ''].join(' ').trim() || undefined}
              aria-current={on ? 'page' : undefined}
            >
              <span className="nav-ico">
                <Icon size={22} strokeWidth={on ? 2.4 : 2} />
              </span>
              <span>{label}</span>
              {to === '/impostazioni' && sync.state === 'error' && <i className="nav-dot" title="Sincronizzazione non riuscita" />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
