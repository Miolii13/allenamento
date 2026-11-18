import { db, uid } from '../db/db';
import { DEFAULT_EQUIPMENT } from '../db/seed';
import type { DayPlan, Settings, Template, WeekSplit } from '../db/types';

export const WEEKDAYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
export const DAY_LETTERS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

/** Giorno della settimana con il lunedì = 0. */
export const weekdayIndex = (d = new Date()) => (d.getDay() + 6) % 7;

export function startOfDay(d = new Date()): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function startOfWeek(d = new Date()): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - weekdayIndex(x));
  return x;
}

/** Chiave della settimana: data del lunedì, aaaa-mm-gg (ora locale). */
export function weekKey(d = new Date()): string {
  const m = startOfWeek(d);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${m.getFullYear()}-${p(m.getMonth() + 1)}-${p(m.getDate())}`;
}

export const emptyDays = (): DayPlan[] => Array.from({ length: 7 }, () => ({ kind: 'rest' as const }));
export const newSplit = (name: string): WeekSplit => ({ id: uid(), name, days: emptyDays() });

/** Split disponibili. La settimana tipo unica delle versioni precedenti diventa la prima split. */
export function splitsOf(settings: Settings | undefined): WeekSplit[] {
  if (settings?.splits?.length) return settings.splits;
  if (settings?.weekPlan?.some((p) => p.kind !== 'rest')) return [{ id: 'split-1', name: 'Split 1', days: settings.weekPlan }];
  return [];
}

export function defaultSplit(settings: Settings | undefined): WeekSplit | undefined {
  const splits = splitsOf(settings);
  return splits.find((s) => s.id === settings?.defaultSplitId) ?? splits[0];
}

/** Split in uso nella settimana di `d`: quella scelta per quella settimana, altrimenti la predefinita. */
export function activeSplit(settings: Settings | undefined, d = new Date()): WeekSplit | undefined {
  const chosen = settings?.splitByWeek?.[weekKey(d)];
  return splitsOf(settings).find((s) => s.id === chosen) ?? defaultSplit(settings);
}

export function hasPlan(settings: Settings | undefined): boolean {
  return !!activeSplit(settings)?.days.some((p) => p.kind !== 'rest');
}

export function planFor(settings: Settings | undefined, day: number): DayPlan | undefined {
  return activeSplit(settings)?.days[day];
}

/** Descrizione breve di un giorno: "Upper 1", "Corsa", "Riposo". */
export function planLabel(p: DayPlan | undefined, templates: Template[] | undefined): string {
  if (!p || p.kind === 'rest') return 'Riposo';
  if (p.kind === 'run') return 'Corsa';
  return templates?.find((t) => t.id === p.templateId)?.name ?? 'Allenamento eliminato';
}

/** Riassunto di una split: "Mar Upper 1 · Gio Lower · Sab Upper 2". */
export function splitSummary(split: WeekSplit, templates: Template[] | undefined): string {
  const parts = split.days
    .map((p, i) => (p.kind === 'rest' ? null : `${WEEKDAYS[i].slice(0, 3)} ${p.kind === 'run' ? 'corsa' : planLabel(p, templates)}`))
    .filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Solo riposo';
}

async function updateSettings(patch: Partial<Settings>) {
  const updated = await db.settings.update('settings', patch);
  if (!updated) await db.settings.put({ id: 'settings', equipment: DEFAULT_EQUIPMENT, ...patch });
}

/** Salva l'elenco delle split (sostituisce la settimana tipo unica delle versioni precedenti). */
export async function saveSplits(splits: WeekSplit[], defaultSplitId?: string) {
  const settings = await db.settings.get('settings');
  const def = defaultSplitId ?? settings?.defaultSplitId;
  await updateSettings({
    splits,
    defaultSplitId: splits.some((s) => s.id === def) ? def : splits[0]?.id,
    weekPlan: undefined,
  });
}

/** Usa una split per la settimana di `d` (le scelte più vecchie di 8 settimane si dimenticano). */
export async function chooseSplitForWeek(splitId: string, d = new Date()) {
  const settings = await db.settings.get('settings');
  // se la split arriva dalla vecchia settimana tipo, la salvo prima come split vera
  if (!settings?.splits?.length) await saveSplits(splitsOf(settings));
  const limit = weekKey(new Date(Date.now() - 8 * 7 * 86400000));
  const kept = Object.fromEntries(Object.entries(settings?.splitByWeek ?? {}).filter(([k]) => k >= limit));
  await updateSettings({ splitByWeek: { ...kept, [weekKey(d)]: splitId } });
}
