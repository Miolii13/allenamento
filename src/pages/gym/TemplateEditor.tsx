import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from 'lucide-react';
import { db, uid } from '../../db/db';
import { useExerciseMap } from '../../db/repo';
import type { SetType, Template, TemplateItem, TemplateSet } from '../../db/types';
import { ExercisePicker } from '../../components/ExercisePicker';
import { PageHeader } from '../../components/PageHeader';
import { navigate } from '../../router';
import { setLabels, summarizeSets } from '../../lib/format';
import { usePrograms } from '../../lib/programs';
import { DEFAULT_PROGRAM_ID } from '../../db/constants';
import { fmtClock, getDefaultRest, ITEM_REST_OPTIONS } from '../../lib/restTimer';

const SUPERSET_LETTERS = ['A', 'B', 'C', 'D', 'E'];
const SET_TYPE_LABEL: Record<SetType, string> = { work: 'Serie', drop: 'Drop', myo: 'Myo' };

type PickerState = { mode: 'add' } | { mode: 'replace'; itemId: string } | null;

/** Etichetta corta per il numero della serie: S1 -> 1, Attiv. -> A, drop -> ↳, Myo 2 -> M2. */
const shortLabel = (l: string) => l.replace(/^S(\d+)$/, '$1').replace('Attiv.', 'A').replace('↳ drop', '↳').replace(/^Myo (\d+)$/, 'M$1');

