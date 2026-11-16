import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CloudCheck, CloudOff, LogOut, RefreshCw } from 'lucide-react';
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

  if (status.state === 'disabled') {
    return (
      <form className="card form" onSubmit={saveProject}>
        <p className="muted small">
          Collega un progetto Supabase per avere gli stessi dati su telefono e PC. URL e chiave pubblica (publishable o anon) sono
          nelle impostazioni API del progetto.
        </p>
        <label className="field">
          <span>URL del progetto</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" inputMode="url" />
        </label>
        <label className="field">
          <span>Chiave pubblica</span>
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="sb_publishable_…" />
        </label>
        {error && <p className="neg small">{error}</p>}
        <button className="btn btn-primary" type="submit">
          Collega
        </button>
      </form>
    );
  }

  if (status.state === 'signed-out') {
    return (
      <form className="card form" onSubmit={login}>
        <p className="muted small">Accedi con il tuo utente per sincronizzare telefono e PC. Lo fai una volta per dispositivo.</p>
        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="neg small">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={busy || !email || !password}>
          {busy ? 'Accesso…' : 'Accedi'}
        </button>
        {!configFromEnv && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => saveConfig(null)}>
            Scollega progetto
          </button>
        )}
      </form>
    );
  }

  const ok = status.state !== 'error';
  return (
    <div className="card">
      <div className={`status-line ${ok ? 'ok' : 'err'}`}>
        {ok ? <CloudCheck size={20} /> : <CloudOff size={20} />}
        <div className="grow stack-s">
          <span className="strong">
            {status.state === 'syncing'
              ? 'Sincronizzazione in corso…'
              : status.state === 'error'
                ? 'Sincronizzazione non riuscita'
                : status.lastSync
                  ? `Sincronizzato ${daysAgo(status.lastSync)} alle ${timeFmt.format(status.lastSync)}`
                  : 'In attesa della prima sincronizzazione'}
          </span>
          <span className="muted small">
            {status.state === 'error' ? status.error : status.email}
            {pending ? ` · ${pending} ${pending === 1 ? 'modifica da inviare' : 'modifiche da inviare'}` : ''}
          </span>
        </div>
      </div>
      <div className="row wrap">
        <button className="btn btn-sm" onClick={() => scheduleSync(0)} disabled={status.state === 'syncing'}>
          <RefreshCw size={15} /> Sincronizza ora
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            if (confirm('Riscaricare tutto dal server? Le modifiche locali non ancora inviate restano e vengono inviate dopo.'))
              void fullResync();
          }}
        >
          Riscarica tutto
        </button>
        <span className="grow" />
        <button
          className="btn btn-danger-text btn-sm"
          onClick={() => {
            if (confirm('Uscire? I dati restano su questo dispositivo ma non si sincronizzano finché non rientri.')) void signOut();
          }}
        >
          <LogOut size={15} /> Esci
        </button>
      </div>
    </div>
  );
}
