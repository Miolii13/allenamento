import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDown, ArrowUp, BarChart3, ChevronRight, Trophy } from 'lucide-react';
import { db } from '../../db/db';
import { useExerciseMap, useSettings } from '../../db/repo';
import { Link } from '../../router';
import { fmtDateShort, fmtDuration, fmtNum } from '../../lib/format';
import { MUSCLE_LABEL } from '../../lib/muscles';
import {
  buckets,
  exerciseProgress,
  muscleSets,
  periodRange,
  periodSummaries,
  PERIODS,
  records,
  type PeriodKey,
} from '../../lib/stats';
import { BarChart } from '../../components/BarChart';
import { EmptyState, PageHeader } from '../../components/PageHeader';
import { GymTabs } from './GymTabs';

const compact = (v: number) => (v >= 1000 ? `${fmtNum(Math.round(v / 100) / 10)}k` : fmtNum(Math.round(v)));

/** Variazione rispetto al periodo precedente: freccia e testo, colore = direzione (più è meglio). */
function Delta({ cur, prev, pct }: { cur: number; prev: number | undefined; pct?: boolean }) {
  if (prev === undefined) return null;
  const diff = cur - prev;
  if (Math.abs(diff) < 1e-9) return <span className="muted xsmall">= periodo prima</span>;
  const up = diff > 0;
  const text = pct && prev ? `${fmtNum(Math.round((diff / prev) * 100))}%` : fmtNum(Math.round(Math.abs(diff) * 10) / 10);
  return (
    <span className={`delta ${up ? 'pos' : 'neg'}`}>
      {up ? <ArrowUp size={12} strokeWidth={3} /> : <ArrowDown size={12} strokeWidth={3} />}
      {pct ? text.replace('-', '') : text} vs prima
    </span>
  );
}

