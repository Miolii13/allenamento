import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { configFromEnv, fullResync, getConfig, saveConfig, scheduleSync, signIn, signOut, useSyncStatus } from '../sync/controller';
import { daysAgo } from '../lib/format';

const timeFmt = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });

/** Collegamento a Supabase: configurazione, accesso e stato della sincronizzazione. */
export function SyncCard() {
  const status = useSyncStatus();
  const pending = useLiveQuery(() => db.outbox.count());
  const config = getConfig();
  const [url, setUrl] = useState(config?.url ?? '');
  const [key, setKey] = useState(config?.key ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function login(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(await signIn(email, password));
    setBusy(false);
    setPassword('');
  }

  function saveProject(e: FormEvent) {
    e.preventDefault();
    const u = url.trim().replace(/\/+$/, '');
    if (!/^https:\/\/.+/.test(u) || !key.trim()) {
      setError("Inserisci l'URL del progetto (https://…) e la chiave pubblica.");
      return;
    }
    saveConfig({ url: u, key: key.trim() });
  }

  return (
    <section className="card">
      <h2>Sincronizzazione</h2>

      {status.state === 'disabled' && (
        <form className="form" onSubmit={saveProject}>
          <p className="muted small">
            Collega un progetto Supabase per avere gli stessi dati su telefono e PC. Trovi URL e chiave pubblica
            (publishable o anon) nelle impostazioni API del progetto. Le istruzioni complete sono nel README.
          </p>
          <label className="field">
            <span>URL del progetto</span>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" inputMode="url" />
          </label>
          <label className="field">
            <span>Chiave pubblica</span>
            <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="sb_publishable_… oppure eyJ…" />
          </label>
          {error && <p className="neg small">{error}</p>}
          <button className="btn primary" type="submit">
            Collega
          </button>
        </form>
      )}

      {status.state === 'signed-out' && (
        <form className="form" onSubmit={login}>
          <p className="muted small">Accedi con l'utente creato su Supabase. Lo fai una volta per dispositivo.</p>
          <label className="field">
            <span>Email</span>
            <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <p className="neg small">{error}</p>}
          <div className="row gap">
            {!configFromEnv && (
              <button type="button" className="btn ghost small" onClick={() => saveConfig(null)}>
                Scollega progetto
              </button>
            )}
            <span className="grow" />
            <button className="btn primary" type="submit" disabled={busy || !email || !password}>
              {busy ? 'Accesso…' : 'Accedi'}
            </button>
          </div>
        </form>
      )}

      {(status.state === 'idle' || status.state === 'syncing' || status.state === 'error') && (
        <>
          <p className="small">
            Connesso come <strong>{status.email}</strong>
          </p>
          <p className={`small ${status.state === 'error' ? 'neg' : 'muted'}`}>
            {status.state === 'syncing'
              ? 'Sincronizzazione in corso…'
              : status.state === 'error'
                ? `Sincronizzazione non riuscita: ${status.error}`
                : status.lastSync
                  ? `Sincronizzato ${daysAgo(status.lastSync)} alle ${timeFmt.format(status.lastSync)}`
                  : 'In attesa della prima sincronizzazione'}
            {pending ? ` · ${pending} ${pending === 1 ? 'modifica da inviare' : 'modifiche da inviare'}` : ''}
          </p>
          <div className="row gap wrap">
            <button className="btn small" onClick={() => scheduleSync(0)} disabled={status.state === 'syncing'}>
              Sincronizza ora
            </button>
            <button
              className="btn small ghost"
              onClick={() => {
                if (confirm('Riscaricare tutto dal server? Le modifiche locali non inviate restano e vengono inviate dopo.'))
                  void fullResync();
              }}
            >
              Riscarica tutto
            </button>
            <span className="grow" />
            <button
              className="btn small danger-text"
              onClick={() => {
                if (confirm('Uscire? I dati restano su questo dispositivo ma non si sincronizzano più finché non rientri.'))
                  void signOut();
              }}
            >
              Esci
            </button>
          </div>
        </>
      )}
    </section>
  );
}
