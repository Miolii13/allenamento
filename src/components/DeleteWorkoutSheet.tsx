import { Trash2, TriangleAlert } from 'lucide-react';
import { db } from '../db/db';
import type { Workout } from '../db/types';
import { fmtDate } from '../lib/format';
import { isLogged } from '../lib/progress';
import { stopRest } from '../lib/restTimer';
import { navigate } from '../router';
import { Sheet } from './Sheet';

/**
 * Annulla un allenamento in corso o elimina uno dello storico: cancella tutti i suoi dati,
 * come se non fosse mai stato fatto (anche sugli altri dispositivi sincronizzati).
 */
export function DeleteWorkoutSheet({ workout, onClose }: { workout: Workout; onClose: () => void }) {
  const active = workout.status === 'active';
  const sets = workout.entries.reduce((n, e) => n + e.sets.filter(isLogged).length, 0);

  async function remove() {
    if (active) stopRest();
    await db.workouts.delete(workout.id);
    onClose();
    navigate(active ? '/pesi' : '/pesi/storico', { replace: true });
  }

  return (
    <Sheet
      title={active ? "Annullare l'allenamento?" : "Eliminare l'allenamento?"}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-danger-solid btn-lg btn-block" onClick={remove}>
            <Trash2 size={18} /> {active ? 'Sì, annulla e cancella tutto' : 'Sì, elimina'}
          </button>
          <button className="btn btn-block" onClick={onClose}>
            {active ? 'No, continua ad allenarti' : 'No, tienilo'}
          </button>
        </>
      }
    >
      <div className="banner warning">
        <TriangleAlert size={18} />
        <span>
          {active
            ? `Tutto quello che hai segnato in ${workout.templateName} verrà cancellato, come se l'allenamento non fosse mai iniziato.`
            : `${workout.templateName} del ${fmtDate(workout.startedAt)} sparirà dallo storico e dalle statistiche, anche sugli altri dispositivi. Non si può recuperare.`}
        </span>
      </div>
      <p className="muted small">
        {workout.entries.length} {workout.entries.length === 1 ? 'esercizio' : 'esercizi'} · {sets}{' '}
        {sets === 1 ? 'serie registrata' : 'serie registrate'}
      </p>
    </Sheet>
  );
}
