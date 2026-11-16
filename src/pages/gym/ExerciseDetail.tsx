import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, Dumbbell, Pencil } from 'lucide-react';
import { db, uid } from '../../db/db';
import { useSettings } from '../../db/repo';
import { ExerciseFields, type ExerciseDraft } from '../../components/ExerciseFields';
import { ExerciseTags } from '../../components/ExerciseTags';
import { ProgressChart, type ChartPoint } from '../../components/ProgressChart';
import { EmptyState, PageHeader } from '../../components/PageHeader';
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
      <div className="row">
        {!isNew && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => db.exercises.update(id, { archived: !exercise?.archived }).then(() => setEditing(false))}
          >
            {exercise?.archived ? 'Ripristina' : 'Archivia'}
          </button>
        )}
        <span className="grow" />
        <button className="btn btn-sm" onClick={() => (isNew ? navigate('/pesi/esercizi') : setEditing(false))}>
          Annulla
        </button>
        <button className="btn btn-primary btn-sm" disabled={!draft.name.trim()} onClick={save}>
          Salva
        </button>
      </div>
    </section>
  );

  if (isNew || !exercise) {
    return (
      <div className="page">
        <PageHeader title="Nuovo esercizio" back={{ to: '/pesi/esercizi', label: 'Esercizi' }} />
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
    .map((r) => ({ ts: r.w.startedAt, value: bodyweight ? r.volume : (r.e1rm ?? 0), detail: r.variant?.name }))
    .filter((p) => p.value > 0)
    .reverse();

  const best = bodyweight
    ? Math.max(0, ...rows.flatMap((r) => r.e.sets.filter(isLogged).map((s) => s.reps!)))
    : Math.max(0, ...rows.map((r) => r.e1rm ?? 0));

  return (
    <div className="page">
      <PageHeader
        title={exercise.name}
        back={{ to: '/pesi/esercizi', label: 'Esercizi' }}
        action={
          !editing && (
            <button className="icon-btn filled" onClick={() => setEditing(true)} aria-label="Modifica esercizio">
              <Pencil size={18} />
            </button>
          )
        }
        subtitle={exercise.notes}
      />
      <ExerciseTags exercise={exercise} />

      {editing && form}

      {rows.length > 0 && (
        <>
          <div className="stats-grid">
            <div className="stat">
              <b>{rows.length}</b>
              <span>{rows.length === 1 ? 'sessione' : 'sessioni'}</span>
            </div>
            <div className="stat">
              <b>{fmtNum(Math.round(best * 10) / 10)}</b>
              <span>{bodyweight ? 'reps record' : 'kg 1RM stimato'}</span>
            </div>
          </div>
          <section className="card">
            <h3>{bodyweight ? 'Ripetizioni totali per sessione' : '1RM stimato della serie migliore'}</h3>
            {group && <p className="muted small">Carichi riportati su {group.variants[0]?.name} per confrontare le sessioni.</p>}
            <ProgressChart points={points} unit={bodyweight ? 'reps' : 'kg'} />
          </section>
        </>
      )}

      <section className="section">
        <div className="section-title">
          <h2>Sessioni</h2>
        </div>
        {rows.length === 0 ? (
          <div className="card">
            <EmptyState icon={<Dumbbell size={26} />} title="Ancora nessuna sessione" text="Le serie che registri compariranno qui." />
          </div>
        ) : (
          <div className="card flush">
            {rows.map(({ w, e, variant }) => (
              <Link key={`${w.id}-${e.id}`} to={`/pesi/storico/${w.id}`} className="list-row">
                <span className="lr-body">
                  <span className="lr-title">{fmtDate(w.startedAt)}</span>
                  <span className="tnum strong text-2 small">
                    {e.sets
                      .filter(isLogged)
                      .map((s) => (s.type === 'drop' ? '↳' : '') + setText(s, bodyweight))
                      .join('  ·  ')}
                  </span>
                  <span className="lr-sub">
                    {w.templateName}
                    {variant ? ` · ${variant.name}` : ''}
                    {e.notes ? ` · ${e.notes}` : ''}
                  </span>
                </span>
                <ChevronRight size={18} className="chev" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
