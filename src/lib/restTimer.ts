import { useSyncExternalStore } from 'react';

/** Timer di recupero tra le serie: uno solo per tutta l'app, sopravvive ai cambi di pagina. */
export interface RestState {
  endsAt: number;
  duration: number; // secondi
}

const DEFAULT_KEY = 'allenamento-rest-seconds';
export const REST_OPTIONS = [60, 90, 120, 150, 180];
/** Scelte per il recupero del singolo esercizio nella scheda. */
export const ITEM_REST_OPTIONS = [30, 45, 60, 75, 90, 120, 150, 180, 240, 300];

let state: RestState | null = null;
const subscribers = new Set<() => void>();
const notify = () => subscribers.forEach((fn) => fn());

export function getDefaultRest(): number {
  try {
    const v = Number(localStorage.getItem(DEFAULT_KEY));
    return v > 0 ? v : 120;
  } catch {
    return 120;
  }
}

const defaultSubs = new Set<() => void>();

export function setDefaultRest(seconds: number) {
  try {
    localStorage.setItem(DEFAULT_KEY, String(seconds));
  } catch {
    /* ignorato */
  }
  defaultSubs.forEach((fn) => fn());
}

/** Recupero predefinito, aggiornato quando lo cambi nelle impostazioni. */
export function useDefaultRest(): number {
  return useSyncExternalStore(
    (fn) => {
      defaultSubs.add(fn);
      return () => defaultSubs.delete(fn);
    },
    getDefaultRest,
  );
}

export function startRest(seconds = getDefaultRest()) {
  state = { endsAt: Date.now() + seconds * 1000, duration: seconds };
  notify();
}

export function adjustRest(deltaSeconds: number) {
  if (!state) return;
  const remaining = Math.max(0, state.endsAt - Date.now());
  const next = Math.max(0, remaining + deltaSeconds * 1000);
  state = { endsAt: Date.now() + next, duration: Math.max(state.duration + deltaSeconds, 15) };
  notify();
}

export function stopRest() {
  state = null;
  notify();
}

export function useRestTimer(): RestState | null {
  return useSyncExternalStore(
    (fn) => {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    () => state,
  );
}

export function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