/** Allenamento di una scheda (es. Upper 1): esercizi, serie, recuperi, superset. */
export function TemplateEditor({ id, programId }: { id: string; programId?: string }) {
  const isNew = id === 'nuovo';
  const programs = usePrograms();
  const [t, setT] = useState<Template | null>();
  const [picker, setPicker] = useState<PickerState>(null);
  const exMap = useExerciseMap();
  const defaultRest = getDefaultRest();

  useEffect(() => {
    if (isNew) {
      db.templates.count().then((n) =>
        setT({ id: uid(), programId: programId ?? DEFAULT_PROGRAM_ID, name: '', order: n + 1, items: [], createdAt: Date.now(), updatedAt: Date.now() }),
      );
    } else {
      db.templates.get(id).then((x) => setT(x ?? null));
    }
  }, [id, isNew, programId]);

  if (t === undefined) return <p className="page muted">Caricamento…</p>;
  if (t === null) return <p className="page">Allenamento non trovato.</p>;
  const tpl = t;
  // scheda a cui appartiene: si torna lì dopo il salvataggio
  const ownerId = programs?.find((p) => p.templates.some((x) => x.id === tpl.id))?.program.id ?? tpl.programId ?? DEFAULT_PROGRAM_ID;
  const ownerName = programs?.find((p) => p.program.id === ownerId)?.program.name ?? 'Scheda';
  const backTo = `/pesi/scheda/${ownerId}`;

  const setItem = (itemId: string, patch: Partial<TemplateItem>) =>
    setT({ ...tpl, items: tpl.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) });
  const setSets = (itemId: string, sets: TemplateSet[]) => setItem(itemId, { sets });
  const move = (index: number, dir: -1 | 1) => {
    const items = [...tpl.items];
    const j = index + dir;
    if (j < 0 || j >= items.length) return;
    [items[index], items[j]] = [items[j], items[index]];
    setT({ ...tpl, items });
  };

  function onPick(exerciseId: string) {
    if (picker?.mode === 'replace') setItem(picker.itemId, { exerciseId });
    else
      setT({
        ...tpl,
        items: [...tpl.items, { id: uid(), exerciseId, sets: [{ type: 'work', reps: '8-10' }, { type: 'work', reps: '8-10' }] }],
      });
    setPicker(null);
  }

  async function save() {
    if (!tpl.name.trim()) {
      alert("Dai un nome all'allenamento.");
      return;
    }
    // le note lasciate vuote non si salvano
    const items = tpl.items.map((it) => ({
      ...it,
      sets: it.sets.map(({ note, ...s }) => (note?.trim() ? { ...s, note: note.trim() } : s)),
    }));
    await db.templates.put({ ...tpl, programId: tpl.programId ?? ownerId, items, name: tpl.name.trim(), updatedAt: Date.now() });
    navigate(backTo);
  }

  async function remove() {
    if (!confirm(`Eliminare l'allenamento «${tpl.name}»? Quelli già fatti restano nello storico.`)) return;
    await db.templates.delete(tpl.id);
    navigate(backTo, { replace: true });
  }

  return (
    <div className="page">
      <PageHeader
        title={isNew ? 'Nuovo allenamento' : 'Modifica allenamento'}
        back={{ to: backTo, label: ownerName }}
        subtitle="Le modifiche valgono dai prossimi allenamenti."
      />

      <label className="field">
        <span>Nome dell'allenamento</span>
        <input value={tpl.name} placeholder="Es. Upper 1" onChange={(e) => setT({ ...tpl, name: e.target.value })} />
      </label>

      {tpl.items.map((it, i) => {
        const labels = setLabels(it.sets);
        return (
          <section key={it.id} className={`ex-card${it.superset ? ' superset' : ''}`}>
            <div className="ex-head">
              <span className="ex-index">{i + 1}</span>
              <button className="ex-titles ex-name" onClick={() => setPicker({ mode: 'replace', itemId: it.id })}>
                <span>
                  {exMap?.get(it.exerciseId)?.name ?? '?'} <Pencil size={13} className="muted" />
                </span>
                <span className="ex-sub">{summarizeSets(it.sets) || 'Nessuna serie'}</span>
              </button>
              <div className="row" style={{ gap: 0 }}>
                <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Sposta su">
                  <ArrowUp size={18} />
                </button>
                <button className="icon-btn" disabled={i === tpl.items.length - 1} onClick={() => move(i, 1)} aria-label="Sposta giù">
                  <ArrowDown size={18} />
                </button>
                <button
                  className="icon-btn"
                  aria-label="Rimuovi esercizio"
                  onClick={() => setT({ ...tpl, items: tpl.items.filter((x) => x.id !== it.id) })}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <div className="tpl-sets">
              {it.sets.map((s, si) => (
                <div key={si} className={`tpl-set ${s.type}`}>
                  <span className="set-num">{shortLabel(labels[si])}</span>
                  <select
                    value={s.type}
                    aria-label="Tipo di serie"
                    onChange={(e) =>
                      setSets(it.id, it.sets.map((x, k) => (k === si ? { ...x, type: e.target.value as SetType } : x)))
                    }
                  >
                    {(Object.keys(SET_TYPE_LABEL) as SetType[]).map((k) => (
                      <option key={k} value={k}>
                        {SET_TYPE_LABEL[k]}
                      </option>
                    ))}
                  </select>
                  <input
                    value={s.reps}
                    placeholder="reps"
                    aria-label="Ripetizioni obiettivo"
                    onChange={(e) => setSets(it.id, it.sets.map((x, k) => (k === si ? { ...x, reps: e.target.value } : x)))}
                  />
                  <button
                    className={`icon-btn${s.note !== undefined ? ' on' : ''}`}
                    aria-label="Nota della serie"
                    aria-pressed={s.note !== undefined}
                    onClick={() =>
                      setSets(
                        it.id,
                        it.sets.map((x, k) => (k === si ? { ...x, note: x.note === undefined ? '' : undefined } : x)),
                      )
                    }
                  >
                    <Pencil size={16} />
                  </button>
                  {s.note !== undefined && (
                    <input
                      className="tpl-note"
                      value={s.note}
                      autoFocus={s.note === ''}
                      placeholder="nota (es. back-off, doppio impulso)"
                      aria-label="Nota serie"
                      onChange={(e) => setSets(it.id, it.sets.map((x, k) => (k === si ? { ...x, note: e.target.value } : x)))}
                    />
                  )}
                  <button
                    className="icon-btn"
                    aria-label="Rimuovi serie"
                    onClick={() => setSets(it.id, it.sets.filter((_, k) => k !== si))}
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
            </div>

            <div className="ex-actions">
              {(['work', 'drop', 'myo'] as SetType[]).map((type) => (
                <button
                  key={type}
                  className="btn"
                  onClick={() => {
                    const last = [...it.sets].reverse().find((x) => x.type === type);
                    setSets(it.id, [...it.sets, { type, reps: last?.reps ?? (type === 'myo' ? '3-5' : '8-10') }]);
                  }}
                >
                  <Plus size={15} /> {SET_TYPE_LABEL[type]}
                </button>
              ))}
            </div>

            <div className="row" style={{ alignItems: 'flex-end' }}>
              <label className="field grow">
                <span>Recupero</span>
                <select
                  value={it.rest ?? ''}
                  onChange={(e) => setItem(it.id, { rest: e.target.value ? Number(e.target.value) : undefined })}
                >
                  <option value="">Predefinito ({fmtClock(defaultRest)})</option>
                  {ITEM_REST_OPTIONS.map((sec) => (
                    <option key={sec} value={sec}>
                      {fmtClock(sec)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field" style={{ width: 110 }}>
                <span>Superset</span>
                <select value={it.superset ?? ''} onChange={(e) => setItem(it.id, { superset: e.target.value || undefined })}>
                  <option value="">—</option>
                  {SUPERSET_LETTERS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span>Nota per l'allenamento</span>
              <input value={it.notes ?? ''} placeholder="es. Dropset" onChange={(e) => setItem(it.id, { notes: e.target.value || undefined })} />
            </label>
          </section>
        );
      })}

      <button className="btn btn-block" onClick={() => setPicker({ mode: 'add' })}>
        <Plus size={18} /> Aggiungi esercizio
      </button>

      <p className="muted small">
        Esercizi con la stessa lettera di superset si fanno uno dopo l'altro: il recupero parte dopo l'ultimo del gruppo e
        vale quello impostato su quell'esercizio.
      </p>

      <div className="sticky-actions">
        {!isNew && (
          <button className="btn btn-danger-text btn-sm" onClick={remove}>
            <Trash2 size={16} /> Elimina
          </button>
        )}
        <span className="grow" />
        <button className="btn btn-sm" onClick={() => navigate(backTo)}>
          Annulla
        </button>
        <button className="btn btn-primary btn-sm" onClick={save}>
          Salva allenamento
        </button>
      </div>

      {picker && <ExercisePicker onPick={onPick} onClose={() => setPicker(null)} />}
    </div>
  );
}
