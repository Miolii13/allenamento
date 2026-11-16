import type { Exercise, MuscleGroup, Settings, Workout, WorkoutEntry } from '../db/types';
import { bestE1RM, entryVolume, equipmentOf, isLogged } from './progress';
import { muscleOf } from './muscles';
import { startOfWeek } from './weekPlan';

export type PeriodKey = '4w' | '3m' | '1y' | 'all';
export const PERIODS: { key: PeriodKey; label: string; weeks: number | null }[] = [
  { key: '4w', label: '4 sett.', weeks: 4 },
  { key: '3m', label: '3 mesi', weeks: 13 },
  { key: '1y', label: '1 anno', weeks: 52 },
  { key: 'all', label: 'Tutto', weeks: null },
];

const WEEK = 7 * 86400000;

export interface Ctx {
  exMap: Map<string, Exercise>;
  settings: Settings | undefined;
}

export interface Range {
  from: number;
  to: number;
  weeks: number;
  bucket: 'week' | 'month';
}

export function periodRange(key: PeriodKey, done: Workout[]): Range {
  const to = Date.now();
  const thisWeek = startOfWeek().getTime();
  const p = PERIODS.find((x) => x.key === key)!;
  let from: number;
  if (p.weeks) from = thisWeek - (p.weeks - 1) * WEEK;
  else {
    const first = done.reduce((m, w) => Math.min(m, w.startedAt), to);
    from = startOfWeek(new Date(first)).getTime();
  }
  const weeks = Math.max(1, Math.ceil((to - from) / WEEK));
  return { from, to, weeks, bucket: weeks > 26 ? 'month' : 'week' };
}

const inRange = (w: Workout, from: number, to: number) => w.startedAt >= from && w.startedAt < to;

function workoutVolume(w: Workout, ctx: Ctx): number {
  return w.entries.reduce((v, e) => {
    const ex = ctx.exMap.get(e.exerciseId);
    return ex?.loadType === 'bodyweight' ? v : v + entryVolume(e, ex, equipmentOf(ctx.settings, ex));
  }, 0);
}

const loggedSets = (w: Workout) => w.entries.reduce((n, e) => n + e.sets.filter(isLogged).length, 0);

export interface Summary {
  count: number;
  volume: number;
  sets: number;
  avgDuration?: number;
  perWeek: number;
}

export function summarize(ws: Workout[], weeks: number, ctx: Ctx): Summary {
  const durations = ws.map((w) => (w.finishedAt ? w.finishedAt - w.startedAt : 0)).filter((d) => d > 5 * 60000);
  return {
    count: ws.length,
    volume: ws.reduce((v, w) => v + workoutVolume(w, ctx), 0),
    sets: ws.reduce((n, w) => n + loggedSets(w), 0),
    avgDuration: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : undefined,
    perWeek: ws.length / weeks,
  };
}

/** Statistiche del periodo e del periodo precedente di uguale durata (per i confronti). */
export function periodSummaries(done: Workout[], range: Range, ctx: Ctx, key: PeriodKey) {
  const current = done.filter((w) => inRange(w, range.from, range.to));
  const prevFrom = range.from - range.weeks * WEEK;
  const previous = key === 'all' ? undefined : done.filter((w) => inRange(w, prevFrom, range.from));
  return {
    current,
    summary: summarize(current, range.weeks, ctx),
    previous: previous && previous.length ? summarize(previous, range.weeks, ctx) : undefined,
  };
}

export interface Bucket {
  start: number;
  label: string;
  title: string;
  volume: number;
  count: number;
  sets: number;
}

const dm = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' });
const mon = new Intl.DateTimeFormat('it-IT', { month: 'short' });
const monY = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' });

