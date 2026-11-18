import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CircleCheck, Pencil, Trash2 } from 'lucide-react';
import { db } from '../../db/db';
import { findPrevEntries, useExerciseMap, useSettings, type PrevEntry } from '../../db/repo';
import { Link, navigate } from '../../router';
import { fmtDate, fmtDuration, fmtNum } from '../../lib/format';
import { compareSet, entryVolume, equipmentOf, isLogged, matchPrevSet, setText, variantOf } from '../../lib/progress';
import { PageHeader } from '../../components/PageHeader';
import { DeleteWorkoutSheet } from '../../components/DeleteWorkoutSheet';
import { TrendIcon } from './WorkoutPage';

export function WorkoutDetail({ id, fresh }: { id: string; fresh: boolean }) {
  const w = useLiveQuery(async () => (await db.workouts.get(id)) ?? null, [id]);
  const exMap = useExerciseMap();
  const settings = useSettings();
  const [prev, setPrev] = useState<Record<string, PrevEntry | undefined>>({});
  const [deleting, setDeleting] = useState(false);

  const prevKey = w ? `${w.exerciseIds.join('|')}@${w.startedAt}` : '';
  useEffect(() => {
    if (!w) return;
    findPrevEntries(w.exerciseIds, w.startedAt, w.id).then(setPrev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prevKey]);

  // un workout ancora in corso si apre nella schermata di allenamento
  useEffect(() => {
    if (w?.status === 'active') navigate(`/pesi/workout/${w.id}`, { replace: true });
  }, [w]);

  if (w === undefined || !exMap) return <p className="page muted">Caricamento…</p>;
  if (w === null)
    return (
      <div className="page">
        <PageHeader title="Non trovato" back={{ to: '/pesi/storico', label: 'Storico' }} />
      </div>
    );
  if (w.status === 'active') return null;

  let up = 0;
  let down = 0;
  let totalVolume = 0;
  let totalSets = 0;

  const rows = w.entries.map((e) => {
    const ex = exMap.get(e.exerciseId);
    const group = equipmentOf(settings, ex);
    const variant = variantOf(group, e.variantId);
    const p = prev[e.exerciseId];
    const prevVariant = variantOf(group, p?.entry.variantId);
    const bodyweight = ex?.loadType === 'bodyweight';
    const sets = e.sets.filter(isLogged).map((s) => {
      const trend = compareSet(s, matchPrevSet(e.sets, e.sets.indexOf(s), p?.entry.sets), group, variant, prevVariant);
      if (trend === 'up') up++;
      if (trend === 'down') down++;
      return { s, trend };
    });
    totalSets += sets.length;
    const vol = entryVolume(e, ex, group);
    const prevVol = p ? entryVolume(p.entry, ex, group) : undefined;
    if (!bodyweight) totalVolume += vol;
    const delta = prevVol ? ((vol - prevVol) / prevVol) * 100 : undefined;
    return { e, ex, variant, bodyweight, sets, vol, delta };
  });


  const duration = w.finishedAt ? fmtDuration(w.finishedAt - w.startedAt) : '—';

  return (
    <div className="page">
      {fresh ? (
        <div className="done-hero">
          <div className="dh-ico">
            <CircleCheck size={34} />
          </div>
          <h1>Allenamento completato</h1>
          <p className="muted">
            {w.templateName} · {fmtDate(w.startedAt)}
          </p>
        </div>
      ) : (
        <PageHeader title={w.templateName} subtitle={fmtDate(w.startedAt)} back={{ to: '/pesi/storico', label: 'Storico' }} />
      )}

      <div className="stats-grid four">
        <div className="stat">
          <b>{duration}</b>
          <span>durata</span>
        </div>
        <div className="stat">
          <b>{totalSets}</b>
          <span>serie</span>
        </div>
        <div className="stat">
          <b>{fmtNum(Math.round(totalVolume))}</b>
          <span>kg di volume</span>
        </div>
        <div className="stat">
          <b className={up > 0 ? 'pos' : undefined}>{up + down > 0 ? up : '—'}</b>
          <span>serie migliorate</span>
        </div>
      </div>

      {fresh && up + down === 0 && (
        <p className="muted small" style={{ textAlign: 'center' }}>
          La prossima volta qui vedrai il confronto con questa sessione.
        </p>
      )}

      {rows.map(({ e, ex, variant, bodyweight, sets, vol, delta }) => (
        <section key={e.id} className="card">
          <div className="row between">
            <Link to={`/pesi/esercizi/${e.exerciseId}`} className="ex-name" style={{ fontSize: 16 }}>
              {e.superset && (
                <>
                  <span className="badge">{e.superset}</span>{' '}
                </>
              )}
              {ex?.name ?? 'Esercizio eliminato'}
            </Link>
            {variant && <span className="chip warning">{variant.name}</span>}
          </div>
          <div className="chips">
            {sets.map(({ s, trend }) => (
              <span key={s.id} className={`set-chip ${s.type}`}>
                {s.type === 'drop' ? '↳ ' : s.type === 'myo' ? 'myo ' : ''}
                {setText(s, bodyweight)}
                {trend && <TrendIcon trend={trend} size={12} />}
              </span>
            ))}
          </div>
          <p className="muted small">
            {bodyweight ? `${vol} ripetizioni totali` : `Volume ${fmtNum(Math.round(vol))} kg`}
            {delta !== undefined && Number.isFinite(delta) && Math.round(delta) !== 0 && (
              <span className={delta > 0 ? 'pos strong' : 'neg strong'}>
                {'  '}
                {delta > 0 ? '+' : ''}
                {fmtNum(Math.round(delta))}% vs volta prima
              </span>
            )}
          </p>
          {e.notes && <p className="note small text-2">{e.notes}</p>}
        </section>
      ))}

      {w.notes && (
        <section className="card">
          <h3>Note</h3>
          <p className="note text-2">{w.notes}</p>
        </section>
      )}

      {fresh && (
        <Link to="/pesi" className="btn btn-primary btn-lg btn-block">
          Torna alla home
        </Link>
      )}
      <div className="row">
        <Link to={`/pesi/workout/${w.id}`} className="btn grow">
          <Pencil size={16} /> Modifica
        </Link>
        <button className="btn btn-danger" onClick={() => setDeleting(true)}>
          <Trash2 size={16} /> Elimina
        </button>
      </div>
      {deleting && <DeleteWorkoutSheet workout={w} onClose={() => setDeleting(false)} />}
    </div>
  );
}
