import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  Clock,
  Equal,
  History,
  Layers,
  Minus,
  MoreHorizontal,
  Plus,
  RotateCcw,
  StickyNote,
  Trash2,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react';
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
import { Sheet } from '../../components/Sheet';
import { Link, navigate } from '../../router';
import { daysAgo, fmtDateShort, fmtDuration, fmtNum, loadUnit, summarizeSets, toLocalInput } from '../../lib/format';
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
import { startRest, stopRest } from '../../lib/restTimer';

export function TrendIcon({ trend, size = 13 }: { trend: Trend; size?: number }) {
  const Icon = trend === 'up' ? ArrowUp : trend === 'down' ? ArrowDown : Equal;
  const label = trend === 'up' ? 'meglio della volta prima' : trend === 'down' ? 'peggio della volta prima' : 'come la volta prima';
  return (
    <span className={`trend trend-${trend}`} aria-label={label} title={label}>
      <Icon size={size} strokeWidth={2.8} />
    </span>
  );
}

/** Etichette compatte per il numero della serie e descrizione estesa per la riga sotto. */
function setTags(sets: { type: SetType; target: string; note?: string }[]) {
  let work = 0;
  let myo = 0;
  return sets.map((s, i) => {
    if (s.type === 'work') {
      work++;
      myo = 0;
      const activation = sets[i + 1]?.type === 'myo';
      return {
        short: activation ? 'A' : String(work),
        long: [activation ? 'attivazione' : '', s.target, s.note].filter(Boolean).join(' · '),
      };
    }
    if (s.type === 'drop') return { short: '↳', long: ['drop', s.target].filter(Boolean).join(' · ') };
    myo++;
    return { short: `M${myo}`, long: ['myo', s.target].filter(Boolean).join(' · ') };
  });
}

