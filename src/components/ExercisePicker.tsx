import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Search } from 'lucide-react';
import { db, uid } from '../db/db';
import { Sheet } from './Sheet';
import { ExerciseFields, type ExerciseDraft } from './ExerciseFields';
import { ExerciseTags } from './ExerciseTags';

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Scegli un esercizio dalla libreria oppure creane uno nuovo al volo. */
export function ExercisePicker({ onPick, onClose }: { onPick: (exerciseId: string) => void; onClose: () => void }) {
  const exercises = useLiveQuery(() => db.exercises.orderBy('name').filter((e) => !e.archived).toArray());
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<ExerciseDraft | null>(null);

  const filtered = useMemo(() => {
    const q = norm(query.trim());
    return (exercises ?? []).filter((e) => !q || norm(e.name).includes(q));
  }, [exercises, query]);

  async function create() {
    if (!draft?.name.trim()) return;
    const id = uid();
    await db.exercises.add({ id, ...draft, name: draft.name.trim(), createdAt: Date.now() });
    onPick(id);
  }

  return (
    <Sheet title={draft ? 'Nuovo esercizio' : 'Aggiungi esercizio'} onClose={onClose}>
      {draft ? (
        <>
          <ExerciseFields value={draft} onChange={setDraft} />
          <div className="row end">
            <button className="btn" onClick={() => setDraft(null)}>
              Indietro
            </button>
            <button className="btn btn-primary" disabled={!draft.name.trim()} onClick={create}>
              Crea e aggiungi
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="search-box">
            <Search size={18} />
            <input autoFocus placeholder="Cerca esercizio" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <button
            className="btn btn-block"
            onClick={() => setDraft({ name: query.trim(), loadType: 'standard', equipmentId: undefined, notes: undefined })}
          >
            <Plus size={18} /> Crea nuovo esercizio{query.trim() ? ` «${query.trim()}»` : ''}
          </button>
          <div className="pick-list">
            {filtered.map((e) => (
              <button key={e.id} onClick={() => onPick(e.id)}>
                <span>{e.name}</span>
                <ExerciseTags exercise={e} />
              </button>
            ))}
            {filtered.length === 0 && <p className="muted small">Nessun esercizio trovato.</p>}
          </div>
        </>
      )}
    </Sheet>
  );
}
