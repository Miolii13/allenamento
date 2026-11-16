import type { SupabaseClient } from '@supabase/supabase-js';
import type { PushRow, Remote, RemoteRow } from './engine';

const TABLE = 'records';
const PAGE = 1000;
const COLUMNS = 'kind,id,data,deleted,modified_at,device,updated_at';

export function supabaseRemote(client: SupabaseClient, userId: string): Remote {
  return {
    async pull({ since, excludeDevice }) {
      const out: RemoteRow[] = [];
      for (let from = 0; ; from += PAGE) {
        let q = client
          .from(TABLE)
          .select(COLUMNS)
          .order('updated_at')
          .order('kind')
          .order('id')
          .range(from, from + PAGE - 1);
        if (since) q = q.gt('updated_at', since);
        if (excludeDevice) q = q.neq('device', excludeDevice);
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        out.push(...((data ?? []) as RemoteRow[]));
        if (!data || data.length < PAGE) break;
      }
      return out;
    },

    async push(rows: PushRow[]) {
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500).map((r) => ({ ...r, user_id: userId }));
        const { error } = await client.from(TABLE).upsert(chunk, { onConflict: 'user_id,kind,id' });
        if (error) throw new Error(error.message);
      }
    },
  };
}
