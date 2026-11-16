import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, History } from 'lucide-react';
import { db } from '../../db/db';
import { useExerciseMap, useSettings } from '../../db/repo';
import type { Workout } from '../../db/types';
import { Link } from '../../router';
import { fmtDate, fmtDuration, fmtMonth, fmtNum } from '../../lib/format';
import { entryVolume, equipmentOf, isLogged } from '../../lib/progress';
import { EmptyState, PageHeader } from '../../components/PageHeader';
import { GymTabs } from './GymTabs';
import { initials } from './GymHome';

export function HistoryList() {
  const workouts = useLiveQuery(async () => (await db.workouts.where('status').equals('done').sortBy('startedAt')).reverse());
  const exMap = useExerciseMap();
  const settings = useSettings();

  const groups: { month: string; items: Workout[] }[] = [];
  for (const w of workouts ?? []) {
    const month = fmtMonth(w.startedAt);
    if (groups[groups.length - 1]?.month !== month) groups.push({ month, items: [] });
    groups[groups.length - 1].items.push(w);
  }

  return (
    <div className="page">
      <PageHeader
        title="Storico"
        subtitle={workouts ? `${workouts.length} ${workouts.length === 1 ? 'allenamento' : 'allenamenti'}` : undefined}
      />
      <GymTabs active="/pesi/storico" />

      {workouts?.length === 0 && (
        <div className="card">
          <EmptyState
            icon={<History size={26} />}
            title="Ancora nessun allenamento"
            text="Quando termini un allenamento lo ritrovi qui, con il confronto sulla volta prima."
          />
        </div>
      )}

      {groups.map((g) => (
        <section key={g.month} className="section">
          <div className="month-label">{g.month}</div>
          <div className="card flush">
            {g.items.map((w) => {
              const sets = w.entries.reduce((n, e) => n + e.sets.filter(isLogged).length, 0);
              const volume = w.entries.reduce((v, e) => {
                const ex = exMap?.get(e.exerciseId);
                return ex?.loadType === 'bodyweight' ? v : v + entryVolume(e, ex, equipmentOf(settings, ex));
              }, 0);
              return (
                <Link key={w.id} to={`/pesi/storico/${w.id}`} className="list-row">
                  <span className="tile-icon">{initials(w.templateName)}</span>
                  <span className="lr-body">
                    <span className="lr-title">{w.templateName}</span>
                    <span className="lr-sub">{fmtDate(w.startedAt)}</span>
                  </span>
                  <span className="lr-trail stack-s" style={{ alignItems: 'flex-end', gap: 0 }}>
                    <span className="tnum">
                      {w.finishedAt ? fmtDuration(w.finishedAt - w.startedAt) : ''} · {sets} serie
                    </span>
                    {volume > 0 && <span className="tnum">{fmtNum(Math.round(volume))} kg</span>}
                  </span>
                  <ChevronRight size={18} className="chev" />
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
