import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, Clock, Download, Layers, ListChecks, Pencil, Play, Plus, Sparkles, Zap } from 'lucide-react';
import { db } from '../../db/db';
import { startEmptyWorkout, startWorkout, useActiveWorkout, useExerciseMap } from '../../db/repo';
import type { Template, Workout } from '../../db/types';
import { Link, navigate } from '../../router';
import { daysAgo, fmtDuration, summarizeSets } from '../../lib/format';
import { isLogged } from '../../lib/progress';
import { useInstallPrompt } from '../../lib/install';
import { PageHeader, EmptyState } from '../../components/PageHeader';
import { Sheet } from '../../components/Sheet';
import { GymTabs } from './GymTabs';

const todayFmt = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
const DAY_LETTERS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Sigla della scheda: "Upper 1" -> "U1", "Lower" -> "L". */
export function initials(name: string): string {
  const s = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (/^\d+$/.test(w) ? w : w[0].toUpperCase()))
    .join('');
  return s.slice(0, 3) || '?';
}

function startOfWeek(d = new Date()): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // lunedì = 0
  x.setDate(x.getDate() - dow);
  return x;
}

interface TemplateStats {
  last: number;
  lastDuration?: number;
}

export function GymHome() {
  const templates = useLiveQuery(() => db.templates.orderBy('order').filter((t) => !t.archived).toArray());
  const active = useActiveWorkout();
  const exMap = useExerciseMap();
  const installer = useInstallPrompt();
  const [preview, setPreview] = useState<Template | null>(null);

  const data = useLiveQuery(async () => {
    const byTemplate = new Map<string, TemplateStats>();
    const done: Workout[] = await db.workouts.where('status').equals('done').toArray();
    for (const w of done) {
      if (!w.templateId) continue;
      const cur = byTemplate.get(w.templateId);
      if (!cur || cur.last < w.startedAt) {
        const dur = w.finishedAt ? w.finishedAt - w.startedAt : undefined;
        byTemplate.set(w.templateId, { last: w.startedAt, lastDuration: dur && dur > 5 * 60000 ? dur : undefined });
      }
    }
    const weekStart = startOfWeek().getTime();
    const weekDays = new Set(
      done.filter((w) => w.startedAt >= weekStart).map((w) => Math.floor((w.startedAt - weekStart) / 86400000)),
    );
    return { byTemplate, weekDays, weekCount: done.filter((w) => w.startedAt >= weekStart).length };
  });

  // Prossima scheda della rotazione: quella dopo l'ultima fatta (o la prima, se non ne hai mai fatte).
  let next: Template | undefined = templates?.[0];
  if (templates?.length && data?.byTemplate.size) {
    let lastIdx = -1;
    let lastTs = 0;
    templates.forEach((t, i) => {
      const ts = data.byTemplate.get(t.id)?.last ?? 0;
      if (ts > lastTs) {
        lastTs = ts;
        lastIdx = i;
      }
    });
    if (lastIdx >= 0) next = templates[(lastIdx + 1) % templates.length];
  }

  async function start(t?: Template) {
    if (active) {
      navigate(`/pesi/workout/${active.id}`);
      return;
    }
    const w = t ? await startWorkout(t) : await startEmptyWorkout();
    navigate(`/pesi/workout/${w.id}`);
  }

  const setsOf = (t: Template) => t.items.reduce((n, it) => n + it.sets.length, 0);
  const weekStart = startOfWeek();
  const todayIdx = Math.floor((Date.now() - weekStart.getTime()) / 86400000);

  return (
    <div className="page">
      <PageHeader title="Sala pesi" subtitle={capitalize(todayFmt.format(new Date()))} />
      <GymTabs active="/pesi" />

      {installer.canInstall && (
        <div className="banner accent">
          <Download size={20} />
          <div className="grow stack-s">
            <span>Installa l'app: icona nella home e funziona anche senza rete.</span>
            <div className="row">
              <button className="btn btn-primary btn-sm" onClick={() => void installer.install()}>
                Installa
              </button>
              <button className="btn btn-ghost btn-sm" onClick={installer.dismiss}>
                No grazie
              </button>
            </div>
          </div>
        </div>
      )}

      {active ? (
        <div className="hero resume">
          <div className="hero-kicker">
            <Zap size={14} /> Allenamento in corso
          </div>
          <h2>{active.templateName}</h2>
          <div className="hero-meta">
            <span>
              <Clock size={15} /> {fmtDuration(Date.now() - active.startedAt)}
            </span>
            <span>
              <Layers size={15} />
              {active.entries.reduce((n, e) => n + e.sets.filter(isLogged).length, 0)} /{' '}
              {active.entries.reduce((n, e) => n + e.sets.length, 0)} serie
            </span>
          </div>
          <button className="btn btn-lg btn-block" onClick={() => navigate(`/pesi/workout/${active.id}`)}>
            <Play size={18} fill="currentColor" /> Riprendi
          </button>
        </div>
      ) : (
        next && (
          <div className="hero">
            <div className="hero-kicker">
              <Sparkles size={14} /> {data?.byTemplate.size ? 'Prossimo allenamento' : 'Inizia da qui'}
            </div>
            <h2>{next.name}</h2>
            <div className="hero-meta">
              <span>
                <ListChecks size={15} /> {next.items.length} esercizi
              </span>
              <span>
                <Layers size={15} /> {setsOf(next)} serie
              </span>
              {data?.byTemplate.get(next.id)?.lastDuration && (
                <span>
                  <Clock size={15} /> ~{fmtDuration(data.byTemplate.get(next.id)!.lastDuration!)}
                </span>
              )}
            </div>
            <button className="btn btn-lg btn-block" onClick={() => start(next)}>
              <Play size={18} fill="currentColor" /> Inizia allenamento
            </button>
          </div>
        )
      )}

      <section className="section">
        <div className="section-title">
          <h2>Questa settimana</h2>
          <span className="muted small">
            {data?.weekCount ?? 0} {data?.weekCount === 1 ? 'allenamento' : 'allenamenti'}
          </span>
        </div>
        <div className="card">
          <div className="week">
            {DAY_LETTERS.map((letter, i) => {
              const day = new Date(weekStart);
              day.setDate(day.getDate() + i);
              const done = data?.weekDays.has(i);
              return (
                <div key={i} className={`day${done ? ' done' : ''}${i === todayIdx ? ' today' : ''}`}>
                  <span>{letter}</span>
                  <span className="dot">{day.getDate()}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-title">
          <h2>Le tue schede</h2>
          <Link to="/pesi/scheda/nuova" className="link">
            + Nuova
          </Link>
        </div>
        {templates?.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={<ListChecks size={26} />}
              title="Nessuna scheda"
              text="Crea una scheda con i tuoi esercizi per iniziare ad allenarti."
              action={
                <Link to="/pesi/scheda/nuova" className="btn btn-primary">
                  Crea scheda
                </Link>
              }
            />
          </div>
        ) : (
          <div className="card flush">
            {templates?.map((t) => {
              const last = data?.byTemplate.get(t.id)?.last;
              return (
                <button key={t.id} className="list-row" onClick={() => setPreview(t)}>
                  <span className="tile-icon">{initials(t.name)}</span>
                  <span className="lr-body">
                    <span className="lr-title">{t.name}</span>
                    <span className="lr-sub">
                      {t.items.length} esercizi · {last ? daysAgo(last) : 'mai fatta'}
                    </span>
                  </span>
                  {t.id === next?.id && !active && <span className="chip accent">Prossima</span>}
                  <ChevronRight size={18} className="chev" />
                </button>
              );
            })}
          </div>
        )}
        <button className="btn btn-block" onClick={() => start()}>
          <Plus size={18} /> Allenamento libero
        </button>
      </section>

      {preview && (
        <Sheet
          title={preview.name}
          onClose={() => setPreview(null)}
          footer={
            <>
              <button className="btn btn-primary btn-lg btn-block" onClick={() => start(preview)}>
                <Play size={18} fill="currentColor" /> {active ? 'Riprendi allenamento in corso' : 'Inizia allenamento'}
              </button>
              <Link to={`/pesi/scheda/${preview.id}`} className="btn btn-block">
                <Pencil size={16} /> Modifica scheda
              </Link>
            </>
          }
        >
          <p className="muted small">
            {preview.items.length} esercizi · {setsOf(preview)} serie
          </p>
          <ol className="plain-list template-preview">
            {preview.items.map((it, i) => (
              <li key={it.id}>
                <span className="tp-n">{i + 1}</span>
                <span className="grow stack-s">
                  <span className="strong">
                    {exMap?.get(it.exerciseId)?.name ?? '?'}
                    {it.superset && (
                      <>
                        {' '}
                        <span className="badge">{it.superset}</span>
                      </>
                    )}
                  </span>
                  <span className="muted small">{summarizeSets(it.sets)}</span>
                </span>
              </li>
            ))}
          </ol>
        </Sheet>
      )}
    </div>
  );
}
