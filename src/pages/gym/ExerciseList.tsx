import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, Plus, Search } from 'lucide-react';
import { db } from '../../db/db';
import { Link } from '../../router';
import { daysAgo } from '../../lib/format';
import { ExerciseTags } from '../../components/ExerciseTags';
import { PageHeader } from '../../components/PageHeader';
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
      <PageHeader
        title="Esercizi"
        action={
          <Link to="/pesi/esercizi/nuovo" className="btn btn-primary btn-sm">
            <Plus size={16} /> Nuovo
          </Link>
        }
      />
      <GymTabs active="/pesi/esercizi" />
      <div className="search-box">
        <Search size={18} />
        <input placeholder="Cerca esercizio" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="card flush">
        {filtered.map((e) => {
          const s = stats?.get(e.id);
          return (
            <Link key={e.id} to={`/pesi/esercizi/${e.id}`} className="list-row">
              <span className="lr-body">
                <span className="lr-title">{e.name}</span>
                <span className="lr-sub">{s ? `${s.count} ${s.count === 1 ? 'sessione' : 'sessioni'} · ${daysAgo(s.last)}` : 'Mai fatto'}</span>
                <ExerciseTags exercise={e} />
              </span>
              <ChevronRight size={18} className="chev" />
            </Link>
          );
        })}
        {filtered.length === 0 && <p className="muted small" style={{ padding: 16 }}>Nessun esercizio trovato.</p>}
      </div>
      <button className="btn btn-ghost btn-sm" onClick={() => setShowArchived((v) => !v)}>
        {showArchived ? 'Mostra esercizi attivi' : 'Mostra esercizi archiviati'}
      </button>
    </div>
  );
}
