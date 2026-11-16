import { db, silence, SYNCED_KINDS, type OutboxEntry, type SyncedKind } from '../db/db';

/** Un record come sta sul server: un documento JSON per ogni esercizio, scheda, allenamento... */
export interface RemoteRow {
  kind: string;
  id: string;
  data: unknown;
  deleted: boolean;
  /** Ora della modifica sul dispositivo (ms): decide chi vince nei conflitti. */
  modified_at: number;
  /** Dispositivo che ha scritto il record. */
  device: string;
  /** Ora del server: serve per scaricare solo le novità. */
  updated_at: string;
}

export type PushRow = Omit<RemoteRow, 'updated_at'>;

/** Il server visto dal motore di sync: Supabase in produzione, uno finto nei test. */
export interface Remote {
  /** Record cambiati dopo `since` (tutti se null), in ordine di updated_at. */
  pull(opts: { since: string | null; excludeDevice: string | null }): Promise<RemoteRow[]>;
  /** Scrive i record; il server tiene quello con modified_at più recente. */
  push(rows: PushRow[]): Promise<void>;
}

const isKind = (k: string): k is SyncedKind => (SYNCED_KINDS as readonly string[]).includes(k);
const watermarkKey = (scope: string) => `watermark:${scope}`;

export async function resetWatermark(scope: string) {
  await db.meta.delete(watermarkKey(scope));
}

/**
 * Un giro di sincronizzazione:
 * 1. scarica dal server le modifiche fatte dagli altri dispositivi e le applica,
 *    tranne dove qui c'è una modifica più recente ancora da inviare;
 * 2. invia la coda delle modifiche locali.
 * Al primo giro su un dispositivo scarica tutto e carica quello che sul server manca.
 */
export async function syncOnce(remote: Remote, scope: string, device: string): Promise<{ pulled: number; pushed: number }> {
  const wmKey = watermarkKey(scope);
  const since = ((await db.meta.get(wmKey))?.value as string | undefined) ?? null;
  const first = since === null;
  const rows = await remote.pull({ since, excludeDevice: first ? null : device });

  let applied = 0;
  await db.transaction('rw', [db.exercises, db.templates, db.workouts, db.settings, db.outbox, db.meta], async (tx) => {
    silence(tx);
    for (const r of rows) {
      if (!isKind(r.kind)) continue;
      const key = `${r.kind}:${r.id}`;
      const pending = await db.outbox.get(key);
      if (pending && pending.mod >= r.modified_at) continue; // la modifica locale è più recente: verrà inviata
      if (pending) await db.outbox.delete(key); // quella del server è più recente: la locale si scarta
      if (r.deleted) await db.table(r.kind).delete(r.id);
      else if (r.data) await db.table(r.kind).put(r.data);
      applied++;
    }

    if (first) {
      // dati presenti solo qui (es. usati prima di attivare la sync): vanno caricati sul server
      const onServer = new Set(rows.map((r) => `${r.kind}:${r.id}`));
      const now = Date.now();
      for (const kind of SYNCED_KINDS) {
        for (const id of await db.table(kind).toCollection().primaryKeys()) {
          const key = `${kind}:${String(id)}`;
          if (!onServer.has(key) && !(await db.outbox.get(key))) {
            await db.outbox.put({ key, kind, id: String(id), op: 'put', mod: now });
          }
        }
      }
    }

    const last = rows[rows.length - 1]?.updated_at;
    if (last || first) await db.meta.put({ key: wmKey, value: last ?? since ?? '1970-01-01T00:00:00+00:00' });
  });

  const pending: OutboxEntry[] = await db.outbox.toArray();
  if (pending.length > 0) {
    const toPush: PushRow[] = [];
    for (const p of pending) {
      const data = p.op === 'put' ? await db.table(p.kind).get(p.id) : undefined;
      toPush.push({ kind: p.kind, id: p.id, modified_at: p.mod, device, deleted: data === undefined, data: data ?? null });
    }
    await remote.push(toPush);
    // tolgo dalla coda solo ciò che non è cambiato nel frattempo
    await db.transaction('rw', db.outbox, async () => {
      for (const p of pending) {
        const cur = await db.outbox.get(p.key);
        if (cur && cur.mod === p.mod) await db.outbox.delete(p.key);
      }
    });
  }

  return { pulled: applied, pushed: pending.length };
}
