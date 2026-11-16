import { useEffect, useMemo, useState } from 'react';
import { db } from '../../db/db';
import {
  cleanWorkout,
  countEmptySets,
  findPrevEntries,
  findPrevEntry,
  finishWorkout,
  newEntry,
  newSet,
  useExerciseMap,
  useSettings,
  withExerciseIds,
  type PrevEntry,
} from '../../db/repo';
import type { EquipmentGroup, Exercise, SetType, Workout, WorkoutEntry, WorkoutSet } from '../../db/types';
import { NumInput } from '../../components/NumInput';
import { ExercisePicker } from '../../components/ExercisePicker';
import { Link, navigate } from '../../router';
import { daysAgo, fmtDateShort, fmtDuration, fmtNum, loadUnit, setLabels, toLocalInput } from '../../lib/format';
import {
  compareSet,
  convertWeight,
  equipmentOf,
  isLogged,
  matchPrevSet,
  setText,
  shouldIncrease,
  variantOf,
  type Trend,
} from '../../lib/progress';

export const TREND_ICON: Record<Trend, string> = { up: '▲', same: '=', down: '▼' };

export function WorkoutPage({ id }: { id: string }) {
  const [w, setW] = useState<Workout | null>();
  const exMap = useExerciseMap();
  const settings = useSettings();
  const [prev, setPrev] = useState<Record<string, PrevEntry | undefined>>({});
  const [picker, setPicker] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    db.workouts.get(id).then((x) => setW(x ?? null));
  }, [id]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // "La volta prima" per ogni esercizio: si ricarica se cambiano gli esercizi o la data.
  const prevKey = w ? `${w.exerciseIds.join('|')}@${w.startedAt}` : '';
  useEffect(() => {
    if (!w) return;
    let alive = true;
    findPrevEntries(w.exerciseIds, w.startedAt, w.id).then((r) => alive && setPrev(r));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prevKey]);

  const supersetLabels = useMemo(() => {
    if (!w) return [];
    return w.entries.map((e, i) => {
      if (!e.superset) return undefined;
      let n = 1;
      for (let j = i - 1; j >= 0 && w.entries[j].superset === e.superset; j--) n++;
      return `${e.superset}${n}`;
    });
  }, [w]);

  if (w === undefined || !exMap) return <p className="page muted">Caricamento…</p>;
  if (w === null)
    return (
      <div className="page">
        <p>Allenamento non trovato.</p>
        <Link to="/pesi">Torna alle schede</Link>
      </div>
    );

  const workout = w;
  const isActive = workout.status === 'active';

  const save = (next: Workout) => {
    const n = withExerciseIds(next);
    setW(n);
    void db.workouts.put(n);
  };
  const updateEntry = (entry: WorkoutEntry) =>
    save({ ...workout, entries: workout.entries.map((e) => (e.id === entry.id ? entry : e)) });
  const moveEntry = (index: number, dir: -1 | 1) => {
    const entries = [...workout.entries];
    const j = index + dir;
    if (j < 0 || j >= entries.length) return;
    [entries[index], entries[j]] = [entries[j], entries[index]];
    save({ ...workout, entries });
  };
  const removeEntry = (entry: WorkoutEntry) => {
    const name = exMap.get(entry.exerciseId)?.name ?? 'esercizio';
    if (!confirm(`Rimuovere ${name} da questo allenamento?`)) return;
    save({ ...workout, entries: workout.entries.filter((e) => e.id !== entry.id) });
  };

  async function addExercise(exerciseId: string) {
    setPicker(false);
    // riprende la struttura di serie dell'ultima volta, se c'è
    const p = await findPrevEntry(exerciseId, workout.startedAt, workout.id);
    const sets = p ? p.entry.sets.map((s) => newSet(s.type, s.target, s.note)) : [newSet('work', ''), newSet('work', '')];
    save({ ...workout, entries: [...workout.entries, newEntry(exerciseId, sets)] });
  }

  async function finish() {
    const empty = countEmptySets(workout);
    const msg =
      empty > 0
        ? `Terminare l'allenamento? ${empty} ${empty === 1 ? 'serie vuota verrà scartata' : 'serie vuote verranno scartate'}.`
        : "Terminare l'allenamento?";
    if (!confirm(msg)) return;
    await finishWorkout(workout);
    navigate(`/pesi/storico/${workout.id}?fine=1`, { replace: true });
  }

  async function discard() {
    if (!confirm("Annullare l'allenamento? Quello che hai segnato verrà perso.")) return;
    await db.workouts.delete(workout.id);
    navigate('/pesi', { replace: true });
  }

  async function doneEditing() {
    await db.workouts.put(cleanWorkout(workout));
    navigate(`/pesi/storico/${workout.id}`, { replace: true });
  }

  return (
    <div className="page workout">
      <header className="workout-bar">
        <div>
          <h1>{workout.templateName}</h1>
          <span className="muted">{isActive ? `In corso · ${fmtDuration(now - workout.startedAt)}` : 'Modifica allenamento'}</span>
        </div>
        {isActive ? (
          <button className="btn primary" onClick={finish}>
            Termina
          </button>
        ) : (
          <button className="btn primary" onClick={doneEditing}>
            Fatto
          </button>
        )}
      </header>

      {!isActive && (
        <label className="field">
          <span>Data e ora</span>
          <input
            type="datetime-local"
            value={toLocalInput(workout.startedAt)}
            onChange={(e) => {
              const ts = new Date(e.target.value).getTime();
              if (Number.isNaN(ts)) return;
              const dur = workout.finishedAt ? workout.finishedAt - workout.startedAt : 0;
              save({ ...workout, startedAt: ts, finishedAt: ts + dur });
            }}
          />
        </label>
      )}

      {workout.entries.length === 0 && <p className="empty">Nessun esercizio. Aggiungine uno qui sotto.</p>}

      {workout.entries.map((entry, i) => {
        const exercise = exMap.get(entry.exerciseId);
        return (
          <EntryCard
            key={entry.id}
            entry={entry}
            exercise={exercise}
            group={equipmentOf(settings, exercise)}
            prev={prev[entry.exerciseId]}
            supersetLabel={supersetLabels[i]}
            isFirst={i === 0}
            isLast={i === workout.entries.length - 1}
            onChange={updateEntry}
            onMove={(dir) => moveEntry(i, dir)}
            onRemove={() => removeEntry(entry)}
          />
        );
      })}

      <button className="btn block" onClick={() => setPicker(true)}>
        + Aggiungi esercizio
      </button>

      <label className="field">
        <span>Note sull'allenamento</span>
        <textarea
          rows={2}
          placeholder="Sensazioni, dolori, energia…"
          value={workout.notes ?? ''}
          onChange={(e) => save({ ...workout, notes: e.target.value || undefined })}
        />
      </label>

      {isActive && (
        <div className="stack">
          <button className="btn primary block big" onClick={finish}>
            Termina allenamento
          </button>
          <button className="btn danger-text block" onClick={discard}>
            Annulla allenamento
          </button>
        </div>
      )}

      {picker && <ExercisePicker onPick={addExercise} onClose={() => setPicker(false)} />}
    </div>
  );
}

