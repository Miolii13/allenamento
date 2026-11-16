import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
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
    <Sheet title={draft ? 'Nuovo esercizio' : 'Scegli esercizio'} onClose={onClose}>
      {draft ? (
        <>
          <ExerciseFields value={draft} onChange={setDraft} />
          <div className="row gap end">
            <button className="btn ghost" onClick={() => setDraft(null)}>
              Indietro
            </button>
            <button className="btn primary" disabled={!draft.name.trim()} onClick={create}>
              Crea e aggiungi
            </button>
          </div>
        </>
      ) : (
        <>
          <input
            className="search"
            autoFocus
            placeholder="Cerca esercizio…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="pick-list">
            {filtered.map((e) => (
              <li key={e.id}>
                <button onClick={() => onPick(e.id)}>
                  <span>{e.name}</span>
                  <ExerciseTags exercise={e} />
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="muted pad">Nessun esercizio trovato.</li>}
          </ul>
          <button
            className="btn block"
            onClick={() => setDraft({ name: query.trim(), loadType: 'standard', equipmentId: undefined, notes: undefined })}
          >
            + Crea nuovo esercizio{query.trim() ? ` «${query.trim()}»` : ''}
          </button>
        </>
      )}
    </Sheet>
  );
}
