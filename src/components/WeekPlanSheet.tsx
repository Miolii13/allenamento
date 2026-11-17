import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { DayPlan, Settings } from '../db/types';
import { useSettings } from '../db/repo';
import { saveWeekPlan, WEEKDAYS } from '../lib/weekPlan';
import { Sheet } from './Sheet';

const encode = (p: DayPlan | undefined) => (!p || p.kind === 'rest' ? 'rest' : p.kind === 'run' ? 'run' : `gym:${p.templateId}`);
const decode = (v: string): DayPlan =>
  v === 'run' ? { kind: 'run' } : v.startsWith('gym:') ? { kind: 'gym', templateId: v.slice(4) } : { kind: 'rest' };
const emptyPlan = (): DayPlan[] => Array.from({ length: 7 }, () => ({ kind: 'rest' as const }));

/** Stato della settimana tipo in modifica: parte da quella salvata, si salva con save(). */
export function useWeekPlanDraft() {
  const settings: Settings | undefined = useSettings();
  const templates = useLiveQuery(() => db.templates.orderBy('order').filter((t) => !t.archived).toArray());
  const [draft, setDraft] = useState<DayPlan[] | null>(null);
  const plan = draft ?? settings?.weekPlan ?? emptyPlan();
  return {
    ready: !!settings && !!templates,
    plan,
    templates,
    dirty: draft !== null,
    setDay: (i: number, p: DayPlan) => setDraft(plan.map((x, k) => (k === i ? p : x))),
    save: async () => {
      await saveWeekPlan(plan);
      setDraft(null);
    },
  };
}

/** Un giorno per riga: scheda, corsa o riposo. */
export function WeekPlanRows({ draft }: { draft: ReturnType<typeof useWeekPlanDraft> }) {
  return (
    <div className="card flush">
      {WEEKDAYS.map((day, i) => (
        <label key={day} className="list-row" style={{ cursor: 'default' }}>
          <span className="lr-body">
            <span className="lr-title">{day}</span>
          </span>
          <select style={{ width: 170 }} value={encode(draft.plan[i])} onChange={(e) => draft.setDay(i, decode(e.target.value))}>
            <option value="rest">Riposo</option>
            <option value="run">Corsa</option>
            <optgroup label="Sala pesi">
              {draft.templates?.map((t) => (
                <option key={t.id} value={`gym:${t.id}`}>
                  {t.name}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
      ))}
    </div>
  );
}

export const WEEK_PLAN_HELP =
  "Scegli cosa fai ogni giorno: aprendo l'app vedrai subito l'allenamento di oggi. Vale per tutte le settimane finché non la cambi.";

/** Versione a pannello, aperta dalla home. */
export function WeekPlanSheet({ onClose }: { onClose: () => void }) {
  const draft = useWeekPlanDraft();
  return (
    <Sheet
      title="Settimana tipo"
      onClose={onClose}
      footer={
        <button
          className="btn btn-primary btn-lg btn-block"
          disabled={!draft.ready}
          onClick={async () => {
            await draft.save();
            onClose();
          }}
        >
          Salva settimana
        </button>
      }
    >
      <p className="muted small">{WEEK_PLAN_HELP}</p>
      <WeekPlanRows draft={draft} />
    </Sheet>
  );
}
