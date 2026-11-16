import { useEffect, useRef, useState } from 'react';
import { db, uid } from '../db/db';
import { exportBackup, importBackup, useSettings } from '../db/repo';
import type { EquipmentGroup } from '../db/types';
import { NumInput } from '../components/NumInput';
import { fmtNum } from '../lib/format';
import { SyncCard } from './SyncCard';

export function SettingsPage() {
  const settings = useSettings();
  const [equipment, setEquipment] = useState<EquipmentGroup[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
    await db.settings.put({ id: 'settings', equipment: equipment! });
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
      if (!confirm('Importare il backup? Tutti i dati attuali su questo dispositivo verranno sostituiti.')) return;
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
      <header className="page-head">
        <h1>Impostazioni</h1>
      </header>

      <SyncCard />

      <section className="card">
        <h2>Attrezzi con più versioni</h2>
        <p className="muted small">
          Per gli esercizi collegati a questi attrezzi, durante il workout ti chiedo quale versione hai usato e converto i pesi
          della volta prima. Il carico indica lo stesso sforzo su ogni versione. Dai alle versioni nomi che riconosci in
          palestra (es. «Smith vicino agli specchi»).
        </p>
        {equipment.map((g, gi) => (
          <div key={g.id} className="equip">
            <div className="row gap">
              <label className="field compact grow">
                <span>Attrezzo</span>
                <input value={g.name} onChange={(e) => setGroup(gi, { ...g, name: e.target.value })} />
              </label>
            </div>
            <label className="field compact">
              <span>Domanda durante il workout</span>
              <input value={g.question} onChange={(e) => setGroup(gi, { ...g, question: e.target.value })} />
            </label>
            {g.variants.map((v, vi) => (
              <div key={v.id} className="row gap variant-row">
                <label className="field compact grow">
                  <span>Versione {vi + 1}</span>
                  <input
                    value={v.name}
                    onChange={(e) =>
                      setGroup(gi, { ...g, variants: g.variants.map((x, k) => (k === vi ? { ...x, name: e.target.value } : x)) })
                    }
                  />
                </label>
                <label className="field compact kg">
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
                    className="btn ghost icon"
                    aria-label="Rimuovi versione"
                    onClick={() => setGroup(gi, { ...g, variants: g.variants.filter((_, k) => k !== vi) })}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <p className="equiv-text">
              {g.variants.map((v) => `${fmtNum(v.equiv)} kg su ${v.name || '?'}`).join(' = ')}
            </p>
            <button
              className="btn small ghost"
              onClick={() =>
                setGroup(gi, { ...g, variants: [...g.variants, { id: uid(), name: `Versione ${g.variants.length + 1}`, equiv: g.variants[0]?.equiv ?? 1 }] })
              }
            >
              + Versione
            </button>
          </div>
        ))}
        <div className="row gap">
          <button
            className="btn ghost small"
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
            + Attrezzo
          </button>
          <span className="grow" />
          {saved && <span className="pos small">Salvato</span>}
          <button className="btn primary" onClick={saveEquipment}>
            Salva attrezzi
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Backup dei dati</h2>
        <p className="muted small">
          I dati sono salvati in questo browser (e sul server, se la sincronizzazione è attiva). Il backup è un file JSON
          che puoi reimportare qui o su un altro dispositivo: l'import sostituisce tutto, anche sugli altri dispositivi
          sincronizzati.
        </p>
        <div className="row gap wrap">
          <button className="btn" onClick={doExport}>
            Esporta backup
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Importa backup
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
            Il browser potrebbe cancellare i dati se lo spazio scarseggia.{' '}
            <button className="link" onClick={() => navigator.storage.persist().then(setPersisted)}>
              Chiedi di conservarli
            </button>
          </p>
        )}
        {persisted && <p className="muted small">Il browser conserva i dati in modo permanente.</p>}
      </section>
    </div>
  );
}
