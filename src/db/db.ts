import Dexie, { type Table, type Transaction } from 'dexie';
import type { Exercise, Program, Settings, Template, Workout } from './types';
import { seedDatabase } from './seed';

/** Tabelle sincronizzate con il server. Corsa e alimentazione si aggiungeranno qui. */
export const SYNCED_KINDS = ['exercises', 'programs', 'templates', 'workouts', 'settings'] as const;
export type SyncedKind = (typeof SYNCED_KINDS)[number];

/** Modifica locale non ancora inviata al server (una sola per record: conta l'ultima). */
export interface OutboxEntry {
  key: string;
  kind: SyncedKind;
  id: string;
  op: 'put' | 'delete';
  /** Quando è avvenuta la modifica (ms): in caso di conflitto vince la più recente. */
  mod: number;
}

export interface MetaEntry {
  key: string;
  value: unknown;
}

class AppDB extends Dexie {
  exercises!: Table<Exercise, string>;
  programs!: Table<Program, string>;
  templates!: Table<Template, string>;
  workouts!: Table<Workout, string>;
  settings!: Table<Settings, string>;
  outbox!: Table<OutboxEntry, string>;
  meta!: Table<MetaEntry, string>;

  constructor() {
    super('allenamento');
    this.version(1).stores({
      exercises: 'id, name',
      templates: 'id, order',
      workouts: 'id, status, startedAt, *exerciseIds',
      settings: 'id',
    });
    this.version(2).stores({
      outbox: 'key',
      meta: 'key',
    });
    this.version(3).stores({
      programs: 'id, order',
    });
    // Al primo avvio carica attrezzi, esercizi e le schede della split attuale.
    // Non va in coda: è identico su ogni dispositivo e i dati del server hanno la precedenza.
    this.on('populate', (tx) => {
      silence(tx);
      return seedDatabase(tx);
    });
  }
}

export const db = new AppDB();

/* ---------- Coda delle modifiche locali ---------- */

const SILENT = '__allenamentoSilent';

/** Le scritture in questa transazione non vanno in coda (dati iniziali, dati arrivati dal server). */
export function silence(tx: Transaction) {
  (tx as unknown as Record<string, boolean>)[SILENT] = true;
}

const changeListeners = new Set<() => void>();

/** Avvisa quando c'è una nuova modifica locale da inviare. */
export function onLocalChange(fn: () => void): () => void {
  changeListeners.add(fn);
  return () => changeListeners.delete(fn);
}

for (const kind of SYNCED_KINDS) {
  const enqueue = (trans: Transaction, id: unknown, op: OutboxEntry['op']) => {
    if ((trans as unknown as Record<string, boolean>)[SILENT]) return;
    const entry: OutboxEntry = { key: `${kind}:${String(id)}`, kind, id: String(id), op, mod: Date.now() };
    // la coda si scrive a transazione riuscita: se la scrittura fallisce non c'è niente da inviare
    trans.on('complete', () => {
      db.outbox
        .put(entry)
        .then(() => changeListeners.forEach((fn) => fn()))
        .catch(() => undefined);
    });
  };
  const table = db.table(kind);
  table.hook('creating', function (primKey, obj, trans) {
    enqueue(trans, primKey ?? (obj as { id: string }).id, 'put');
  });
  table.hook('updating', function (_mods, primKey, _obj, trans) {
    enqueue(trans, primKey, 'put');
  });
  table.hook('deleting', function (primKey, _obj, trans) {
    enqueue(trans, primKey, 'delete');
  });
}

/** id univoco che funziona anche fuori da HTTPS (crypto.randomUUID richiede un contesto sicuro). */
export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto && window.isSecureContext) {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
