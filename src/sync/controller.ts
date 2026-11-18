import { useSyncExternalStore } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { db, onLocalChange, uid } from '../db/db';
import { resetWatermark, syncOnce } from './engine';
import { supabaseRemote } from './supabaseRemote';

/* ---------- Configurazione ---------- */

export interface SyncConfig {
  url: string;
  key: string;
}

const CONFIG_KEY = 'allenamento-supabase';
const DEVICE_KEY = 'allenamento-device';
const LAST_SYNC_KEY = 'allenamento-last-sync';
const SCHEMA_KEY = 'allenamento-sync-schema';
const SYNC_SCHEMA = '2'; // 2 = con le schede (programs)

const ENV_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ENV_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** true se URL e chiave arrivano dal file .env (allora non si modificano dall'app). */
export const configFromEnv = !!(ENV_URL && ENV_KEY);

function readLS(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function getConfig(): SyncConfig | null {
  if (ENV_URL && ENV_KEY) return { url: ENV_URL, key: ENV_KEY };
  try {
    const c = JSON.parse(readLS(CONFIG_KEY) ?? 'null') as SyncConfig | null;
    return c?.url && c?.key ? c : null;
  } catch {
    return null;
  }
}

export function saveConfig(config: SyncConfig | null) {
  if (config) localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  else localStorage.removeItem(CONFIG_KEY);
  window.location.reload();
}

function deviceId(): string {
  let id = readLS(DEVICE_KEY);
  if (!id) {
    id = uid();
    try {
      localStorage.setItem(DEVICE_KEY, id);
    } catch {
      /* senza localStorage l'id cambia a ogni avvio: funziona lo stesso */
    }
  }
  return id;
}

/* ---------- Stato osservabile dall'interfaccia ---------- */

export interface SyncStatus {
  state: 'disabled' | 'signed-out' | 'idle' | 'syncing' | 'error';
  email?: string;
  lastSync?: number;
  error?: string;
}

let status: SyncStatus = { state: getConfig() ? 'signed-out' : 'disabled' };
const subscribers = new Set<() => void>();

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  subscribers.forEach((fn) => fn());
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (fn) => {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    () => status,
  );
}

/* ---------- Ciclo di sincronizzazione ---------- */

let client: SupabaseClient | null = null;
let userId: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;
let again = false;

export function scheduleSync(delayMs = 0) {
  clearTimeout(timer);
  timer = setTimeout(() => void runSync(), delayMs);
}

async function runSync() {
  if (!client || !userId) return;
  if (running) {
    again = true;
    return;
  }
  running = true;
  setStatus({ state: 'syncing' });
  try {
    // nuove tabelle sincronizzate: le versioni precedenti dell'app ne saltavano le righe, quindi riscarico tutto una volta
    if (readLS(SCHEMA_KEY) !== SYNC_SCHEMA) {
      await resetWatermark(userId);
      try {
        localStorage.setItem(SCHEMA_KEY, SYNC_SCHEMA);
      } catch {
        /* ignorato */
      }
    }
    await syncOnce(supabaseRemote(client, userId), userId, deviceId());
    const now = Date.now();
    try {
      localStorage.setItem(LAST_SYNC_KEY, String(now));
    } catch {
      /* ignorato */
    }
    setStatus({ state: 'idle', lastSync: now, error: undefined });
  } catch (e) {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    setStatus({ state: 'error', error: offline ? 'Sei offline: invio appena torna la rete.' : (e as Error).message });
  } finally {
    running = false;
    if (again) {
      again = false;
      scheduleSync(1000);
    }
  }
}

/** Avvia la sync se l'app è configurata. Da chiamare una volta all'avvio. */
export async function initSync() {
  const config = getConfig();
  if (!config) return;
  // la libreria Supabase si scarica solo se la sync è configurata
  let createClient: typeof import('@supabase/supabase-js').createClient;
  try {
    ({ createClient } = await import('@supabase/supabase-js'));
  } catch {
    setStatus({ state: 'error', error: 'Impossibile caricare la sincronizzazione (sei offline?). Riapri l’app con la rete.' });
    return;
  }
  client = createClient(config.url, config.key, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'allenamento-auth' },
  });
  const last = Number(readLS(LAST_SYNC_KEY)) || undefined;

  client.auth.onAuthStateChange((_event, session) => {
    // niente chiamate a Supabase qui dentro (rischio di blocco): la sync parte con un timer
    const wasSignedIn = !!userId;
    userId = session?.user.id ?? null;
    if (session) {
      setStatus({ state: running ? 'syncing' : 'idle', email: session.user.email, lastSync: status.lastSync ?? last });
      if (!wasSignedIn) scheduleSync(0);
    } else {
      setStatus({ state: 'signed-out', email: undefined, error: undefined });
    }
  });

  onLocalChange(() => scheduleSync(2000));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleSync(0);
  });
  window.addEventListener('online', () => scheduleSync(0));
  setInterval(() => {
    if (document.visibilityState === 'visible') scheduleSync(0);
  }, 60_000);
}

export async function signIn(email: string, password: string): Promise<string | null> {
  if (!client) return 'Sincronizzazione non configurata.';
  const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (!error) return null;
  if (/invalid login credentials/i.test(error.message)) return 'Email o password non corretti.';
  if (/email not confirmed/i.test(error.message)) return "L'email non è confermata: confermala da Supabase.";
  return error.message;
}

export async function signOut() {
  await client?.auth.signOut();
}

/** Riscarica tutto dal server e ricarica quello che manca (per rimettere a posto due dispositivi). */
export async function fullResync() {
  if (!userId) return;
  await resetWatermark(userId);
  scheduleSync(0);
}

/** Modifiche locali ancora da inviare. */
export function pendingCount() {
  return db.outbox.count();
}
