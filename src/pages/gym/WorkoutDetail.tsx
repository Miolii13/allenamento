import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { findPrevEntries, useExerciseMap, useSettings, type PrevEntry } from '../../db/repo';
import { Link, navigate } from '../../router';
import { fmtDate, fmtDuration, fmtNum } from '../../lib/format';
import { compareSet, entryVolume, equipmentOf, isLogged, matchPrevSet, setText, variantOf } from '../../lib/progress';
import { TREND_ICON } from './WorkoutPage';

export function WorkoutDetail({ id, fresh }: { id: string; fresh: boolean }) {
  const w = useLiveQuery(async () => (await db.workouts.get(id)) ?? null, [id]);
  const exMap = useExerciseMap();
  const settings = useSettings();
  const [prev, setPrev] = useState<Record<string, PrevEntry | undefined>>({});

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
        <p>Allenamento non trovato.</p>
        <Link to="/pesi/storico">Torna allo storico</Link>
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

  async function remove() {
    if (!confirm('Eliminare questo allenamento dallo storico? Non si può annullare.')) return;
    await db.workouts.delete(id);
    navigate('/pesi/storico', { replace: true });
  }

  return (
    <div className="page">
      <header className="page-head">
        <Link to="/pesi/storico" className="back">
          ‹ Storico
        </Link>
        <h1>{w.templateName}</h1>
        <span className="muted">
          {fmtDate(w.startedAt)}
          {w.finishedAt ? ` · ${fmtDuration(w.finishedAt - w.startedAt)}` : ''}
        </span>
      </header>

      {fresh && (
        <div className="card success">
          <strong>Allenamento salvato.</strong>
          <span>
            {up + down > 0
              ? `Rispetto alla volta prima: ${up} ${up === 1 ? 'serie migliorata' : 'serie migliorate'}, ${down} in calo.`
              : 'La prossima volta qui vedrai il confronto con questa sessione.'}
          </span>
        </div>
      )}

      <div className="stats">
        <div>
          <b>{w.entries.length}</b>
          <span>esercizi</span>
        </div>
        <div>
          <b>{totalSets}</b>
          <span>serie</span>
        </div>
        <div>
          <b>{fmtNum(Math.round(totalVolume))}</b>
          <span>kg volume</span>
        </div>
      </div>

      {rows.map(({ e, ex, variant, bodyweight, sets, vol, delta }) => (
        <section key={e.id} className="card">
          <div className="entry-head">
            <Link to={`/pesi/esercizi/${e.exerciseId}`} className="entry-name">
              {e.superset && <span className="badge small">{e.superset}</span>}
              {ex?.name ?? 'Esercizio eliminato'}
            </Link>
            {variant && <span className="tag accent">{variant.name}</span>}
          </div>
          <div className="chips">
            {sets.map(({ s, trend }) => (
              <span key={s.id} className={`chip ${s.type}${trend ? ` trend-${trend}` : ''}`}>
                {s.type === 'drop' ? '↳ ' : s.type === 'myo' ? 'myo ' : ''}
                {setText(s, bodyweight)}
                {trend && <b>{TREND_ICON[trend]}</b>}
              </span>
            ))}
          </div>
          <p className="muted small">
            {bodyweight ? `${vol} ripetizioni totali` : `Volume ${fmtNum(Math.round(vol))} kg`}
            {delta !== undefined && Number.isFinite(delta) && (
              <span className={delta > 0 ? 'pos' : delta < 0 ? 'neg' : ''}>
                {' '}
                ({delta > 0 ? '+' : ''}
                {fmtNum(Math.round(delta))}% vs volta prima)
              </span>
            )}
          </p>
          {e.notes && <p className="note">{e.notes}</p>}
        </section>
      ))}

      {w.notes && (
        <section className="card">
          <h3>Note</h3>
          <p className="note">{w.notes}</p>
        </section>
      )}

      <div className="row gap">
        <Link to={`/pesi/workout/${w.id}`} className="btn grow">
          Modifica
        </Link>
        <button className="btn danger-text" onClick={remove}>
          Elimina
        </button>
      </div>
    </div>
  );
}
