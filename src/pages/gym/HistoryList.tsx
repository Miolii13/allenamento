import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useExerciseMap, useSettings } from '../../db/repo';
import type { Workout } from '../../db/types';
import { Link } from '../../router';
import { fmtDate, fmtDuration, fmtMonth, fmtNum } from '../../lib/format';
import { entryVolume, equipmentOf, isLogged } from '../../lib/progress';
import { GymTabs } from './GymTabs';

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
      <GymTabs active="/pesi/storico" />
      {workouts?.length === 0 && (
        <p className="empty">Ancora nessun allenamento. Avvia un workout da una scheda e lo ritrovi qui.</p>
      )}
      {groups.map((g) => (
        <section key={g.month}>
          <h3 className="month">{g.month}</h3>
          <ul className="list">
            {g.items.map((w) => {
              const sets = w.entries.reduce((n, e) => n + e.sets.filter(isLogged).length, 0);
              const volume = w.entries.reduce((v, e) => {
                const ex = exMap?.get(e.exerciseId);
                return ex?.loadType === 'bodyweight' ? v : v + entryVolume(e, ex, equipmentOf(settings, ex));
              }, 0);
              return (
                <li key={w.id}>
                  <Link to={`/pesi/storico/${w.id}`} className="list-item">
                    <div>
                      <strong>{w.templateName}</strong>
                      <span className="muted">{fmtDate(w.startedAt)}</span>
                    </div>
                    <div className="right muted small">
                      <span>
                        {w.entries.length} esercizi · {sets} serie
                      </span>
                      <span>
                        {w.finishedAt ? fmtDuration(w.finishedAt - w.startedAt) : ''}
                        {volume > 0 ? ` · ${fmtNum(Math.round(volume))} kg` : ''}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
