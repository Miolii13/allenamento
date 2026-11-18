import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Coffee,
  Download,
  Footprints,
  Layers,
  ListChecks,
  Pencil,
  Play,
  Plus,
  Sparkles,
  Zap,
} from 'lucide-react';
import { db } from '../../db/db';
import { startEmptyWorkout, startWorkout, useActiveWorkout, useExerciseMap, useSettings } from '../../db/repo';
import type { Template, Workout } from '../../db/types';
import { Link, navigate } from '../../router';
import { daysAgo, fmtDuration, summarizeSets } from '../../lib/format';
import { isLogged } from '../../lib/progress';
import { useInstallPrompt } from '../../lib/install';
import { initials, usePrograms } from '../../lib/programs';
import { activeSplit, DAY_LETTERS, planLabel, splitsOf, startOfDay, startOfWeek, weekdayIndex, WEEKDAYS } from '../../lib/weekPlan';
import { PageHeader, EmptyState } from '../../components/PageHeader';
import { Sheet } from '../../components/Sheet';
import { SplitChooserSheet } from '../../components/Splits';
import { DeleteWorkoutSheet } from '../../components/DeleteWorkoutSheet';
import { GymTabs } from './GymTabs';

export { initials };

const todayFmt = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface TemplateStats {
  last: number;
  lastDuration?: number;
}