export function WorkoutPage({ id }: { id: string }) {
  const [w, setW] = useState<Workout | null>();
  const exMap = useExerciseMap();
  const settings = useSettings();
  const [prev, setPrev] = useState<Record<string, PrevEntry | undefined>>({});
  const [picker, setPicker] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    db.workouts.get(id).then((x) => setW(x ?? null));
  }, [id]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
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
        <Link to="/pesi">Torna alla home</Link>
      </div>
    );

  const workout = w;
  const isActive = workout.status === 'active';
  const totalSets = workout.entries.reduce((n, e) => n + e.sets.length, 0);
  const doneSets = workout.entries.reduce((n, e) => n + e.sets.filter(isLogged).length, 0);

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
    stopRest();
    await finishWorkout(workout);
    navigate(`/pesi/storico/${workout.id}?fine=1`, { replace: true });
  }

  async function discard() {
    if (!confirm("Annullare l'allenamento? Quello che hai segnato verrà perso.")) return;
    stopRest();
    await db.workouts.delete(workout.id);
    navigate('/pesi', { replace: true });
  }

  async function doneEditing() {
    await db.workouts.put(cleanWorkout(workout));
    navigate(`/pesi/storico/${workout.id}`, { replace: true });
  }

  const emptySets = countEmptySets(workout);

  return (
    <div className="page">
      <header className="wk-header">
        <div className="wk-title">
          <Link to={isActive ? '/pesi' : `/pesi/storico/${workout.id}`} className="icon-btn" aria-label="Indietro">
            <ChevronLeft size={24} />
          </Link>
          <div className="grow">
            <h1 className="ellipsis">{isActive ? workout.templateName : 'Modifica allenamento'}</h1>
            <div className="wk-meta">
              {isActive && (
                <span>
                  <Clock size={13} /> {fmtDuration(now - workout.startedAt)}
                </span>
              )}
              <span>
                <Layers size={13} /> {doneSets}/{totalSets} serie
              </span>
            </div>
          </div>
          {isActive ? (
            <button className="btn btn-success btn-sm" onClick={() => setFinishing(true)}>
              <Check size={16} strokeWidth={3} /> Fine
            </button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={doneEditing}>
              Salva
            </button>
          )}
        </div>
        <div className={`progress${doneSets === totalSets && totalSets > 0 ? ' success' : ''}`}>
          <div style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%` }} />
        </div>
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

      {workout.entries.length === 0 && (
        <p className="muted" style={{ textAlign: 'center' }}>
          Nessun esercizio: aggiungine uno qui sotto.
        </p>
      )}

      {workout.entries.map((entry, i) => {
        const exercise = exMap.get(entry.exerciseId);
        const nextEntry = workout.entries[i + 1];
        return (
          <EntryCard
            key={entry.id}
            index={i}
            entry={entry}
            exercise={exercise}
            group={equipmentOf(settings, exercise)}
            prev={prev[entry.exerciseId]}
            supersetLabel={supersetLabels[i]}
            // in superset il recupero parte solo dopo l'ultimo esercizio del gruppo
            restAfterSet={!entry.superset || nextEntry?.superset !== entry.superset}
            timerEnabled={isActive}
            isFirst={i === 0}
            isLast={i === workout.entries.length - 1}
            onChange={updateEntry}
            onMove={(dir) => moveEntry(i, dir)}
            onRemove={() => removeEntry(entry)}
          />
        );
      })}

      <button className="btn btn-block" onClick={() => setPicker(true)}>
        <Plus size={18} /> Aggiungi esercizio
      </button>

      <label className="field">
        <span>Note sull'allenamento</span>
        <textarea
          rows={2}
          placeholder="Sensazioni, energia, dolori…"
          value={workout.notes ?? ''}
          onChange={(e) => save({ ...workout, notes: e.target.value || undefined })}
        />
      </label>

      {isActive && (
        <div className="stack-s">
          <button className="btn btn-success btn-lg btn-block" onClick={() => setFinishing(true)}>
            <Check size={20} strokeWidth={3} /> Termina allenamento
          </button>
          <button className="btn btn-danger-text btn-block" onClick={discard}>
            Annulla allenamento
          </button>
        </div>
      )}

      {picker && <ExercisePicker onPick={addExercise} onClose={() => setPicker(false)} />}

      {finishing && (
        <Sheet title="Terminare l'allenamento?" onClose={() => setFinishing(false)}>
          <div className="stats-grid">
            <div className="stat">
              <b>{fmtDuration(Date.now() - workout.startedAt)}</b>
              <span>durata</span>
            </div>
            <div className="stat">
              <b>
                {doneSets}/{totalSets}
              </b>
              <span>serie fatte</span>
            </div>
          </div>
          {emptySets > 0 && (
            <div className="banner warning">
              <TriangleAlert size={18} />
              <span>
                {emptySets === 1 ? '1 serie è vuota e verrà scartata.' : `${emptySets} serie sono vuote e verranno scartate.`}
              </span>
            </div>
          )}
          <button className="btn btn-success btn-lg btn-block" onClick={finish}>
            <Check size={20} strokeWidth={3} /> Termina e salva
          </button>
          <button className="btn btn-block" onClick={() => setFinishing(false)}>
            Continua ad allenarti
          </button>
        </Sheet>
      )}
    </div>
  );
}

interface EntryCardProps {
  index: number;
  entry: WorkoutEntry;
  exercise: Exercise | undefined;
  group: EquipmentGroup | undefined;
  prev: PrevEntry | undefined;
  supersetLabel?: string;
  restAfterSet: boolean;
  timerEnabled: boolean;
  isFirst: boolean;
  isLast: boolean;
  onChange: (e: WorkoutEntry) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}

function EntryCard(props: EntryCardProps) {
  const { index, entry, exercise, group, prev, supersetLabel, restAfterSet, timerEnabled, isFirst, isLast, onChange, onMove, onRemove } =
    props;
  const loggedSets = entry.sets.filter(isLogged).length;
  const complete = entry.sets.length > 0 && entry.sets.every((s) => s.done);
  const [open, setOpen] = useState(!complete);
  const [menu, setMenu] = useState(false);
  const [showNote, setShowNote] = useState(!!entry.notes);

  // quando completi l'ultima serie l'esercizio si chiude da solo
  useEffect(() => {
    if (complete) setOpen(false);
  }, [complete]);

  const variant = variantOf(group, entry.variantId);
  const prevVariant = variantOf(group, prev?.entry.variantId);
  const bodyweight = exercise?.loadType === 'bodyweight';
  const converted = !!variant && !!prevVariant && variant.id !== prevVariant.id;
  const needVariant = !!group && !variant;
  const tags = setTags(entry.sets);
  const targetSummary = summarizeSets(entry.sets.map((s) => ({ type: s.type, reps: s.target, note: s.note })));

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
    // recupero: non tra serie e drop/myo, né a metà di un superset
    const nextType = entry.sets[i + 1]?.type;
    const chained = nextType === 'drop' || nextType === 'myo';
    const lastSet = i === entry.sets.length - 1;
    if (timerEnabled && !chained && (restAfterSet || !lastSet)) startRest();
  };

  const addSet = (type: SetType) => {
    const last = [...entry.sets].reverse().find((s) => s.type === type);
    onChange({ ...entry, sets: [...entry.sets, newSet(type, last?.target ?? '')] });
    setOpen(true);
  };

  const prevSummary = prev?.entry.sets
    .filter(isLogged)
    .map((s) => setText(s, bodyweight))
    .join(' · ');

  return (
    <section className={`ex-card${entry.superset ? ' superset' : ''}${complete ? ' complete' : ''}${open ? '' : ' collapsed'}`}>
      <div className="ex-head">
        <span className="ex-index">{complete ? <Check size={17} strokeWidth={3} /> : index + 1}</span>
        <button className="ex-titles ex-name" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <span>{exercise?.name ?? 'Esercizio eliminato'}</span>
          <span className="ex-sub">
            {supersetLabel && <span className="badge">{supersetLabel}</span>}
            {variant && <span className="chip warning">{variant.name}</span>}
            {open ? (
              <span>Obiettivo {targetSummary || '—'}</span>
            ) : (
              <span className="ex-collapsed-sum">
                {loggedSets}/{entry.sets.length} serie
                {loggedSets > 0 &&
                  ` · ${entry.sets
                    .filter(isLogged)
                    .map((s) => setText(s, bodyweight))
                    .join(' · ')}`}
              </span>
            )}
          </span>
        </button>
        {open ? (
          <button className="icon-btn" onClick={() => setMenu(true)} aria-label="Altre azioni">
            <MoreHorizontal size={20} />
          </button>
        ) : (
          <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Apri esercizio">
            <ChevronDown size={20} />
          </button>
        )}
      </div>

      {open && (
        <>
          {(entry.hint || exercise?.notes) && (
            <p className="muted small">{[entry.hint, exercise?.notes].filter(Boolean).join(' · ')}</p>
          )}

          {prev ? (
            <div className="prev-box">
              <History size={16} />
              <div className="grow stack-s">
                <span className="pb-label">
                  Ultima volta · {fmtDateShort(prev.workout.startedAt)} ({daysAgo(prev.workout.startedAt)})
                  {prevVariant ? ` · ${prevVariant.name}` : ''}
                </span>
                <span className="pb-sets">{prevSummary}</span>
              </div>
            </div>
          ) : (
            <div className="prev-box">
              <History size={16} />
              <span className="pb-label">Prima volta: oggi stabilisci il punto di partenza.</span>
            </div>
          )}

          {shouldIncrease(prev?.entry) && (
            <div className="banner success">
              <TrendingUp size={18} />
              <span>L'ultima volta hai chiuso il range in tutte le serie: prova ad aumentare il carico.</span>
            </div>
          )}

          {group && needVariant && (
            <div className="variant-picker">
              <p>
                <TriangleAlert size={18} />
                {group.question}
              </p>
              <div className="variant-btns">
                {group.variants.map((v) => (
                  <button key={v.id} className="btn" onClick={() => onChange({ ...entry, variantId: v.id })}>
                    {v.name}
                    {prevVariant?.id === v.id && <small>usata l'ultima volta</small>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {converted && (
            <p className="muted small">
              L'ultima volta eri su {prevVariant!.name}: nella colonna «Prima» i pesi sono già convertiti su {variant!.name}.
            </p>
          )}

          {!needVariant && (
            <div className="set-grid">
              <div className="set-row head">
                <span>Set</span>
                <span>Prima</span>
                <span>{exercise ? loadUnit(exercise.loadType) : 'Kg'}</span>
                <span>Reps</span>
                <span />
              </div>
              {entry.sets.map((s, i) => {
                const p = previousFor(i);
                // peso vuoto = quello della volta prima (è il valore che la ✓ inserirebbe)
                const effective = s.weight === undefined && p?.weight !== undefined ? { ...s, weight: p.weight } : s;
                const trend = compareSet(effective, p?.set, group, variant, prevVariant);
                const prevText = p
                  ? converted && p.weight !== undefined
                    ? `≈${fmtNum(p.weight)}×${p.reps}`
                    : setText(p.set, bodyweight)
                  : '—';
                return (
                  <div key={s.id} className={`set-row ${s.type}${s.done ? ' done' : ''}`}>
                    <span className="set-num">{tags[i].short}</span>
                    <span className="set-prev">
                      <span className="sp-val">
                        {prevText}
                        {trend && <TrendIcon trend={trend} />}
                      </span>
                      {tags[i].long && <span className="sp-target">{tags[i].long}</span>}
                    </span>
                    <NumInput
                      value={s.weight}
                      onChange={(v) => updateSet(s.id, { weight: v })}
                      placeholder={p?.weight !== undefined ? fmtNum(p.weight) : bodyweight ? '0' : '–'}
                      aria-label={`Carico serie ${tags[i].short}`}
                    />
                    <NumInput
                      id={`reps-${s.id}`}
                      integer
                      value={s.reps}
                      onChange={(v) => updateSet(s.id, { reps: v })}
                      placeholder={p ? String(p.reps) : s.target || '–'}
                      aria-label={`Ripetizioni serie ${tags[i].short}`}
                    />
                    <button
                      className={`set-check${s.done ? ' on' : ''}`}
                      onClick={() => toggleDone(s, i)}
                      aria-label={s.done ? 'Segna come non fatta' : 'Segna serie fatta'}
                      aria-pressed={s.done}
                    >
                      <Check size={22} strokeWidth={3} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {!needVariant && (
            <div className="ex-actions">
              <button className="btn" onClick={() => addSet('work')}>
                <Plus size={15} /> Serie
              </button>
              <button className="btn" onClick={() => addSet('drop')}>
                <Plus size={15} /> Drop
              </button>
              <button className="btn" onClick={() => setShowNote((v) => !v)}>
                <StickyNote size={15} /> Nota
              </button>
            </div>
          )}

          {showNote && (
            <textarea
              rows={2}
              placeholder="Nota su questo esercizio (presa, sensazioni…)"
              value={entry.notes ?? ''}
              onChange={(e) => onChange({ ...entry, notes: e.target.value || undefined })}
            />
          )}
        </>
      )}

      {menu && (
        <Sheet title={exercise?.name ?? 'Esercizio'} onClose={() => setMenu(false)}>
          <div className="menu-list">
            <button disabled={isFirst} onClick={() => (onMove(-1), setMenu(false))}>
              <ArrowUp size={18} /> Sposta su
            </button>
            <button disabled={isLast} onClick={() => (onMove(1), setMenu(false))}>
              <ArrowDown size={18} /> Sposta giù
            </button>
            <button
              disabled={entry.sets.length === 0}
              onClick={() => (onChange({ ...entry, sets: entry.sets.slice(0, -1) }), setMenu(false))}
            >
              <Minus size={18} /> Togli l'ultima serie
            </button>
            {group && variant && (
              <button onClick={() => (onChange({ ...entry, variantId: undefined }), setMenu(false))}>
                <RotateCcw size={18} /> Cambia {group.name.toLowerCase()}
              </button>
            )}
            <button onClick={() => navigate(`/pesi/esercizi/${entry.exerciseId}`)}>
              <History size={18} /> Storico dell'esercizio
            </button>
          </div>
          <div className="menu-list">
            <button className="danger" onClick={() => (setMenu(false), onRemove())}>
              <Trash2 size={18} /> Rimuovi dall'allenamento
            </button>
          </div>
        </Sheet>
      )}
    </section>
  );
}
