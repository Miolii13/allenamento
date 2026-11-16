import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { startEmptyWorkout, startWorkout, useActiveWorkout, useExerciseMap } from '../../db/repo';
import type { Template } from '../../db/types';
import { Link, navigate } from '../../router';
import { daysAgo, fmtDuration, summarizeSets } from '../../lib/format';
import { useInstallPrompt } from '../../lib/install';
import { GymTabs } from './GymTabs';

export function GymHome() {
  const templates = useLiveQuery(() => db.templates.orderBy('order').filter((t) => !t.archived).toArray());
  const active = useActiveWorkout();
  const exMap = useExerciseMap();
  const installer = useInstallPrompt();
  const lastByTemplate = useLiveQuery(async () => {
    const map = new Map<string, number>();
    await db.workouts
      .where('status')
      .equals('done')
      .each((w) => {
        if (w.templateId && (map.get(w.templateId) ?? 0) < w.startedAt) map.set(w.templateId, w.startedAt);
      });
    return map;
  });

  // La prossima scheda della rotazione: quella dopo l'ultima fatta.
  let nextId: string | undefined;
  if (templates?.length && lastByTemplate?.size) {
    let lastIdx = -1;
    let lastTs = 0;
    templates.forEach((t, i) => {
      const ts = lastByTemplate.get(t.id) ?? 0;
      if (ts > lastTs) {
        lastTs = ts;
        lastIdx = i;
      }
    });
    if (lastIdx >= 0) nextId = templates[(lastIdx + 1) % templates.length].id;
  }

  async function start(t?: Template) {
    if (active) {
      if (confirm(`Hai già un allenamento in corso (${active.templateName}). Vuoi riprenderlo?`)) {
        navigate(`/pesi/workout/${active.id}`);
      }
      return;
    }
    const w = t ? await startWorkout(t) : await startEmptyWorkout();
    navigate(`/pesi/workout/${w.id}`);
  }

  return (
    <div className="page">
      <GymTabs active="/pesi" />

      {installer.canInstall && (
        <div className="install-banner">
          <span>Installa l'app sul telefono: icona nella home e funziona anche senza rete.</span>
          <div className="row gap">
            <button className="btn ghost small" onClick={installer.dismiss}>
              No grazie
            </button>
            <button className="btn primary small" onClick={() => void installer.install()}>
              Installa
            </button>
          </div>
        </div>
      )}

      {active && (
        <Link to={`/pesi/workout/${active.id}`} className="active-banner">
          <div>
            <strong>Allenamento in corso: {active.templateName}</strong>
            <span>Iniziato {fmtDuration(Date.now() - active.startedAt)} fa</span>
          </div>
          <span className="btn primary">Riprendi</span>
        </Link>
      )}

      {templates?.length === 0 && <p className="empty">Nessuna scheda. Creane una per iniziare.</p>}

      {templates?.map((t) => {
        const last = lastByTemplate?.get(t.id);
        return (
          <section key={t.id} className={`card template${t.id === nextId ? ' next' : ''}`}>
            <div className="template-head">
              <div>
                <h2>
                  {t.name}
                  {t.id === nextId && <span className="badge">Prossima</span>}
                </h2>
                <span className="muted">
                  {t.items.length} esercizi · {last ? `ultima volta ${daysAgo(last)}` : 'mai fatta'}
                </span>
              </div>
              <Link to={`/pesi/scheda/${t.id}`} className="btn ghost small">
                Modifica
              </Link>
            </div>
            <ol className="template-items">
              {t.items.map((it) => (
                <li key={it.id}>
                  <span>
                    {it.superset && <span className="badge small">{it.superset}</span>}
                    {exMap?.get(it.exerciseId)?.name ?? '?'}
                  </span>
                  <span className="muted nowrap">{summarizeSets(it.sets)}</span>
                </li>
              ))}
            </ol>
            <button className="btn primary block" onClick={() => start(t)}>
              Avvia workout
            </button>
          </section>
        );
      })}

      <div className="row gap">
        <Link to="/pesi/scheda/nuova" className="btn grow">
          + Nuova scheda
        </Link>
        <button className="btn grow" onClick={() => start()}>
          Allenamento libero
        </button>
      </div>
    </div>
  );
}
