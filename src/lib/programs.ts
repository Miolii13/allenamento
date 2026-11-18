import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { DEFAULT_PROGRAM_ID, DEFAULT_PROGRAM_NAME } from '../db/constants';
import type { Program, Template } from '../db/types';

export interface ProgramWithDays {
  program: Program;
  /** true se la scheda non è ancora salvata (raccoglie gli allenamenti delle versioni precedenti). */
  virtual: boolean;
  templates: Template[];
}

/** Scheda di un allenamento: quella indicata, o la predefinita se manca o non esiste più. */
export function programIdOf(t: Template, existing: Set<string>): string {
  return t.programId && existing.has(t.programId) ? t.programId : DEFAULT_PROGRAM_ID;
}

/** Tutte le schede con i loro allenamenti, in ordine. */
export function usePrograms(): ProgramWithDays[] | undefined {
  return useLiveQuery(async () => {
    const programs = await db.programs.orderBy('order').filter((p) => !p.archived).toArray();
    const templates = await db.templates.orderBy('order').filter((t) => !t.archived).toArray();
    const ids = new Set(programs.map((p) => p.id));
    const out: ProgramWithDays[] = programs.map((program) => ({ program, virtual: false, templates: [] }));
    const byId = new Map(out.map((x) => [x.program.id, x]));
    for (const t of templates) {
      const pid = programIdOf(t, ids);
      let holder = byId.get(pid);
      if (!holder) {
        // allenamenti senza scheda: li raccolgo nella scheda predefinita, che si salva alla prima modifica
        holder = {
          program: { id: DEFAULT_PROGRAM_ID, name: DEFAULT_PROGRAM_NAME, order: 0, createdAt: 0, updatedAt: 0 },
          virtual: true,
          templates: [],
        };
        out.unshift(holder);
        byId.set(pid, holder);
      }
      holder.templates.push(t);
    }
    return out;
  });
}

/** Sigla di un allenamento: "Upper 1" -> "U1", "Lower" -> "L". */
export function initials(name: string): string {
  const s = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (/^\d+$/.test(w) ? w : w[0].toUpperCase()))
    .join('');
  return s.slice(0, 3) || '?';
}
