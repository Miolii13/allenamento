import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Link } from '../../router';
import { daysAgo } from '../../lib/format';
import { ExerciseTags } from '../../components/ExerciseTags';
import { GymTabs } from './GymTabs';

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export function ExerciseList() {
  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray());
  const stats = useLiveQuery(async () => {
    const map = new Map<string, { count: number; last: number }>();
    await db.workouts
      .where('status')
      .equals('done')
      .each((w) => {
        for (const id of w.exerciseIds) {
          const s = map.get(id) ?? { count: 0, last: 0 };
          s.count++;
          s.last = Math.max(s.last, w.startedAt);
          map.set(id, s);
        }
      });
    return map;
  });
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const filtered = useMemo(() => {
    const q = norm(query.trim());
    return (exercises ?? []).filter((e) => !!e.archived === showArchived && (!q || norm(e.name).includes(q)));
  }, [exercises, query, showArchived]);

  return (
    <div className="page">
      <GymTabs active="/pesi/esercizi" />
      <div className="row gap">
        <input className="search grow" placeholder="Cerca esercizio…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Link to="/pesi/esercizi/nuovo" className="btn">
          + Nuovo
        </Link>
      </div>
      <ul className="list">
        {filtered.map((e) => {
          const s = stats?.get(e.id);
          return (
            <li key={e.id}>
              <Link to={`/pesi/esercizi/${e.id}`} className="list-item">
                <div>
                  <strong>{e.name}</strong>
                  <ExerciseTags exercise={e} />
                </div>
                <div className="right muted small">
                  {s ? (
                    <>
                      <span>{s.count} sessioni</span>
                      <span>{daysAgo(s.last)}</span>
                    </>
                  ) : (
                    <span>mai fatto</span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
        {filtered.length === 0 && <li className="muted pad">Nessun esercizio.</li>}
      </ul>
      <button className="btn ghost small" onClick={() => setShowArchived((v) => !v)}>
        {showArchived ? 'Mostra esercizi attivi' : 'Mostra esercizi archiviati'}
      </button>
    </div>
  );
}
