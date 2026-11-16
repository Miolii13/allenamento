import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initSync } from './sync/controller';
import './lib/install'; // registra subito l'ascolto dell'evento di installazione
import './styles.css';

void initSync();

// In sviluppo: strumenti per provare la sync dalla console del browser, con un server finto.
if (import.meta.env.DEV) {
  void Promise.all([import('./db/db'), import('./sync/engine'), import('./sync/fakeRemote')]).then(([d, e, f]) => {
    (window as unknown as Record<string, unknown>).__dev = { db: d.db, syncOnce: e.syncOnce, createFakeRemote: f.createFakeRemote };
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Chiede al browser di non cancellare i dati locali quando lo spazio scarseggia.
navigator.storage?.persist?.().catch(() => undefined);

// Funzionamento offline (utile in palestra con poco segnale). Solo in produzione e su HTTPS/localhost.
if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}
