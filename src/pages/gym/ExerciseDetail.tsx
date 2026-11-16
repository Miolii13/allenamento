import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid } from '../../db/db';
import { useSettings } from '../../db/repo';
import { ExerciseFields, type ExerciseDraft } from '../../components/ExerciseFields';
import { ExerciseTags } from '../../components/ExerciseTags';
import { ProgressChart, type ChartPoint } from '../../components/ProgressChart';
import { Link, navigate } from '../../router';
import { fmtDate, fmtNum } from '../../lib/format';
import { bestE1RM, entryVolume, equipmentOf, isLogged, setText, variantOf } from '../../lib/progress';

export function ExerciseDetail({ id }: { id: string }) {
  const isNew = id === 'nuovo';
  const exercise = useLiveQuery(async () => (isNew ? null : ((await db.exercises.get(id)) ?? null)), [id, isNew]);
  const sessions = useLiveQuery(
    async () =>
      isNew
        ? []
        : (
            await db.workouts
              .where('exerciseIds')
              .equals(id)
              .filter((w) => w.status === 'done')
              .sortBy('startedAt')
          ).reverse(),
    [id, isNew],
  );
  const settings = useSettings();
  const [draft, setDraft] = useState<ExerciseDraft | null>(null);
  const [editing, setEditing] = useState(isNew);

  useEffect(() => {
    if (isNew) setDraft({ name: '', loadType: 'standard', equipmentId: undefined, notes: undefined });
    else if (exercise)
      setDraft({ name: exercise.name, loadType: exercise.loadType, equipmentId: exercise.equipmentId, notes: exercise.notes });
  }, [exercise, isNew]);

  if (exercise === undefined || !draft) return <p className="page muted">Caricamento…</p>;
  if (exercise === null && !isNew) return <p className="page">Esercizio non trovato.</p>;

  async function save() {
    if (!draft?.name.trim()) return;
    if (isNew) {
      const newId = uid();
      await db.exercises.add({ id: newId, ...draft, name: draft.name.trim(), createdAt: Date.now() });
      navigate(`/pesi/esercizi/${newId}`, { replace: true });
    } else {
      await db.exercises.update(id, { ...draft, name: draft.name.trim() });
      setEditing(false);
    }
  }

  const form = (
    <section className="card">
      <ExerciseFields value={draft} onChange={setDraft} />
      <div className="row gap end">
        {!isNew && (
          <button
            className="btn ghost"
            onClick={() => db.exercises.update(id, { archived: !exercise?.archived }).then(() => setEditing(false))}
          >
            {exercise?.archived ? 'Ripristina' : 'Archivia'}
          </button>
        )}
        <span className="grow" />
        <button className="btn ghost" onClick={() => (isNew ? navigate('/pesi/esercizi') : setEditing(false))}>
          Annulla
        </button>
        <button className="btn primary" disabled={!draft.name.trim()} onClick={save}>
          Salva
        </button>
      </div>
    </section>
  );

  if (isNew || !exercise) {
    return (
      <div className="page">
        <header className="page-head">
          <Link to="/pesi/esercizi" className="back">
            ‹ Esercizi
          </Link>
          <h1>Nuovo esercizio</h1>
        </header>
        {form}
      </div>
    );
  }

  const group = equipmentOf(settings, exercise);
  const bodyweight = exercise.loadType === 'bodyweight';

  const rows = (sessions ?? []).flatMap((w) =>
    w.entries
      .filter((e) => e.exerciseId === id && e.sets.some(isLogged))
      .map((e) => ({
        w,
        e,
        variant: variantOf(group, e.variantId),
        e1rm: bestE1RM(e, group),
        volume: entryVolume(e, exercise, group),
      })),
  );

  const points: ChartPoint[] = rows
    .map((r) => ({
      ts: r.w.startedAt,
      value: bodyweight ? r.volume : (r.e1rm ?? 0),
      detail: r.variant?.name,
    }))
    .filter((p) => p.value > 0)
    .reverse();

  const best = bodyweight
    ? Math.max(0, ...rows.flatMap((r) => r.e.sets.filter(isLogged).map((s) => s.reps!)))
    : Math.max(0, ...rows.map((r) => r.e1rm ?? 0));

  return (
    <div className="page">
      <header className="page-head">
        <Link to="/pesi/esercizi" className="back">
          ‹ Esercizi
        </Link>
        <div className="row gap between">
          <h1>{exercise.name}</h1>
          {!editing && (
            <button className="btn ghost small" onClick={() => setEditing(true)}>
              Modifica
            </button>
          )}
        </div>
        <ExerciseTags exercise={exercise} />
        {exercise.notes && <p className="muted">{exercise.notes}</p>}
      </header>

      {editing && form}

      {rows.length > 0 && (
        <section className="card">
          <h3>{bodyweight ? 'Ripetizioni totali per sessione' : '1RM stimato della serie migliore'}</h3>
          {group && <p className="muted small">Carichi riportati su {group.variants[0]?.name} per confrontare le sessioni.</p>}
          <ProgressChart points={points} unit={bodyweight ? 'reps' : 'kg'} />
          <p className="muted small">
            Record: <strong>{fmtNum(Math.round(best * 10) / 10)}</strong> {bodyweight ? 'reps in una serie' : 'kg (1RM stimato)'}
          </p>
        </section>
      )}

      <h3>Sessioni</h3>
      {rows.length === 0 && <p className="empty">Non hai ancora fatto questo esercizio.</p>}
      <ul className="list">
        {rows.map(({ w, e, variant }) => (
          <li key={`${w.id}-${e.id}`}>
            <Link to={`/pesi/storico/${w.id}`} className="list-item column">
              <div className="row between">
                <strong>{fmtDate(w.startedAt)}</strong>
                <span className="muted small">
                  {w.templateName}
                  {variant ? ` · ${variant.name}` : ''}
                </span>
              </div>
              <span className="sets-text">
                {e.sets
                  .filter(isLogged)
                  .map((s) => (s.type === 'drop' ? '↳' : '') + setText(s, bodyweight))
                  .join('  ·  ')}
              </span>
              {e.notes && <span className="muted small">{e.notes}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
