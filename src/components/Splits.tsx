import { Check, Settings2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { DayPlan, WeekSplit } from '../db/types';
import { useSettings } from '../db/repo';
import { usePrograms } from '../lib/programs';
import { activeSplit, chooseSplitForWeek, defaultSplit, splitsOf, splitSummary, WEEKDAYS } from '../lib/weekPlan';
import { Link } from '../router';
import { Sheet } from './Sheet';

const encode = (p: DayPlan | undefined) => (!p || p.kind === 'rest' ? 'rest' : p.kind === 'run' ? 'run' : `gym:${p.templateId}`);
const decode = (v: string): DayPlan =>
  v === 'run' ? { kind: 'run' } : v.startsWith('gym:') ? { kind: 'gym', templateId: v.slice(4) } : { kind: 'rest' };

/** I 7 giorni di una split: per ognuno un allenamento (raggruppati per scheda), corsa o riposo. */
export function SplitDayRows({ days, onChange }: { days: DayPlan[]; onChange: (days: DayPlan[]) => void }) {
  const programs = usePrograms();
  return (
    <div className="card flush">
      {WEEKDAYS.map((day, i) => (
        <label key={day} className="list-row" style={{ cursor: 'default' }}>
          <span className="lr-body">
            <span className="lr-title">{day}</span>
          </span>
          <select
            style={{ width: 180 }}
            value={encode(days[i])}
            onChange={(e) => onChange(days.map((d, k) => (k === i ? decode(e.target.value) : d)))}
          >
            <option value="rest">Riposo</option>
            <option value="run">Corsa</option>
            {programs?.map(({ program, templates }) => (
              <optgroup key={program.id} label={program.name}>
                {templates.map((t) => (
                  <option key={t.id} value={`gym:${t.id}`}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}

/** Dalla home: quale split usare questa settimana. */
export function SplitChooserSheet({ onClose }: { onClose: () => void }) {
  const settings = useSettings();
  const templates = useLiveQuery(() => db.templates.toArray());
  const splits = splitsOf(settings);
  const current = activeSplit(settings);
  const def = defaultSplit(settings);

  async function choose(s: WeekSplit) {
    await chooseSplitForWeek(s.id);
    onClose();
  }

  return (
    <Sheet
      title="Split di questa settimana"
      onClose={onClose}
      footer={
        <Link to="/impostazioni/split" className="btn btn-block">
          <Settings2 size={17} /> Crea o modifica le split
        </Link>
      }
    >
      {splits.length === 0 ? (
        <p className="muted small">Non hai ancora una split settimanale: creane una per vedere ogni giorno l'allenamento da fare.</p>
      ) : (
        <>
          <p className="muted small">La scelta vale solo per questa settimana; dalla prossima torna la predefinita.</p>
          <div className="card flush">
            {splits.map((s) => (
              <button key={s.id} className="list-row" onClick={() => choose(s)} aria-pressed={s.id === current?.id}>
                <span className="lr-body">
                  <span className="lr-title">
                    {s.name} {s.id === def?.id && <span className="chip">Predefinita</span>}
                  </span>
                  <span className="lr-sub">{splitSummary(s, templates)}</span>
                </span>
                {s.id === current?.id && <Check size={20} strokeWidth={3} className="pos" />}
              </button>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}