export function StatsPage() {
  const done = useLiveQuery(() => db.workouts.where('status').equals('done').toArray());
  const exMap = useExerciseMap();
  const settings = useSettings();
  const [period, setPeriod] = useState<PeriodKey>('3m');
  const [allProgress, setAllProgress] = useState(false);

  const stats = useMemo(() => {
    if (!done || !exMap) return null;
    const ctx = { exMap, settings };
    const range = periodRange(period, done);
    const { current, summary, previous } = periodSummaries(done, range, ctx, period);
    return {
      range,
      summary,
      previous,
      buckets: buckets(current, range, ctx),
      muscles: muscleSets(current, range.weeks, ctx),
      progress: exerciseProgress(done, range, ctx),
      records: records(done, range, ctx),
    };
  }, [done, exMap, settings, period]);

  const name = (id: string) => exMap?.get(id)?.name ?? 'Esercizio eliminato';
  const bucketWord = stats?.range.bucket === 'month' ? 'mese' : 'settimana';

  return (
    <div className="page">
      <PageHeader title="Statistiche" />
      <GymTabs active="/pesi/statistiche" />

      <div className="segmented">
        {PERIODS.map((p) => (
          <button key={p.key} className={period === p.key ? 'active' : undefined} onClick={() => setPeriod(p.key)}>
            {p.label}
          </button>
        ))}
      </div>

      {stats && stats.summary.count === 0 ? (
        <div className="card">
          <EmptyState
            icon={<BarChart3 size={26} />}
            title="Nessun allenamento nel periodo"
            text="Le statistiche si riempiono man mano che completi gli allenamenti."
          />
        </div>
      ) : (
        stats && (
          <>
            <div className="stats-grid">
              <div className="stat">
                <span>Allenamenti</span>
                <b>{stats.summary.count}</b>
                <span className="xsmall">{fmtNum(Math.round(stats.summary.perWeek * 10) / 10)} a settimana</span>
                <Delta cur={stats.summary.count} prev={stats.previous?.count} />
              </div>
              <div className="stat">
                <span>Volume</span>
                <b>
                  {compact(stats.summary.volume)} <small className="muted">kg</small>
                </b>
                <span className="xsmall">kg × ripetizioni</span>
                <Delta cur={stats.summary.volume} prev={stats.previous?.volume} pct />
              </div>
              <div className="stat">
                <span>Serie</span>
                <b>{stats.summary.sets}</b>
                <span className="xsmall">{fmtNum(Math.round((stats.summary.sets / stats.range.weeks) * 10) / 10)} a settimana</span>
                <Delta cur={stats.summary.sets} prev={stats.previous?.sets} />
              </div>
              <div className="stat">
                <span>Durata media</span>
                <b>{stats.summary.avgDuration ? fmtDuration(stats.summary.avgDuration) : '—'}</b>
                <span className="xsmall">per allenamento</span>
              </div>
            </div>

            <section className="card">
              <div className="stack-s">
                <h3>Volume per {bucketWord}</h3>
                <p className="muted small">Kg sollevati × ripetizioni. Tocca una barra per i dettagli.</p>
              </div>
              <BarChart
                format={compact}
                data={stats.buckets.map((b) => ({
                  label: b.label,
                  title: b.title,
                  value: Math.round(b.volume),
                  detail: `${b.count} ${b.count === 1 ? 'allenamento' : 'allenamenti'} · ${b.sets} serie`,
                }))}
              />
            </section>

            {stats.muscles.length > 0 && (
              <section className="card">
                <div className="stack-s">
                  <h3>Serie a settimana per muscolo</h3>
                  <p className="muted small">Media nel periodo, contando le serie principali (esclusi drop e mini-serie myo).</p>
                </div>
                <div className="meter-list">
                  {stats.muscles.map((mu) => (
                    <div key={mu.muscle} className="meter">
                      <span className="m-name">{MUSCLE_LABEL[mu.muscle]}</span>
                      <span className="m-track">
                        <span className="m-fill" style={{ width: `${(mu.perWeek / stats.muscles[0].perWeek) * 100}%` }} />
                      </span>
                      <span className="m-val tnum">{fmtNum(Math.round(mu.perWeek * 10) / 10)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="section">
              <div className="section-title">
                <h2>Record nel periodo</h2>
                <span className="muted small">{stats.records.length}</span>
              </div>
              {stats.records.length === 0 ? (
                <p className="muted small">Nessun nuovo record nel periodo: arriveranno quando supererai i tuoi massimi.</p>
              ) : (
                <div className="card flush">
                  {stats.records.slice(0, 8).map((r) => (
                    <Link key={r.exerciseId} to={`/pesi/esercizi/${r.exerciseId}`} className="list-row">
                      <span className="tile-icon gold">
                        <Trophy size={18} />
                      </span>
                      <span className="lr-body">
                        <span className="lr-title">{name(r.exerciseId)}</span>
                        <span className="lr-sub">
                          {r.bodyweight
                            ? `${r.value} ripetizioni totali (prima ${r.previous})`
                            : `1RM stimato ${fmtNum(Math.round(r.value * 10) / 10)} kg (prima ${fmtNum(Math.round(r.previous * 10) / 10)})`}
                        </span>
                      </span>
                      <span className="lr-trail">{fmtDateShort(r.ts)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="section">
              <div className="section-title">
                <h2>Progressi per esercizio</h2>
              </div>
              {stats.progress.length === 0 ? (
                <p className="muted small">Servono almeno 2 sessioni dello stesso esercizio nel periodo.</p>
              ) : (
                <>
                  <div className="card flush">
                    {(allProgress ? stats.progress : stats.progress.slice(0, 6)).map((p) => {
                      const pct = Math.round(p.delta * 100);
                      return (
                        <Link key={p.exerciseId} to={`/pesi/esercizi/${p.exerciseId}`} className="list-row">
                          <span className="lr-body">
                            <span className="lr-title">{name(p.exerciseId)}</span>
                            <span className="lr-sub tnum">
                              {p.bodyweight
                                ? `${p.first} → ${p.last} ripetizioni`
                                : `1RM ${fmtNum(Math.round(p.first * 10) / 10)} → ${fmtNum(Math.round(p.last * 10) / 10)} kg`}{' '}
                              · {p.sessions} sessioni
                            </span>
                          </span>
                          <span className={`chip ${pct > 0 ? 'success' : pct < 0 ? 'danger' : ''}`}>
                            {pct > 0 ? '+' : ''}
                            {pct}%
                          </span>
                          <ChevronRight size={18} className="chev" />
                        </Link>
                      );
                    })}
                  </div>
                  {stats.progress.length > 6 && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setAllProgress((v) => !v)}>
                      {allProgress ? 'Mostra meno' : `Mostra tutti (${stats.progress.length})`}
                    </button>
                  )}
                </>
              )}
            </section>
          </>
        )
      )}
    </div>
  );
}
