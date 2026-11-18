import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarDays, Check, ChevronRight, Plus, Star, Trash2 } from 'lucide-react';
import { db } from '../../db/db';
import { useSettings } from '../../db/repo';
import type { WeekSplit } from '../../db/types';
import { EmptyState, PageHeader } from '../../components/PageHeader';
import { SplitDayRows } from '../../components/Splits';
import { activeSplit, defaultSplit, newSplit, saveSplits, splitsOf, splitSummary } from '../../lib/weekPlan';
import { Link, navigate } from '../../router';

const BACK = { to: '/impostazioni', label: 'Impostazioni' };

/** Elenco delle split settimanali. */
export function SplitList() {
  const settings = useSettings();
  const templates = useLiveQuery(() => db.templates.toArray());
  const splits = splitsOf(settings);
  const def = defaultSplit(settings);
  const current = activeSplit(settings);

  return (
    <div className="page">
      <PageHeader
        title="Split settimanali"
        back={BACK}
        subtitle="Ogni split dice cosa fai ogni giorno. Usi la predefinita, ma per una settimana puoi sceglierne un'altra dalla home."
      />
      {splits.length === 0 ? (
        <div className="card">
          <EmptyState icon={<CalendarDays size={26} />} title="Nessuna split" text="Creane una: es. «Upper/Lower 3 giorni»." />
        </div>
      ) : (
        <div className="card flush">
          {splits.map((s) => (
            <Link key={s.id} to={`/impostazioni/split/${s.id}`} className="list-row">
              <span className="lr-body">
                <span className="lr-title row" style={{ gap: 6 }}>
                  {s.name}
                  {s.id === def?.id && <span className="chip accent">Predefinita</span>}
                  {s.id === current?.id && s.id !== def?.id && <span className="chip success">Questa settimana</span>}
                </span>
                <span className="lr-sub">{splitSummary(s, templates)}</span>
              </span>
              <ChevronRight size={18} className="chev" />
            </Link>
          ))}
        </div>
      )}
      <Link to="/impostazioni/split/nuova" className="btn btn-block">
        <Plus size={18} /> Nuova split
      </Link>
    </div>
  );
}

/** Una split: nome, giorni, predefinita. */
export function SplitEditor({ id }: { id: string }) {
  const isNew = id === 'nuova';
  const settings = useSettings();
  const [split, setSplit] = useState<WeekSplit | null>(null);
  const [makeDefault, setMakeDefault] = useState(false);

  useEffect(() => {
    if (!settings || split) return;
    const splits = splitsOf(settings);
    if (isNew) {
      setSplit(newSplit(`Split ${splits.length + 1}`));
      setMakeDefault(splits.length === 0);
    } else {
      const found = splits.find((s) => s.id === id);
      if (found) setSplit(structuredClone(found));
      setMakeDefault(defaultSplit(settings)?.id === id);
    }
  }, [settings, split, id, isNew]);

  if (!settings) return <p className="page muted">Caricamento…</p>;
  if (!split)
    return (
      <div className="page">
        <PageHeader title="Split non trovata" back={{ to: '/impostazioni/split', label: 'Split' }} />
      </div>
    );

  const splits = splitsOf(settings);
  const isDefault = defaultSplit(settings)?.id === split.id;

  async function save() {
    const clean = { ...split!, name: split!.name.trim() || 'Split' };
    const list = isNew ? [...splits, clean] : splits.map((s) => (s.id === clean.id ? clean : s));
    await saveSplits(list, makeDefault ? clean.id : undefined);
    navigate('/impostazioni/split');
  }

  async function remove() {
    if (!confirm(`Eliminare la split «${split!.name}»?`)) return;
    await saveSplits(splits.filter((s) => s.id !== split!.id));
    navigate('/impostazioni/split', { replace: true });
  }

  return (
    <div className="page">
      <PageHeader title={isNew ? 'Nuova split' : split.name || 'Split'} back={{ to: '/impostazioni/split', label: 'Split' }} />
      <label className="field">
        <span>Nome</span>
        <input value={split.name} placeholder="Es. Upper/Lower 3 giorni" onChange={(e) => setSplit({ ...split, name: e.target.value })} />
      </label>
      <SplitDayRows days={split.days} onChange={(days) => setSplit({ ...split, days })} />
      <button
        className={`btn btn-block${makeDefault ? ' btn-success' : ''}`}
        onClick={() => setMakeDefault((v) => !v)}
        disabled={isDefault && !isNew}
        aria-pressed={makeDefault}
      >
        {makeDefault ? <Check size={17} strokeWidth={3} /> : <Star size={17} />}
        {isDefault && !isNew ? 'È la split predefinita' : makeDefault ? 'Sarà la split predefinita' : 'Rendi predefinita'}
      </button>
      <div className="sticky-actions">
        {!isNew && (
          <button className="btn btn-danger-text btn-sm" onClick={remove}>
            <Trash2 size={16} /> Elimina
          </button>
        )}
        <span className="grow" />
        <button className="btn btn-sm" onClick={() => navigate('/impostazioni/split')}>
          Annulla
        </button>
        <button className="btn btn-primary btn-sm" onClick={save}>
          Salva
        </button>
      </div>
    </div>
  );
}
