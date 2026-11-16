import type { PushRow, Remote, RemoteRow } from './engine';

/**
 * Server finto in memoria, con le stesse regole della tabella Supabase
 * (vince modified_at più recente, updated_at assegnato dal server). Solo per provare la sync in sviluppo.
 */
export function createFakeRemote() {
  const rows = new Map<string, RemoteRow>();
  let clock = 0;
  const stamp = () => `2000-01-01T00:00:${String(++clock).padStart(6, '0')}+00:00`;

  const write = (r: PushRow) => {
    const key = `${r.kind}:${r.id}`;
    const old = rows.get(key);
    if (old && r.modified_at < old.modified_at) return; // come il trigger SQL
    rows.set(key, { ...r, data: structuredClone(r.data), updated_at: stamp() });
  };

  const remote: Remote = {
    async pull({ since, excludeDevice }) {
      return [...rows.values()]
        .filter((r) => (!since || r.updated_at > since) && (!excludeDevice || r.device !== excludeDevice))
        .sort((a, b) => a.updated_at.localeCompare(b.updated_at))
        .map((r) => structuredClone(r));
    },
    async push(batch) {
      batch.forEach(write);
    },
  };

  return {
    remote,
    rows,
    /** Simula una modifica fatta da un altro dispositivo. */
    otherDeviceWrite: (r: Omit<PushRow, 'device'>) => write({ ...r, device: 'altro-dispositivo' }),
  };
}
