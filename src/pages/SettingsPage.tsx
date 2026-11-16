import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Download, Plus, Upload, X } from 'lucide-react';
import { db, uid } from '../db/db';
import { exportBackup, importBackup, useSettings } from '../db/repo';
import type { EquipmentGroup } from '../db/types';
import { NumInput } from '../components/NumInput';
import { PageHeader } from '../components/PageHeader';
import { fmtNum } from '../lib/format';
import { fmtClock, getDefaultRest, REST_OPTIONS, setDefaultRest } from '../lib/restTimer';
import { SyncCard } from './SyncCard';
import { WeekPlanSheet } from '../components/WeekPlanSheet';
import { planLabel, WEEKDAYS } from '../lib/weekPlan';
import { useLiveQuery } from 'dexie-react-hooks';

// il valore predefinito del recupero sta in localStorage: lo rileggo quando cambia
const restSubs = new Set<() => void>();
function useDefaultRest() {
  return useSyncExternalStore(
    (fn) => {
      restSubs.add(fn);
      return () => restSubs.delete(fn);
    },
    getDefaultRest,
  );
}

export function SettingsPage() {
  const settings = useSettings();
  const [equipment, setEquipment] = useState<EquipmentGroup[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rest = useDefaultRest();
  const [editPlan, setEditPlan] = useState(false);
  const templates = useLiveQuery(() => db.templates.toArray());

  useEffect(() => {
    if (settings && !equipment) setEquipment(structuredClone(settings.equipment));
  }, [settings, equipment]);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted);
  }, []);

  if (!equipment) return <p className="page muted">Caricamento…</p>;

  const setGroup = (gi: number, g: EquipmentGroup) => {
    setSaved(false);
    setEquipment(equipment.map((x, i) => (i === gi ? g : x)));
  };

  async function saveEquipment() {
    const valid = equipment!.every((g) => g.name.trim() && g.variants.length >= 2 && g.variants.every((v) => v.name.trim() && v.equiv > 0));
    if (!valid) {
      alert('Ogni attrezzo deve avere un nome e almeno 2 versioni con nome e carico maggiore di zero.');
      return;
    }
    // solo gli attrezzi: il resto delle impostazioni (es. settimana tipo) resta com'è
    const updated = await db.settings.update('settings', { equipment: equipment! });
    if (!updated) await db.settings.put({ id: 'settings', equipment: equipment! });
    setSaved(true);
  }

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
      setEquipment(null);
      alert('Backup importato.');
    } catch (e) {
      alert(`Import non riuscito: ${(e as Error).message}`);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="page">
      <PageHeader title="Impostazioni" />

      <section className="section">
        <div className="section-title">
          <h2>Sincronizzazione</h2>
        </div>
        <SyncCard />
      </section>

      <section className="section">
        <div className="section-title">
          <h2>Settimana tipo</h2>
          <button className="link" onClick={() => setEditPlan(true)}>
            Modifica
          </button>
        </div>
        <div className="card flush">
          {WEEKDAYS.map((day, i) => (
            <div key={day} className="list-row" style={{ minHeight: 48, cursor: 'default' }}>
              <span className="lr-body">
                <span>{day}</span>
              </span>
              <span className={settings?.weekPlan?.[i]?.kind === 'gym' ? 'strong' : 'muted'}>
                {planLabel(settings?.weekPlan?.[i], templates)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-title">
          <h2>Recupero predefinito</h2>
        </div>
        <div className="card">
          <p className="muted small">
            Il timer parte da solo quando segni una serie. Vale per gli esercizi che nella scheda non hanno un recupero
            impostato; durante il recupero puoi aggiungere o togliere 15 secondi.
          </p>
          <div className="segmented">
            {REST_OPTIONS.map((s) => (
              <button
                key={s}
                className={rest === s ? 'active' : undefined}
                onClick={() => {
                  setDefaultRest(s);
                  restSubs.forEach((fn) => fn());
                }}
              >
                {fmtClock(s)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-title">
          <h2>Attrezzi con più versioni</h2>
        </div>
        <div className="card">
          <p className="muted small">
            Per gli esercizi collegati a questi attrezzi ti chiedo quale versione hai usato e converto i pesi della volta prima. Il
            carico indica lo stesso sforzo su ogni versione. Usa nomi che riconosci in palestra (es. «Smith vicino agli specchi»).
          </p>
          {equipment.map((g, gi) => (
            <div key={g.id} className="equip">
              <label className="field">
                <span>Attrezzo</span>
                <input value={g.name} onChange={(e) => setGroup(gi, { ...g, name: e.target.value })} />
              </label>
              <label className="field">
                <span>Domanda durante l'allenamento</span>
                <input value={g.question} onChange={(e) => setGroup(gi, { ...g, question: e.target.value })} />
              </label>
              {g.variants.map((v, vi) => (
                <div key={v.id} className="variant-row">
                  <label className="field grow">
                    <span>Versione {vi + 1}</span>
                    <input
                      value={v.name}
                      onChange={(e) =>
                        setGroup(gi, { ...g, variants: g.variants.map((x, k) => (k === vi ? { ...x, name: e.target.value } : x)) })
                      }
                    />
                  </label>
                  <label className="field kg">
                    <span>Carico</span>
                    <NumInput
                      value={v.equiv}
                      onChange={(n) =>
                        setGroup(gi, { ...g, variants: g.variants.map((x, k) => (k === vi ? { ...x, equiv: n ?? 0 } : x)) })
                      }
                    />
                  </label>
                  {g.variants.length > 2 && (
                    <button
                      className="icon-btn"
                      aria-label="Rimuovi versione"
                      onClick={() => setGroup(gi, { ...g, variants: g.variants.filter((_, k) => k !== vi) })}
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              ))}
              <p className="equiv-text">{g.variants.map((v) => `${fmtNum(v.equiv)} kg su ${v.name || '?'}`).join(' = ')}</p>
              <button
                className="btn btn-sm"
                onClick={() =>
                  setGroup(gi, {
                    ...g,
                    variants: [...g.variants, { id: uid(), name: `Versione ${g.variants.length + 1}`, equiv: g.variants[0]?.equiv ?? 1 }],
                  })
                }
              >
                <Plus size={15} /> Versione
              </button>
            </div>
          ))}
          <div className="row" style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <button
              className="btn btn-sm"
              onClick={() => {
                setSaved(false);
                setEquipment([
                  ...equipment,
                  {
                    id: uid(),
                    name: 'Nuovo attrezzo',
                    question: 'Quale versione hai usato?',
                    variants: [
                      { id: uid(), name: 'Versione 1', equiv: 10 },
                      { id: uid(), name: 'Versione 2', equiv: 10 },
                    ],
                  },
                ]);
              }}
            >
              <Plus size={15} /> Attrezzo
            </button>
            <span className="grow" />
            {saved && <span className="pos small strong">Salvato</span>}
            <button className="btn btn-primary btn-sm" onClick={saveEquipment}>
              Salva attrezzi
            </button>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-title">
          <h2>Backup</h2>
        </div>
        <div className="card">
          <p className="muted small">
            Un file con tutti i tuoi dati, da tenere da parte o reimportare. L'import sostituisce tutto, anche sugli altri dispositivi
            sincronizzati.
          </p>
          <div className="row">
            <button className="btn grow" onClick={doExport}>
              <Download size={17} /> Esporta
            </button>
            <button className="btn grow" onClick={() => fileRef.current?.click()}>
              <Upload size={17} /> Importa
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])}
            />
          </div>
          {persisted === false && (
            <p className="small">
              Il browser potrebbe cancellare i dati locali se lo spazio scarseggia.{' '}
              <button className="link" onClick={() => navigator.storage.persist().then(setPersisted)}>
                Chiedi di conservarli
              </button>
            </p>
          )}
        </div>
      </section>
      {editPlan && <WeekPlanSheet onClose={() => setEditPlan(false)} />}
    </div>
  );
}