export function GymHome() {
  const programs = usePrograms();
  const active = useActiveWorkout();
  const exMap = useExerciseMap();
  const settings = useSettings();
  const installer = useInstallPrompt();
  const [preview, setPreview] = useState<Template | null>(null);
  const [chooseSplit, setChooseSplit] = useState(false);
  const [cancelActive, setCancelActive] = useState(false);

  const data = useLiveQuery(async () => {
    const byTemplate = new Map<string, TemplateStats>();
    const done: Workout[] = await db.workouts.where('status').equals('done').toArray();
    let lastDone: Workout | undefined;
    for (const w of done) {
      if (!w.templateId) continue;
      if (!lastDone || lastDone.startedAt < w.startedAt) lastDone = w;
      const cur = byTemplate.get(w.templateId);
      if (!cur || cur.last < w.startedAt) {
        const dur = w.finishedAt ? w.finishedAt - w.startedAt : undefined;
        byTemplate.set(w.templateId, { last: w.startedAt, lastDuration: dur && dur > 5 * 60000 ? dur : undefined });
      }
    }
    const weekStart = startOfWeek().getTime();
    const thisWeek = done.filter((w) => w.startedAt >= weekStart);
    const weekDays = new Set(thisWeek.map((w) => Math.floor((w.startedAt - weekStart) / 86400000)));
    const today = done.filter((w) => w.startedAt >= startOfDay()).sort((a, b) => b.startedAt - a.startedAt);
    return { byTemplate, weekDays, weekCount: thisWeek.length, today, lastDone };
  });

  const templates = programs?.flatMap((p) => p.templates);
  const split = activeSplit(settings);
  const splits = splitsOf(settings);
  const planned = !!split?.days.some((p) => p.kind !== 'rest');
  const today = weekdayIndex();
  const todayPlan = planned ? split!.days[today] : undefined;
  const tomorrowPlan = planned ? split!.days[(today + 1) % 7] : undefined;
  const todayTemplate = todayPlan?.kind === 'gym' ? templates?.find((t) => t.id === todayPlan.templateId) : undefined;
  const todayDone = todayTemplate ? data?.today.find((w) => w.templateId === todayTemplate.id) : undefined;

  // Senza split: l'allenamento dopo l'ultimo fatto, nella stessa scheda.
  let next: Template | undefined;
  if (programs?.length) {
    const lastId = data?.lastDone?.templateId;
    const prog = programs.find((p) => p.templates.some((t) => t.id === lastId)) ?? programs.find((p) => p.templates.length);
    if (prog) {
      const i = prog.templates.findIndex((t) => t.id === lastId);
      next = prog.templates[(i + 1) % prog.templates.length];
    }
  }
  const highlighted = planned ? todayTemplate : next;

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
  const tomorrowText = planned ? `Domani: ${planLabel(tomorrowPlan, templates)}` : undefined;
  const scrollToTemplates = () => document.getElementById('schede')?.scrollIntoView({ behavior: 'smooth' });

  const templateMeta = (t: Template) => (
    <div className="hero-meta">
      <span>
        <ListChecks size={15} /> {t.items.length} esercizi
      </span>
      <span>
        <Layers size={15} /> {setsOf(t)} serie
      </span>
      {data?.byTemplate.get(t.id)?.lastDuration && (
        <span>
          <Clock size={15} /> ~{fmtDuration(data.byTemplate.get(t.id)!.lastDuration!)}
        </span>
      )}
    </div>
  );

  let hero: JSX.Element | null = null;
  if (active) {
    hero = (
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
        <button className="hero-cancel" onClick={() => setCancelActive(true)}>
          Annulla allenamento
        </button>
      </div>
    );
  } else if (planned && todayDone) {
    hero = (
      <div className="hero resume">
        <div className="hero-kicker">
          <Check size={14} strokeWidth={3} /> Oggi · fatto
        </div>
        <h2>{todayDone.templateName}</h2>
        <div className="hero-meta">
          <span>{tomorrowText}</span>
        </div>
        <Link to={`/pesi/storico/${todayDone.id}`} className="btn btn-lg btn-block">
          Vedi riepilogo
        </Link>
      </div>
    );
  } else if (planned && todayTemplate) {
    hero = (
      <div className="hero">
        <div className="hero-kicker">
          <CalendarDays size={14} /> Oggi · {WEEKDAYS[today]}
        </div>
        <h2>{todayTemplate.name}</h2>
        {templateMeta(todayTemplate)}
        <button className="btn btn-lg btn-block" onClick={() => start(todayTemplate)}>
          <Play size={18} fill="currentColor" /> Inizia allenamento
        </button>
      </div>
    );
  } else if (planned) {
    const run = todayPlan?.kind === 'run';
    hero = (
      <div className={`hero ${run ? 'run' : 'rest'}`}>
        <div className="hero-kicker">
          {run ? <Footprints size={14} /> : <Coffee size={14} />} Oggi · {WEEKDAYS[today]}
        </div>
        <h2>{run ? 'Corsa' : 'Riposo'}</h2>
        <div className="hero-meta">
          <span>{run ? 'La sezione corsa arriverà presto.' : 'Recupera bene.'}</span>
          <span>{tomorrowText}</span>
        </div>
        <button className="btn btn-block" onClick={scrollToTemplates}>
          Allenati comunque in sala pesi
        </button>
      </div>
    );
  } else if (next) {
    hero = (
      <div className="hero">
        <div className="hero-kicker">
          <Sparkles size={14} /> {data?.byTemplate.size ? 'Prossimo allenamento' : 'Inizia da qui'}
        </div>
        <h2>{next.name}</h2>
        {templateMeta(next)}
        <button className="btn btn-lg btn-block" onClick={() => start(next)}>
          <Play size={18} fill="currentColor" /> Inizia allenamento
        </button>
      </div>
    );
  }

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

      {hero}

      <section className="section">
        <div className="section-title">
          <h2>Questa settimana</h2>
          {splits.length > 0 ? (
            <button className="split-chip" onClick={() => setChooseSplit(true)} aria-label="Cambia split di questa settimana">
              {split?.name} <ChevronDown size={14} />
            </button>
          ) : (
            <Link to="/impostazioni/split/nuova" className="link">
              Crea split
            </Link>
          )}
        </div>
        <div className="card">
          <div className="week">
            {DAY_LETTERS.map((letter, i) => {
              const day = new Date(weekStart);
              day.setDate(day.getDate() + i);
              const done = data?.weekDays.has(i);
              const p = planned ? split!.days[i] : undefined;
              const t = p?.kind === 'gym' ? templates?.find((x) => x.id === p.templateId) : undefined;
              return (
                <div key={i} className={`day${done ? ' done' : ''}${i === today ? ' today' : ''}`}>
                  <span>{letter}</span>
                  <span className="dot">{day.getDate()}</span>
                  {planned && (
                    <span className={`plan ${p?.kind ?? 'rest'}`}>
                      {p?.kind === 'gym' ? initials(t?.name ?? '?') : p?.kind === 'run' ? <Footprints size={13} /> : '–'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {planned ? (
            <p className="muted small">
              {data?.weekCount ?? 0} {data?.weekCount === 1 ? 'allenamento fatto' : 'allenamenti fatti'} su{' '}
              {split!.days.filter((p) => p.kind === 'gym').length} in sala pesi questa settimana
            </p>
          ) : (
            <Link to="/impostazioni/split/nuova" className="banner accent" style={{ textDecoration: 'none' }}>
              <CalendarDays size={18} />
              <span>Crea una split settimanale: aprendo l'app vedrai subito l'allenamento del giorno.</span>
            </Link>
          )}
        </div>
      </section>

      <section className="section" id="schede">
        <div className="section-title">
          <h2>Le tue schede</h2>
          <Link to="/pesi/scheda/nuova" className="link">
            + Nuova scheda
          </Link>
        </div>
        {programs?.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={<ListChecks size={26} />}
              title="Nessuna scheda"
              text="Una scheda raccoglie gli allenamenti che fai a rotazione, ognuno con i suoi esercizi."
              action={
                <Link to="/pesi/scheda/nuova" className="btn btn-primary">
                  Crea scheda
                </Link>
              }
            />
          </div>
        ) : (
          programs?.map(({ program, templates: days }) => (
            <div key={program.id} className="card flush program-card">
              <div className="program-head">
                <span className="lr-body">
                  <span className="program-name">{program.name}</span>
                  <span className="lr-sub">
                    {days.length} {days.length === 1 ? 'allenamento' : 'allenamenti'}
                  </span>
                </span>
                <Link to={`/pesi/scheda/${program.id}`} className="btn btn-sm">
                  <Pencil size={14} /> Modifica
                </Link>
              </div>
              {days.map((t) => {
                const last = data?.byTemplate.get(t.id)?.last;
                return (
                  <button key={t.id} className="list-row" onClick={() => setPreview(t)}>
                    <span className="tile-icon">{initials(t.name)}</span>
                    <span className="lr-body">
                      <span className="lr-title">{t.name}</span>
                      <span className="lr-sub">
                        {t.items.length} esercizi · {last ? daysAgo(last) : 'mai fatto'}
                      </span>
                    </span>
                    {t.id === highlighted?.id && !active && <span className="chip accent">{planned ? 'Oggi' : 'Prossimo'}</span>}
                    <ChevronRight size={18} className="chev" />
                  </button>
                );
              })}
              {days.length === 0 && (
                <Link to={`/pesi/allenamento/nuovo?scheda=${program.id}`} className="list-row">
                  <span className="tile-icon">
                    <Plus size={18} />
                  </span>
                  <span className="lr-body">
                    <span className="lr-title">Aggiungi il primo allenamento</span>
                  </span>
                </Link>
              )}
            </div>
          ))
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
              <Link to={`/pesi/allenamento/${preview.id}`} className="btn btn-block">
                <Pencil size={16} /> Modifica allenamento
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

      {chooseSplit && <SplitChooserSheet onClose={() => setChooseSplit(false)} />}
      {cancelActive && active && <DeleteWorkoutSheet workout={active} onClose={() => setCancelActive(false)} />}
    </div>
  );
}
