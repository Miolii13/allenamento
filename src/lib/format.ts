import type { LoadType, SetType, TemplateSet } from '../db/types';

/** Accetta sia "4,5" sia "4.5". Restituisce undefined se il campo è vuoto o non è un numero. */
export function parseNum(text: string): number | undefined {
  const t = text.trim().replace(',', '.');
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

export function fmtNum(n: number | undefined): string {
  if (n === undefined) return '';
  return n.toLocaleString('it-IT', { maximumFractionDigits: 2 });
}

export function fmtKg(n: number): string {
  return `${fmtNum(n)} kg`;
}

/** Etichette leggibili delle serie: S1, S2, drop, Myo 1... La serie seguita da myo è l'attivazione. */
export function setLabels(sets: { type: SetType }[]): string[] {
  let work = 0;
  let myo = 0;
  return sets.map((s, i) => {
    if (s.type === 'work') {
      work++;
      myo = 0;
      return sets[i + 1]?.type === 'myo' ? 'Attiv.' : `S${work}`;
    }
    if (s.type === 'drop') return '↳ drop';
    myo++;
    return `Myo ${myo}`;
  });
}

/** Riassunto compatto delle serie di una scheda: "2×5-7 / 1×8-10", "2×(8+8)", "10 + 4×3-5 myo". */
export function summarizeSets(sets: TemplateSet[]): string {
  const tokens: string[] = [];
  let i = 0;
  while (i < sets.length) {
    const s = sets[i];
    let j = i + 1;
    if (s.type === 'work' && sets[j]?.type === 'drop') {
      const parts = [s.reps];
      while (sets[j]?.type === 'drop') parts.push(sets[j++].reps);
      tokens.push(`(${parts.join('+')})`);
    } else if (s.type === 'work' && sets[j]?.type === 'myo') {
      let n = 0;
      const myoReps = sets[j].reps;
      while (sets[j]?.type === 'myo') {
        n++;
        j++;
      }
      tokens.push(`[${s.reps} + ${n}×${myoReps} myo]`);
    } else {
      tokens.push(s.reps + (s.note ? ` ${s.note}` : ''));
    }
    i = j;
  }
  // raggruppa i token uguali consecutivi: 8-10, 8-10 -> 2×8-10
  const out: string[] = [];
  let k = 0;
  while (k < tokens.length) {
    let n = 1;
    while (tokens[k + n] === tokens[k]) n++;
    const t = tokens[k];
    if (t.startsWith('[')) out.push(t.slice(1, -1));
    else out.push(`${n}×${t}`);
    k += n;
  }
  return out.join(' / ');
}

export function loadUnit(loadType: LoadType): string {
  if (loadType === 'bodyweight') return 'Zavorra';
  if (loadType === 'dumbbell') return 'Kg/man.';
  return 'Kg';
}

export const LOAD_TYPE_LABEL: Record<LoadType, string> = {
  standard: 'Carico normale',
  dumbbell: 'Manubri (peso del singolo)',
  bodyweight: 'Corpo libero (kg = zavorra)',
};

const dateFmt = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const shortFmt = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' });
const monthFmt = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' });

export const fmtDate = (ts: number) => dateFmt.format(ts);
export const fmtDateShort = (ts: number) => shortFmt.format(ts);
export const fmtMonth = (ts: number) => monthFmt.format(ts);

export function fmtDuration(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}'` : `${m}'`;
}

export function daysAgo(ts: number): string {
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((start(new Date()) - start(new Date(ts))) / 86400000);
  if (days <= 0) return 'oggi';
  if (days === 1) return 'ieri';
  return `${days} giorni fa`;
}

/** Valore per <input type="datetime-local"> nell'ora locale. */
export function toLocalInput(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