interface EntryCardProps {
  entry: WorkoutEntry;
  exercise: Exercise | undefined;
  group: EquipmentGroup | undefined;
  prev: PrevEntry | undefined;
  supersetLabel?: string;
  isFirst: boolean;
  isLast: boolean;
  onChange: (e: WorkoutEntry) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}

function EntryCard({ entry, exercise, group, prev, supersetLabel, isFirst, isLast, onChange, onMove, onRemove }: EntryCardProps) {
  const [tools, setTools] = useState(false);
  const [showNote, setShowNote] = useState(!!entry.notes);
  const variant = variantOf(group, entry.variantId);
  const prevVariant = variantOf(group, prev?.entry.variantId);
  const bodyweight = exercise?.loadType === 'bodyweight';
  const converted = !!variant && !!prevVariant && variant.id !== prevVariant.id;
  const needVariant = !!group && !variant;
  const labels = setLabels(entry.sets);
  const loggedSets = entry.sets.filter(isLogged).length;

  const updateSet = (setId: string, patch: Partial<WorkoutSet>) =>
    onChange({ ...entry, sets: entry.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) });

  /** Valori della volta scorsa per la serie i, convertiti sulla macchina usata oggi. */
  const previousFor = (i: number) => {
    const p = matchPrevSet(entry.sets, i, prev?.entry.sets);
    if (!p || !isLogged(p)) return undefined;
    const weight = p.weight !== undefined ? convertWeight(p.weight, prevVariant, variant) : undefined;
    return { set: p, weight, reps: p.reps! };
  };

  const toggleDone = (s: WorkoutSet, i: number) => {
    if (s.done) return updateSet(s.id, { done: false });
    const p = previousFor(i);
    const weight = s.weight ?? p?.weight;
    const reps = s.reps ?? p?.reps ?? (/^\d+$/.test(s.target.trim()) ? Number(s.target) : undefined);
    if (reps === undefined) {
      document.getElementById(`reps-${s.id}`)?.focus();
      return;
    }
    updateSet(s.id, { done: true, weight, reps });
  };

  const addSet = (type: SetType) => {
    const last = [...entry.sets].reverse().find((s) => s.type === type);
    onChange({ ...entry, sets: [...entry.sets, newSet(type, last?.target ?? '')] });
  };

  return (
    <section className={`card entry${entry.superset ? ' superset' : ''}${loggedSets > 0 && loggedSets === entry.sets.length ? ' complete' : ''}`}>
      <div className="entry-head">
        <div className="entry-title">
          {supersetLabel && <span className="badge">{supersetLabel}</span>}
          <Link to={`/pesi/esercizi/${entry.exerciseId}`} className="entry-name">
            {exercise?.name ?? 'Esercizio eliminato'}
          </Link>
        </div>
        <button className="btn ghost icon" onClick={() => setTools((v) => !v)} aria-label="Altre azioni">
          ⋯
        </button>
      </div>

      {tools && (
        <div className="row gap wrap tools">
          <button className="btn small" disabled={isFirst} onClick={() => onMove(-1)}>
            ↑ Su
          </button>
          <button className="btn small" disabled={isLast} onClick={() => onMove(1)}>
            ↓ Giù
          </button>
          <button className="btn small danger-text" onClick={onRemove}>
            Rimuovi esercizio
          </button>
        </div>
      )}

      {(entry.hint || exercise?.notes) && (
        <p className="entry-hint">{[entry.hint, exercise?.notes].filter(Boolean).join(' · ')}</p>
      )}

      {prev ? (
        <div className="prev-line">
          <span className="muted">
            Ultima volta {fmtDateShort(prev.workout.startedAt)} ({daysAgo(prev.workout.startedAt)})
            {prevVariant ? ` · ${prevVariant.name}` : ''}
          </span>
          <span className="prev-sets">
            {prev.entry.sets
              .filter(isLogged)
              .map((s) => setText(s, bodyweight))
              .join('  ·  ')}
          </span>
        </div>
      ) : (
        <p className="prev-line muted">Prima volta per questo esercizio</p>
      )}

      {shouldIncrease(prev?.entry) && (
        <p className="hint up">↑ L'ultima volta hai chiuso il range in tutte le serie: prova ad aumentare il carico.</p>
      )}

      {group &&
        (needVariant ? (
          <div className="variant-ask">
            <p>{group.question}</p>
            <div className="variant-btns">
              {group.variants.map((v) => (
                <button key={v.id} className="btn big" onClick={() => onChange({ ...entry, variantId: v.id })}>
                  {v.name}
                  {prevVariant?.id === v.id && <small>usata l'ultima volta</small>}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="variant-chosen">
            <span>
              {group.name}: <strong>{variant!.name}</strong>
            </span>
            <button className="link" onClick={() => onChange({ ...entry, variantId: undefined })}>
              cambia
            </button>
          </div>
        ))}

      {converted && (
        <p className="hint">
          L'ultima volta eri su {prevVariant!.name}: nella colonna «Prima» i pesi sono già convertiti su {variant!.name}.
        </p>
      )}

      {!needVariant && (
        <>
          <div className="sets">
            <div className="set-row head">
              <span>Serie</span>
              <span>Prima</span>
              <span>{exercise ? loadUnit(exercise.loadType) : 'Kg'}</span>
              <span>Reps</span>
              <span />
            </div>
            {entry.sets.map((s, i) => {
              const p = previousFor(i);
              const trend = compareSet(s, p?.set, group, variant, prevVariant);
              const prevText = p
                ? converted && p.weight !== undefined
                  ? `≈${fmtNum(p.weight)}×${p.reps}`
                  : setText(p.set, bodyweight)
                : '—';
              return (
                <div key={s.id} className={`set-row ${s.type}${s.done ? ' done' : ''}`}>
                  <span className="set-label">
                    {labels[i]}
                    {(s.target || s.note) && <small>{[s.target, s.note].filter(Boolean).join(' · ')}</small>}
                  </span>
                  <span className={`set-prev${trend ? ` trend-${trend}` : ''}`}>
                    {trend && <b>{TREND_ICON[trend]}</b>}
                    {prevText}
                  </span>
                  <NumInput
                    value={s.weight}
                    onChange={(v) => updateSet(s.id, { weight: v })}
                    placeholder={p?.weight !== undefined ? fmtNum(p.weight) : bodyweight ? '0' : ''}
                    aria-label={`Carico ${labels[i]}`}
                  />
                  <NumInput
                    id={`reps-${s.id}`}
                    integer
                    value={s.reps}
                    onChange={(v) => updateSet(s.id, { reps: v })}
                    placeholder={p ? String(p.reps) : s.target}
                    aria-label={`Ripetizioni ${labels[i]}`}
                  />
                  <button
                    className={`check${s.done ? ' on' : ''}`}
                    onClick={() => toggleDone(s, i)}
                    aria-label={s.done ? 'Segna come non fatta' : 'Segna serie fatta'}
                    aria-pressed={s.done}
                  >
                    ✓
                  </button>
                </div>
              );
            })}
          </div>

          <div className="row gap wrap entry-actions">
            <button className="btn small ghost" onClick={() => addSet('work')}>
              + Serie
            </button>
            <button className="btn small ghost" onClick={() => addSet('drop')}>
              + Drop
            </button>
            {entry.sets.length > 0 && (
              <button className="btn small ghost" onClick={() => onChange({ ...entry, sets: entry.sets.slice(0, -1) })}>
                − Serie
              </button>
            )}
            <button className="btn small ghost" onClick={() => setShowNote((v) => !v)}>
              Nota
            </button>
          </div>
          {showNote && (
            <textarea
              className="entry-note"
              rows={2}
              placeholder="Nota su questo esercizio (es. presa, sensazioni)"
              value={entry.notes ?? ''}
              onChange={(e) => onChange({ ...entry, notes: e.target.value || undefined })}
            />
          )}
        </>
      )}
    </section>
  );
}
