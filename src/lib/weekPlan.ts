import { db } from '../db/db';
import { DEFAULT_EQUIPMENT } from '../db/seed';
import type { DayPlan, Settings, Template } from '../db/types';

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

export function hasPlan(settings: Settings | undefined): boolean {
  return !!settings?.weekPlan?.some((p) => p.kind !== 'rest');
}

export function planFor(settings: Settings | undefined, day: number): DayPlan | undefined {
  return settings?.weekPlan?.[day];
}

/** Descrizione breve di un giorno: "Upper 1", "Corsa", "Riposo". */
export function planLabel(p: DayPlan | undefined, templates: Template[] | undefined): string {
  if (!p || p.kind === 'rest') return 'Riposo';
  if (p.kind === 'run') return 'Corsa';
  return templates?.find((t) => t.id === p.templateId)?.name ?? 'Scheda eliminata';
}

/** Salva la settimana tipo senza toccare il resto delle impostazioni (si sincronizza con gli altri dispositivi). */
export async function saveWeekPlan(plan: DayPlan[]) {
  const updated = await db.settings.update('settings', { weekPlan: plan });
  if (!updated) await db.settings.put({ id: 'settings', equipment: DEFAULT_EQUIPMENT, weekPlan: plan });
}
