import { useEffect, useState } from 'react';
import { db, uid } from '../../db/db';
import { useExerciseMap } from '../../db/repo';
import type { SetType, Template, TemplateItem, TemplateSet } from '../../db/types';
import { ExercisePicker } from '../../components/ExercisePicker';
import { navigate } from '../../router';
import { setLabels, summarizeSets } from '../../lib/format';

const SUPERSET_LETTERS = ['A', 'B', 'C', 'D', 'E'];
const SET_TYPE_LABEL: Record<SetType, string> = { work: 'Serie', drop: 'Drop', myo: 'Myo' };

type PickerState = { mode: 'add' } | { mode: 'replace'; itemId: string } | null;

export function TemplateEditor({ id }: { id: string }) {
  const isNew = id === 'nuova';
  const [t, setT] = useState<Template | null>();
  const [picker, setPicker] = useState<PickerState>(null);
  const exMap = useExerciseMap();

  useEffect(() => {
    if (isNew) {
      db.templates.count().then((n) =>
        setT({ id: uid(), name: '', order: n + 1, items: [], createdAt: Date.now(), updatedAt: Date.now() }),
      );
    } else {
      db.templates.get(id).then((x) => setT(x ?? null));
    }
  }, [id, isNew]);

  if (t === undefined) return <p className="page muted">Caricamento…</p>;
  if (t === null) return <p className="page">Scheda non trovata.</p>;
  const tpl = t;

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
      alert('Dai un nome alla scheda.');
      return;
    }
    // le note lasciate vuote non si salvano
    const items = tpl.items.map((it) => ({
      ...it,
      sets: it.sets.map(({ note, ...s }) => (note?.trim() ? { ...s, note: note.trim() } : s)),
    }));
    await db.templates.put({ ...tpl, items, name: tpl.name.trim(), updatedAt: Date.now() });
    navigate('/pesi');
  }

  async function remove() {
    if (!confirm(`Eliminare la scheda «${tpl.name}»? Gli allenamenti già fatti restano nello storico.`)) return;
    await db.templates.delete(tpl.id);
    navigate('/pesi', { replace: true });
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>{isNew ? 'Nuova scheda' : 'Modifica scheda'}</h1>
      </header>

      <label className="field">
        <span>Nome</span>
        <input value={tpl.name} placeholder="Es. Upper 1" onChange={(e) => setT({ ...tpl, name: e.target.value })} />
      </label>

      {tpl.items.map((it, i) => {
        const labels = setLabels(it.sets);
        return (
          <section key={it.id} className={`card${it.superset ? ' superset' : ''}`}>
            <div className="entry-head">
              <button className="entry-name link" onClick={() => setPicker({ mode: 'replace', itemId: it.id })}>
                {i + 1}. {exMap?.get(it.exerciseId)?.name ?? '?'}
              </button>
              <div className="row gap-s">
                <button className="btn ghost icon" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Sposta su">
                  ↑
                </button>
                <button className="btn ghost icon" disabled={i === tpl.items.length - 1} onClick={() => move(i, 1)} aria-label="Sposta giù">
                  ↓
                </button>
                <button
                  className="btn ghost icon danger-text"
                  aria-label="Rimuovi esercizio"
                  onClick={() => setT({ ...tpl, items: tpl.items.filter((x) => x.id !== it.id) })}
                >
                  ✕
                </button>
              </div>
            </div>
            <p className="muted small">{summarizeSets(it.sets) || 'Nessuna serie'}</p>

            <div className="tpl-sets">
              {it.sets.map((s, si) => (
                <div key={si} className={`tpl-set ${s.type}`}>
                  <span className="set-label">{labels[si]}</span>
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
                    className={`btn ghost icon${s.note !== undefined ? ' on' : ''}`}
                    aria-label="Nota della serie"
                    aria-pressed={s.note !== undefined}
                    onClick={() =>
                      setSets(
                        it.id,
                        it.sets.map((x, k) => (k === si ? { ...x, note: x.note === undefined ? '' : undefined } : x)),
                      )
                    }
                  >
                    ✎
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
                    className="btn ghost icon"
                    aria-label="Rimuovi serie"
                    onClick={() => setSets(it.id, it.sets.filter((_, k) => k !== si))}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div className="row gap wrap">
              {(['work', 'drop', 'myo'] as SetType[]).map((type) => (
                <button
                  key={type}
                  className="btn small ghost"
                  onClick={() => {
                    const last = [...it.sets].reverse().find((x) => x.type === type);
                    setSets(it.id, [...it.sets, { type, reps: last?.reps ?? (type === 'myo' ? '3-5' : '8-10') }]);
                  }}
                >
                  + {SET_TYPE_LABEL[type]}
                </button>
              ))}
            </div>

            <div className="row gap tpl-extra">
              <label className="field compact">
                <span>Superset</span>
                <select
                  value={it.superset ?? ''}
                  onChange={(e) => setItem(it.id, { superset: e.target.value || undefined })}
                >
                  <option value="">—</option>
                  {SUPERSET_LETTERS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field compact grow">
                <span>Nota per il workout</span>
                <input value={it.notes ?? ''} onChange={(e) => setItem(it.id, { notes: e.target.value || undefined })} />
              </label>
            </div>
          </section>
        );
      })}

      <button className="btn block" onClick={() => setPicker({ mode: 'add' })}>
        + Aggiungi esercizio
      </button>

      <p className="muted small">
        Le modifiche valgono dai prossimi allenamenti: quelli già fatti restano come sono. Esercizi con la stessa lettera di
        superset vengono raggruppati durante il workout.
      </p>

      <div className="sticky-actions">
        {!isNew && (
          <button className="btn danger-text" onClick={remove}>
            Elimina
          </button>
        )}
        <span className="grow" />
        <button className="btn ghost" onClick={() => navigate('/pesi')}>
          Annulla
        </button>
        <button className="btn primary" onClick={save}>
          Salva
        </button>
      </div>

      {picker && <ExercisePicker onPick={onPick} onClose={() => setPicker(null)} />}
    </div>
  );
}
