import type { EquipmentGroup, EquipmentVariant, Exercise, Settings, WorkoutEntry, WorkoutSet } from '../db/types';

export function equipmentOf(settings: Settings | undefined, exercise: Exercise | undefined): EquipmentGroup | undefined {
  if (!settings || !exercise?.equipmentId) return undefined;
  return settings.equipment.find((g) => g.id === exercise.equipmentId);
}

export function variantOf(group: EquipmentGroup | undefined, variantId: string | undefined): EquipmentVariant | undefined {
  if (!group || !variantId) return undefined;
  return group.variants.find((v) => v.id === variantId);
}

const roundHalf = (n: number) => Math.round(n * 2) / 2;

/** Converte un carico da una variante all'altra (es. 50 kg su Smith 1 -> 45 kg su Smith 2). */
export function convertWeight(w: number, from?: EquipmentVariant, to?: EquipmentVariant): number {
  if (!from || !to || from.id === to.id || !from.equiv || !to.equiv) return w;
  return roundHalf((w * to.equiv) / from.equiv);
}

/** Carico riportato alla prima variante dell'attrezzo, per confrontare sessioni fatte su macchine diverse. */
export function referenceWeight(w: number, group: EquipmentGroup | undefined, variant: EquipmentVariant | undefined): number {
  if (!group || !variant || !variant.equiv) return w;
  const ref = group.variants[0];
  if (!ref?.equiv) return w;
  return (w * ref.equiv) / variant.equiv;
}

export const isLogged = (s: WorkoutSet) => s.reps !== undefined && s.reps > 0;

/** Trova la serie corrispondente nella sessione precedente: stessa posizione tra le serie dello stesso tipo. */
export function matchPrevSet(sets: WorkoutSet[], index: number, prevSets: WorkoutSet[] | undefined): WorkoutSet | undefined {
  if (!prevSets) return undefined;
  const type = sets[index].type;
  const nth = sets.slice(0, index).filter((s) => s.type === type).length;
  return prevSets.filter((s) => s.type === type)[nth];
}

export type Trend = 'up' | 'same' | 'down';

/** Confronto tra due serie: conta prima il carico (equivalente), a parità di carico le ripetizioni. */
export function compareSet(
  cur: WorkoutSet,
  prev: WorkoutSet | undefined,
  group: EquipmentGroup | undefined,
  curVariant: EquipmentVariant | undefined,
  prevVariant: EquipmentVariant | undefined,
): Trend | undefined {
  if (!prev || !isLogged(cur) || !isLogged(prev)) return undefined;
  const cw = referenceWeight(cur.weight ?? 0, group, curVariant);
  const pw = referenceWeight(prev.weight ?? 0, group, prevVariant);
  if (Math.abs(cw - pw) > 0.01) return cw > pw ? 'up' : 'down';
  if (cur.reps! === prev.reps!) return 'same';
  return cur.reps! > prev.reps! ? 'up' : 'down';
}

/** Estremo alto del range di ripetizioni: "5-7" -> 7, "10" -> 10, "max" -> undefined. */
export function rangeTop(target: string): number | undefined {
  const m = target.match(/(\d+)\s*$/) ?? target.match(/(\d+)/);
  return m ? Number(m[1]) : undefined;
}

/**
 * Doppia progressione: se la volta scorsa tutte le serie principali hanno raggiunto
 * il massimo del range, è ora di aumentare il carico.
 */
export function shouldIncrease(prev: WorkoutEntry | undefined): boolean {
  if (!prev) return false;
  const main = prev.sets.filter((s) => s.type === 'work' && rangeTop(s.target) !== undefined);
  if (main.length === 0 || !main.every(isLogged)) return false;
  return main.every((s) => s.reps! >= rangeTop(s.target)!);
}

/** Volume: kg × reps (carico equivalente). Per gli esercizi a corpo libero: ripetizioni totali. */
export function entryVolume(entry: WorkoutEntry, exercise: Exercise | undefined, group: EquipmentGroup | undefined): number {
  const variant = variantOf(group, entry.variantId);
  return entry.sets.filter(isLogged).reduce((sum, s) => {
    if (exercise?.loadType === 'bodyweight') return sum + s.reps!;
    return sum + referenceWeight(s.weight ?? 0, group, variant) * s.reps!;
  }, 0);
}

/** 1RM stimato (Epley) della serie migliore, in carico equivalente. */
export function bestE1RM(entry: WorkoutEntry, group: EquipmentGroup | undefined): number | undefined {
  const variant = variantOf(group, entry.variantId);
  let best: number | undefined;
  for (const s of entry.sets) {
    if (s.type !== 'work' || !isLogged(s) || !s.weight) continue;
    const w = referenceWeight(s.weight, group, variant);
    const e = w * (1 + s.reps! / 30);
    if (best === undefined || e > best) best = e;
  }
  return best;
}

export function setText(s: WorkoutSet, bodyweight: boolean): string {
  if (!isLogged(s)) return '—';
  if (bodyweight) return s.weight ? `+${fmt(s.weight)}×${s.reps}` : `${s.reps}`;
  return `${fmt(s.weight ?? 0)}×${s.reps}`;
}

const fmt = (n: number) => n.toLocaleString('it-IT', { maximumFractionDigits: 2 });
