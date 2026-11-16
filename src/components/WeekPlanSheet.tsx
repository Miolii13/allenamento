import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { DayPlan } from '../db/types';
import { useSettings } from '../db/repo';
import { saveWeekPlan, WEEKDAYS } from '../lib/weekPlan';
import { Sheet } from './Sheet';

const encode = (p: DayPlan | undefined) => (!p || p.kind === 'rest' ? 'rest' : p.kind === 'run' ? 'run' : `gym:${p.templateId}`);
const decode = (v: string): DayPlan =>
  v === 'run' ? { kind: 'run' } : v.startsWith('gym:') ? { kind: 'gym', templateId: v.slice(4) } : { kind: 'rest' };

/** Settimana tipo: per ogni giorno una scheda, la corsa o il riposo. */
export function WeekPlanSheet({ onClose }: { onClose: () => void }) {
  const settings = useSettings();
  const templates = useLiveQuery(() => db.templates.orderBy('order').filter((t) => !t.archived).toArray());
  const [plan, setPlan] = useState<DayPlan[] | null>(null);
  const current: DayPlan[] = plan ?? settings?.weekPlan ?? Array.from({ length: 7 }, () => ({ kind: 'rest' as const }));

  async function save() {
    await saveWeekPlan(current);
    onClose();
  }

  return (
    <Sheet
      title="Settimana tipo"
      onClose={onClose}
      footer={
        <button className="btn btn-primary btn-lg btn-block" onClick={save} disabled={!settings}>
          Salva settimana
        </button>
      }
    >
      <p className="muted small">
        Scegli cosa fai ogni giorno: aprendo l'app vedrai subito l'allenamento di oggi. Vale per tutte le settimane finché non la
        cambi.
      </p>
      <div className="card flush">
        {WEEKDAYS.map((day, i) => (
          <label key={day} className="list-row" style={{ cursor: 'default' }}>
            <span className="lr-body">
              <span className="lr-title">{day}</span>
            </span>
            <select
              style={{ width: 170 }}
              value={encode(current[i])}
              onChange={(e) => setPlan(current.map((p, k) => (k === i ? decode(e.target.value) : p)))}
            >
              <option value="rest">Riposo</option>
              <option value="run">Corsa</option>
              <optgroup label="Sala pesi">
                {templates?.map((t) => (
                  <option key={t.id} value={`gym:${t.id}`}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
        ))}
      </div>
    </Sheet>
  );
}
