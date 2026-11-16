import { useSyncExternalStore } from 'react';

/** Evento di Chrome/Android che permette di mostrare il prompt "Installa app" quando vogliamo noi. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'allenamento-install-dismissed';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

// stato immutabile: ogni cambiamento crea un oggetto nuovo, così React se ne accorge
let state: { event: BeforeInstallPromptEvent | null; dismissed: boolean } = { event: null, dismissed: readDismissed() };
const subscribers = new Set<() => void>();
function setState(patch: Partial<typeof state>) {
  state = { ...state, ...patch };
  subscribers.forEach((fn) => fn());
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  setState({ event: e as BeforeInstallPromptEvent });
});

window.addEventListener('appinstalled', () => setState({ event: null }));

/** Disponibile solo se il browser permette l'installazione e l'app non è già installata. */
export function useInstallPrompt() {
  const s = useSyncExternalStore(
    (fn) => {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    () => state,
  );
  return {
    canInstall: !!s.event && !s.dismissed,
    async install() {
      const ev = state.event;
      if (!ev) return;
      await ev.prompt();
      await ev.userChoice;
      setState({ event: null });
    },
    dismiss() {
      try {
        localStorage.setItem(DISMISS_KEY, '1');
      } catch {
        /* ignorato */
      }
      setState({ dismissed: true });
    },
  };
}
