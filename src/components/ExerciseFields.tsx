import type { Exercise, LoadType, MuscleGroup } from '../db/types';
import { useSettings } from '../db/repo';
import { LOAD_TYPE_LABEL } from '../lib/format';
import { MUSCLE_LABEL } from '../lib/muscles';

export type ExerciseDraft = Pick<Exercise, 'name' | 'loadType' | 'equipmentId' | 'notes' | 'muscle'>;

/** Campi modificabili di un esercizio: nome, muscolo, tipo di carico, attrezzo con più varianti, note. */
export function ExerciseFields({ value, onChange }: { value: ExerciseDraft; onChange: (v: ExerciseDraft) => void }) {
  const settings = useSettings();
  return (
    <div className="form">
      <label className="field">
        <span>Nome</span>
        <input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} placeholder="Es. Panca piana" />
      </label>
      <label className="field">
        <span>Muscolo principale</span>
        <select
          value={value.muscle ?? ''}
          onChange={(e) => onChange({ ...value, muscle: (e.target.value || undefined) as MuscleGroup | undefined })}
        >
          <option value="">Scegli…</option>
          {(Object.keys(MUSCLE_LABEL) as MuscleGroup[]).map((k) => (
            <option key={k} value={k}>
              {MUSCLE_LABEL[k]}
            </option>
          ))}
        </select>
        <small>Serve per le statistiche: serie a settimana per muscolo.</small>
      </label>
      <label className="field">
        <span>Tipo di carico</span>
        <select value={value.loadType} onChange={(e) => onChange({ ...value, loadType: e.target.value as LoadType })}>
          {(Object.keys(LOAD_TYPE_LABEL) as LoadType[]).map((k) => (
            <option key={k} value={k}>
              {LOAD_TYPE_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Attrezzo con più versioni</span>
        <select
          value={value.equipmentId ?? ''}
          onChange={(e) => onChange({ ...value, equipmentId: e.target.value || undefined })}
        >
          <option value="">Nessuno</option>
          {settings?.equipment.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} ({g.variants.map((v) => v.name).join(' / ')})
            </option>
          ))}
        </select>
        <small>Se scegli un attrezzo, durante il workout ti chiedo quale versione hai usato.</small>
      </label>
      <label className="field">
        <span>Note tecniche</span>
        <textarea rows={2} value={value.notes ?? ''} onChange={(e) => onChange({ ...value, notes: e.target.value || undefined })} />
      </label>
    </div>
  );
}