export function buckets(ws: Workout[], range: Range, ctx: Ctx): Bucket[] {
  const out: Bucket[] = [];
  if (range.bucket === 'week') {
    for (let s = range.from; s < range.to; s += WEEK) {
      out.push({ start: s, label: dm.format(s), title: `Settimana del ${dm.format(s)}`, volume: 0, count: 0, sets: 0 });
    }
  } else {
    const d = new Date(range.from);
    let cur = new Date(d.getFullYear(), d.getMonth(), 1);
    while (cur.getTime() < range.to) {
      out.push({ start: cur.getTime(), label: mon.format(cur), title: monY.format(cur), volume: 0, count: 0, sets: 0 });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
  }
  for (const w of ws) {
    let i = out.length - 1;
    while (i > 0 && out[i].start > w.startedAt) i--;
    const b = out[i];
    if (!b) continue;
    b.count++;
    b.sets += loggedSets(w);
    b.volume += workoutVolume(w, ctx);
  }
  return out;
}

/** Serie "vere" (escluse drop e mini-serie myo) a settimana per muscolo, dalla più allenata. */
export function muscleSets(ws: Workout[], weeks: number, ctx: Ctx): { muscle: MuscleGroup; perWeek: number; total: number }[] {
  const totals = new Map<MuscleGroup, number>();
  for (const w of ws)
    for (const e of w.entries) {
      const n = e.sets.filter((s) => s.type === 'work' && isLogged(s)).length;
      if (!n) continue;
      const m = muscleOf(ctx.exMap.get(e.exerciseId));
      totals.set(m, (totals.get(m) ?? 0) + n);
    }
  return [...totals.entries()].map(([muscle, total]) => ({ muscle, total, perWeek: total / weeks })).sort((a, b) => b.total - a.total);
}

/** Valore di riferimento di una sessione: 1RM stimato (kg) o, a corpo libero, ripetizioni totali. */
function sessionMetric(e: WorkoutEntry, ctx: Ctx): number | undefined {
  const ex = ctx.exMap.get(e.exerciseId);
  if (ex?.loadType === 'bodyweight') {
    const reps = e.sets.filter(isLogged).reduce((n, s) => n + s.reps!, 0);
    return reps || undefined;
  }
  return bestE1RM(e, equipmentOf(ctx.settings, ex));
}

interface Session {
  ts: number;
  workoutId: string;
  value: number;
}

function sessionsByExercise(done: Workout[], ctx: Ctx): Map<string, Session[]> {
  const map = new Map<string, Session[]>();
  for (const w of [...done].sort((a, b) => a.startedAt - b.startedAt))
    for (const e of w.entries) {
      const v = sessionMetric(e, ctx);
      if (v === undefined) continue;
      const list = map.get(e.exerciseId) ?? [];
      list.push({ ts: w.startedAt, workoutId: w.id, value: v });
      map.set(e.exerciseId, list);
    }
  return map;
}

export interface ExerciseProgress {
  exerciseId: string;
  first: number;
  last: number;
  delta: number;
  sessions: number;
  bodyweight: boolean;
}

/** Variazione dalla prima all'ultima sessione del periodo, per gli esercizi fatti almeno 2 volte. */
export function exerciseProgress(done: Workout[], range: Range, ctx: Ctx): ExerciseProgress[] {
  const out: ExerciseProgress[] = [];
  for (const [exerciseId, list] of sessionsByExercise(done, ctx)) {
    const inPeriod = list.filter((s) => s.ts >= range.from && s.ts < range.to);
    if (inPeriod.length < 2) continue;
    const first = inPeriod[0].value;
    const last = inPeriod[inPeriod.length - 1].value;
    out.push({
      exerciseId,
      first,
      last,
      delta: first ? (last - first) / first : 0,
      sessions: inPeriod.length,
      bodyweight: ctx.exMap.get(exerciseId)?.loadType === 'bodyweight',
    });
  }
  return out.sort((a, b) => b.delta - a.delta);
}

export interface PersonalRecord {
  exerciseId: string;
  value: number;
  previous: number;
  ts: number;
  workoutId: string;
  bodyweight: boolean;
}

/** Record battuti nel periodo (rispetto a tutto ciò che c'era prima), il più recente per esercizio. */
export function records(done: Workout[], range: Range, ctx: Ctx): PersonalRecord[] {
  const out: PersonalRecord[] = [];
  for (const [exerciseId, list] of sessionsByExercise(done, ctx)) {
    let best: number | undefined;
    let rec: PersonalRecord | undefined;
    for (const s of list) {
      if (best !== undefined && s.value > best + 1e-9 && s.ts >= range.from && s.ts < range.to) {
        rec = {
          exerciseId,
          value: s.value,
          previous: best,
          ts: s.ts,
          workoutId: s.workoutId,
          bodyweight: ctx.exMap.get(exerciseId)?.loadType === 'bodyweight',
        };
      }
      best = best === undefined ? s.value : Math.max(best, s.value);
    }
    if (rec) out.push(rec);
  }
  return out.sort((a, b) => b.ts - a.ts);
}
