import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid } from './db';
import type { Exercise, Program, Settings, Template, Workout, WorkoutEntry, WorkoutSet } from './types';
import { isLogged } from '../lib/progress';

export function useSettings(): Settings | undefined {
  return useLiveQuery(() => db.settings.get('settings'));
}

export function useExerciseMap(): Map<string, Exercise> | undefined {
  return useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e])));
}

export function useActiveWorkout(): Workout | null | undefined {
  return useLiveQuery(async () => (await db.workouts.where('status').equals('active').first()) ?? null);
}

export function withExerciseIds(w: Workout): Workout {
  return { ...w, exerciseIds: Array.from(new Set(w.entries.map((e) => e.exerciseId))) };
}

export function newEntry(exerciseId: string, sets: WorkoutSet[] = [newSet('work', '')]): WorkoutEntry {
  return { id: uid(), exerciseId, sets };
}

export function newSet(type: WorkoutSet['type'], target: string, note?: string): WorkoutSet {
  return { id: uid(), type, target, done: false, ...(note ? { note } : {}) };
}

/** Crea il workout a partire da una scheda. Se ce n'è già uno in corso restituisce quello. */
export async function startWorkout(template: Template): Promise<Workout> {
  const active = await db.workouts.where('status').equals('active').first();
  if (active) return active;
  const w: Workout = withExerciseIds({
    id: uid(),
    templateId: template.id,
    templateName: template.name,
    status: 'active',
    startedAt: Date.now(),
    exerciseIds: [],
    entries: template.items.map((it) => ({
      id: uid(),
      exerciseId: it.exerciseId,
      ...(it.superset ? { superset: it.superset } : {}),
      ...(it.notes ? { hint: it.notes } : {}),
      ...(it.rest ? { rest: it.rest } : {}),
      sets: it.sets.map((s) => newSet(s.type, s.reps, s.note)),
    })),
  });
  await db.workouts.add(w);
  return w;
}

export async function startEmptyWorkout(): Promise<Workout> {
  const active = await db.workouts.where('status').equals('active').first();
  if (active) return active;
  const w: Workout = {
    id: uid(),
    templateName: 'Allenamento libero',
    status: 'active',
    startedAt: Date.now(),
    entries: [],
    exerciseIds: [],
  };
  await db.workouts.add(w);
  return w;
}

export interface PrevEntry {
  workout: Workout;
  entry: WorkoutEntry;
}

/** L'ultima volta che hai fatto l'esercizio, prima della data indicata. */
export async function findPrevEntry(exerciseId: string, before: number, excludeWorkoutId?: string): Promise<PrevEntry | undefined> {
  const candidates = await db.workouts
    .where('exerciseIds')
    .equals(exerciseId)
    .filter((w) => w.status === 'done' && w.id !== excludeWorkoutId && w.startedAt < before)
    .toArray();
  candidates.sort((a, b) => b.startedAt - a.startedAt);
  for (const workout of candidates) {
    const entry = workout.entries.find((e) => e.exerciseId === exerciseId && e.sets.some(isLogged));
    if (entry) return { workout, entry };
  }
  return undefined;
}

export async function findPrevEntries(exerciseIds: string[], before: number, excludeWorkoutId?: string) {
  const result: Record<string, PrevEntry | undefined> = {};
  await Promise.all(
    exerciseIds.map(async (id) => {
      result[id] = await findPrevEntry(id, before, excludeWorkoutId);
    }),
  );
  return result;
}

/** Scarta le serie mai compilate e gli esercizi rimasti vuoti. */
export function cleanWorkout(w: Workout): Workout {
  const entries = w.entries
    .map((e) => ({ ...e, sets: e.sets.filter(isLogged).map((s) => ({ ...s, done: true })) }))
    .filter((e) => e.sets.length > 0);
  return withExerciseIds({ ...w, entries });
}

export async function finishWorkout(w: Workout): Promise<Workout> {
  const done: Workout = { ...cleanWorkout(w), status: 'done', finishedAt: Date.now() };
  await db.workouts.put(done);
  return done;
}

/** Quante serie sono rimaste senza ripetizioni. */
export function countEmptySets(w: Workout): number {
  return w.entries.reduce((n, e) => n + e.sets.filter((s) => !isLogged(s)).length, 0);
}

/* ---------- Backup ---------- */

export interface Backup {
  app: 'allenamento';
  version: 1;
  exportedAt: string;
  settings: Settings[];
  exercises: Exercise[];
  programs?: Program[];
  templates: Template[];
  workouts: Workout[];
}

export async function exportBackup(): Promise<Backup> {
  return {
    app: 'allenamento',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: await db.settings.toArray(),
    exercises: await db.exercises.toArray(),
    programs: await db.programs.toArray(),
    templates: await db.templates.toArray(),
    workouts: await db.workouts.toArray(),
  };
}

export async function importBackup(data: unknown): Promise<void> {
  const b = data as Partial<Backup>;
  if (b?.app !== 'allenamento' || !Array.isArray(b.exercises) || !Array.isArray(b.workouts)) {
    throw new Error('Il file non è un backup di questa app.');
  }
  await db.transaction('rw', [db.settings, db.exercises, db.programs, db.templates, db.workouts], async () => {
    // cancellazione record per record (non clear) così anche le eliminazioni arrivano agli altri dispositivi
    for (const table of [db.settings, db.exercises, db.programs, db.templates, db.workouts]) {
      await table.bulkDelete(await table.toCollection().primaryKeys());
    }
    await db.settings.bulkPut(b.settings ?? []);
    await db.exercises.bulkPut(b.exercises ?? []);
    await db.programs.bulkPut(b.programs ?? []);
    await db.templates.bulkPut(b.templates ?? []);
    await db.workouts.bulkPut(b.workouts ?? []);
  });
}
