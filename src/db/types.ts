/** Tipo di serie: normale, drop (scalata subito dopo la precedente), mini-serie myo reps. */
export type SetType = 'work' | 'drop' | 'myo';

/** Come si legge il carico: normale, peso del singolo manubrio, zavorra a corpo libero. */
export type LoadType = 'standard' | 'dumbbell' | 'bodyweight';

/**
 * Variante di un attrezzo (es. una delle due Smith).
 * `equiv` è il carico che dà lo stesso sforzo sulle varie varianti:
 * Smith 1 = 50, Smith 2 = 45 significa "50 kg sulla 1 equivalgono a 45 kg sulla 2".
 */
export interface EquipmentVariant {
  id: string;
  name: string;
  equiv: number;
}

/** Attrezzo con più varianti che pesano in modo diverso: all'avvio dell'esercizio l'app chiede quale hai usato. */
export interface EquipmentGroup {
  id: string;
  name: string;
  question: string;
  variants: EquipmentVariant[];
}

/** Gruppo muscolare principale, per le statistiche (serie a settimana per muscolo). */
export type MuscleGroup =
  | 'petto'
  | 'schiena'
  | 'spalle'
  | 'bicipiti'
  | 'tricipiti'
  | 'quadricipiti'
  | 'femorali'
  | 'glutei'
  | 'adduttori'
  | 'polpacci'
  | 'addome'
  | 'altro';

export interface Exercise {
  id: string;
  name: string;
  loadType: LoadType;
  equipmentId?: string;
  /** Se manca si usa quello predefinito per gli esercizi iniziali (lib/muscles.ts). */
  muscle?: MuscleGroup;
  notes?: string;
  archived?: boolean;
  createdAt: number;
}

export interface TemplateSet {
  type: SetType;
  /** Ripetizioni obiettivo, testo libero: "5-7", "max", "10". */
  reps: string;
  note?: string;
}

export interface TemplateItem {
  id: string;
  exerciseId: string;
  /** Lettera del superset (A, B, ...): esercizi con la stessa lettera vanno fatti in superset. */
  superset?: string;
  notes?: string;
  /** Recupero dopo le serie di questo esercizio, in secondi. Se manca vale quello predefinito (2:00). */
  rest?: number;
  sets: TemplateSet[];
}

/** Scheda: contiene più allenamenti (es. Upper 1, Lower, Upper 2). */
export interface Program {
  id: string;
  name: string;
  order: number;
  archived?: boolean;
  createdAt: number;
  updatedAt: number;
}

/** Allenamento di una scheda (es. Upper 1): l'elenco degli esercizi con serie e recuperi. */
export interface Template {
  id: string;
  /** Scheda a cui appartiene. Se manca, sta nella scheda predefinita. */
  programId?: string;
  name: string;
  order: number;
  items: TemplateItem[];
  archived?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface WorkoutSet {
  id: string;
  type: SetType;
  target: string;
  note?: string;
  weight?: number;
  reps?: number;
  done: boolean;
}

export interface WorkoutEntry {
  id: string;
  exerciseId: string;
  superset?: string;
  /** Nota della scheda (es. "Dropset"), copiata all'avvio. */
  hint?: string;
  /** Nota libera della sessione. */
  notes?: string;
  /** Variante dell'attrezzo usata (es. quale Smith). */
  variantId?: string;
  /** Recupero copiato dalla scheda all'avvio (secondi). */
  rest?: number;
  sets: WorkoutSet[];
}

export interface Workout {
  id: string;
  templateId?: string;
  templateName: string;
  status: 'active' | 'done';
  startedAt: number;
  finishedAt?: number;
  notes?: string;
  entries: WorkoutEntry[];
  /** Copia degli id esercizio presenti, indicizzata per trovare in fretta "la volta prima". */
  exerciseIds: string[];
}

/** Cosa prevede un giorno della settimana tipo. */
export type DayPlan = { kind: 'rest' } | { kind: 'gym'; templateId: string } | { kind: 'run' };

/** Split settimanale: cosa fai ogni giorno, da lunedì (0) a domenica (6). */
export interface WeekSplit {
  id: string;
  name: string;
  days: DayPlan[];
}

export interface Settings {
  id: 'settings';
  equipment: EquipmentGroup[];
  /** Split settimanali disponibili. */
  splits?: WeekSplit[];
  /** Split usata quando per la settimana non ne hai scelta un'altra. */
  defaultSplitId?: string;
  /** Split scelta per una settimana precisa (chiave: data del lunedì, aaaa-mm-gg). */
  splitByWeek?: Record<string, string>;
  /** @deprecated settimana tipo unica delle versioni precedenti: letta come prima split. */
  weekPlan?: DayPlan[];
}
