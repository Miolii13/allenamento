import { useEffect, useRef, useState } from 'react';
import { Check, Download, Upload } from 'lucide-react';
import { exportBackup, importBackup } from '../../db/repo';
import { PageHeader } from '../../components/PageHeader';
import { useWeekPlanDraft, WeekPlanRows, WEEK_PLAN_HELP } from '../../components/WeekPlanSheet';
import { fmtClock, setDefaultRest, useDefaultRest } from '../../lib/restTimer';
import { navigate } from '../../router';
import { SyncCard } from '../SyncCard';

const BACK = { to: '/impostazioni', label: 'Impostazioni' };

export function SyncSettings() {
  return (
    <div className="page">
      <PageHeader title="Sincronizzazione" back={BACK} />
      <SyncCard />
      <p className="muted small">
        I dati restano sempre anche su questo dispositivo, quindi l'app funziona senza rete. Ogni modifica viene inviata dopo un paio
        di secondi e le modifiche degli altri dispositivi arrivano all'apertura e ogni minuto. Se lo stesso dato cambia in due posti,
        vince la modifica più recente.
      </p>
    </div>
  );
}

export function WeekPlanSettings() {
  const draft = useWeekPlanDraft();
  const [saved, setSaved] = useState(false);
  return (
    <div className="page">
      <PageHeader title="Settimana tipo" back={BACK} subtitle={WEEK_PLAN_HELP} />
      <WeekPlanRows draft={draft} />
      <div className="sticky-actions">
        {saved && !draft.dirty && (
          <span className="pos small strong row" style={{ gap: 4 }}>
            <Check size={16} strokeWidth={3} /> Salvata
          </span>
        )}
        <span className="grow" />
        <button
          className="btn btn-primary"
          disabled={!draft.ready || !draft.dirty}
          onClick={async () => {
            await draft.save();
            setSaved(true);
          }}
        >
          Salva settimana
        </button>
      </div>
    </div>
  );
}

const REST_CHOICES = [45, 60, 75, 90, 120, 150, 180, 240];

export function RestSettings() {
  const rest = useDefaultRest();
  return (
    <div className="page">
      <PageHeader
        title="Recupero predefinito"
        back={BACK}
        subtitle="Il timer parte da solo quando segni una serie. Questo valore vale per gli esercizi che nella scheda non hanno un recupero proprio."
      />
      <div className="card flush">
        {REST_CHOICES.map((s) => (
          <button key={s} className="list-row" onClick={() => setDefaultRest(s)} aria-pressed={rest === s}>
            <span className="lr-body">
              <span className="lr-title tnum">{fmtClock(s)}</span>
            </span>
            {rest === s && <Check size={20} strokeWidth={3} className="pos" />}
          </button>
        ))}
      </div>
      <p className="muted small">
        Per un recupero diverso su un singolo esercizio: apri la scheda, «Modifica scheda» e scegli il recupero sotto l'esercizio.
      </p>
    </div>
  );
}

export function BackupSettings() {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted);
  }, []);

  async function doExport() {
    const data = await exportBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `allenamento-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function doImport(file: File) {
    try {
      const data = JSON.parse(await file.text());
      if (!confirm('Importare il backup? Tutti i dati attuali verranno sostituiti, anche sugli altri dispositivi sincronizzati.')) return;
      await importBackup(data);
      alert('Backup importato.');
      navigate('/impostazioni');
    } catch (e) {
      alert(`Import non riuscito: ${(e as Error).message}`);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="page">
      <PageHeader title="Backup" back={BACK} subtitle="Un file con schede, esercizi, allenamenti e impostazioni." />
      <div className="card">
        <div className="stack-s">
          <h3>Esporta</h3>
          <p className="muted small">Scarica un file da tenere da parte: utile prima di grosse modifiche.</p>
        </div>
        <button className="btn btn-primary" onClick={doExport}>
          <Download size={17} /> Esporta backup
        </button>
      </div>
      <div className="card">
        <div className="stack-s">
          <h3>Importa</h3>
          <p className="muted small">Sostituisce tutti i dati con quelli del file, anche sugli altri dispositivi sincronizzati.</p>
        </div>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          <Upload size={17} /> Importa backup
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
      </div>
      {persisted === false && (
        <p className="small">
          Il browser potrebbe cancellare i dati locali se lo spazio scarseggia.{' '}
          <button className="link" onClick={() => navigator.storage.persist().then(setPersisted)}>
            Chiedi di conservarli
          </button>
        </p>
      )}
      {persisted && <p className="muted small">Il browser conserva i dati di questo dispositivo in modo permanente.</p>}
    </div>
  );
}
