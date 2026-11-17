import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRightLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import { db, uid } from '../../db/db';
import { useSettings } from '../../db/repo';
import type { EquipmentGroup } from '../../db/types';
import { NumInput } from '../../components/NumInput';
import { PageHeader } from '../../components/PageHeader';
import { Link, navigate } from '../../router';
import { fmtNum } from '../../lib/format';
import { convertWeight } from '../../lib/progress';

const newGroup = (): EquipmentGroup => ({
  id: uid(),
  name: '',
  question: 'Quale versione hai usato?',
  variants: [
    { id: uid(), name: 'Versione 1', equiv: 10 },
    { id: uid(), name: 'Versione 2', equiv: 10 },
  ],
});

/** Un attrezzo con più versioni (es. le due Smith): nome, domanda, versioni ed equivalenze. */
export function EquipmentSettings({ id }: { id: string }) {
  const isNew = id === 'nuovo';
  const settings = useSettings();
  const exercises = useLiveQuery(() => db.exercises.toArray());
  const [g, setG] = useState<EquipmentGroup | null>(null);

  useEffect(() => {
    if (!settings || g) return;
    if (isNew) setG(newGroup());
    else {
      const found = settings.equipment.find((x) => x.id === id);
      if (found) setG(structuredClone(found));
    }
  }, [settings, g, id, isNew]);

  if (!settings) return <p className="page muted">Caricamento…</p>;
  if (!g)
    return (
      <div className="page">
        <PageHeader title="Attrezzo non trovato" back={{ to: '/impostazioni', label: 'Impostazioni' }} />
      </div>
    );

  const users = (exercises ?? []).filter((e) => e.equipmentId === g.id && !e.archived);
  const setVariant = (i: number, patch: Partial<EquipmentGroup['variants'][number]>) =>
    setG({ ...g, variants: g.variants.map((v, k) => (k === i ? { ...v, ...patch } : v)) });
  const valid = g.name.trim() && g.variants.length >= 2 && g.variants.every((v) => v.name.trim() && v.equiv > 0);

  async function save() {
    if (!valid) return;
    const clean = { ...g!, name: g!.name.trim(), variants: g!.variants.map((v) => ({ ...v, name: v.name.trim() })) };
    const equipment = isNew ? [...settings!.equipment, clean] : settings!.equipment.map((x) => (x.id === clean.id ? clean : x));
    await db.settings.update('settings', { equipment });
    navigate('/impostazioni');
  }

  async function remove() {
    const msg = users.length
      ? `Eliminare «${g!.name}»? ${users.length === 1 ? "L'esercizio collegato" : `I ${users.length} esercizi collegati`} non ti chiederanno più quale versione hai usato.`
      : `Eliminare «${g!.name}»?`;
    if (!confirm(msg)) return;
    await db.transaction('rw', db.settings, db.exercises, async () => {
      await db.settings.update('settings', { equipment: settings!.equipment.filter((x) => x.id !== g!.id) });
      for (const e of users) await db.exercises.update(e.id, { equipmentId: undefined });
    });
    navigate('/impostazioni', { replace: true });
  }

  // esempio concreto di conversione tra la prima e la seconda versione
  const [a, b] = g.variants;
  const sample = a && b && a.equiv > 0 && b.equiv > 0 ? a.equiv : undefined;

  return (
    <div className="page">
      <PageHeader title={isNew ? 'Nuovo attrezzo' : g.name || 'Attrezzo'} back={{ to: '/impostazioni', label: 'Impostazioni' }} />

      <div className="card form">
        <label className="field">
          <span>Nome</span>
          <input value={g.name} placeholder="Es. Smith machine" onChange={(e) => setG({ ...g, name: e.target.value })} />
        </label>
        <label className="field">
          <span>Domanda durante l'allenamento</span>
          <input value={g.question} onChange={(e) => setG({ ...g, question: e.target.value })} />
          <small>Compare all'inizio di ogni esercizio collegato a questo attrezzo.</small>
        </label>
      </div>

      <section className="section">
        <div className="section-title">
          <h2>Versioni</h2>
        </div>
        <p className="muted small">
          Per ogni versione indica il carico che dà <strong>lo stesso sforzo</strong>. Usa nomi che riconosci in palestra (es. «Smith
          vicino agli specchi»).
        </p>
        <div className="card">
          {g.variants.map((v, i) => (
            <div key={v.id} className="variant-row">
              <label className="field grow">
                <span>Versione {i + 1}</span>
                <input value={v.name} onChange={(e) => setVariant(i, { name: e.target.value })} />
              </label>
              <label className="field kg">
                <span>Carico (kg)</span>
                <NumInput value={v.equiv} onChange={(n) => setVariant(i, { equiv: n ?? 0 })} />
              </label>
              {g.variants.length > 2 && (
                <button
                  className="icon-btn"
                  aria-label={`Rimuovi ${v.name}`}
                  onClick={() => setG({ ...g, variants: g.variants.filter((_, k) => k !== i) })}
                >
                  <X size={18} />
                </button>
              )}
            </div>
          ))}
          <button
            className="btn btn-sm"
            style={{ alignSelf: 'flex-start' }}
            onClick={() =>
              setG({ ...g, variants: [...g.variants, { id: uid(), name: `Versione ${g.variants.length + 1}`, equiv: g.variants[0]?.equiv ?? 10 }] })
            }
          >
            <Plus size={15} /> Aggiungi versione
          </button>
        </div>
        {sample !== undefined && (
          <div className="banner accent">
            <ArrowRightLeft size={18} />
            <span>
              Stesso sforzo: {g.variants.map((v) => `${fmtNum(v.equiv)} kg su ${v.name || '?'}`).join(' = ')}. Se l'ultima volta hai
              fatto {fmtNum(sample * 1.2)} kg su {a.name || '?'}, su {b.name || '?'} ti propongo{' '}
              {fmtNum(convertWeight(sample * 1.2, a, b))} kg.
            </span>
          </div>
        )}
      </section>

      {!isNew && (
        <section className="section">
          <div className="section-title">
            <h2>Esercizi collegati</h2>
          </div>
          {users.length === 0 ? (
            <p className="muted small">
              Nessuno. Per collegarne uno apri l'esercizio (Sala pesi → Esercizi), tocca la matita e scegli «Attrezzo con più versioni».
            </p>
          ) : (
            <div className="card flush">
              {users.map((e) => (
                <Link key={e.id} to={`/pesi/esercizi/${e.id}`} className="list-row">
                  <span className="lr-body">
                    <span className="lr-title">{e.name}</span>
                  </span>
                  <ChevronRight size={18} className="chev" />
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="sticky-actions">
        {!isNew && (
          <button className="btn btn-danger-text btn-sm" onClick={remove}>
            <Trash2 size={16} /> Elimina
          </button>
        )}
        <span className="grow" />
        <button className="btn btn-sm" onClick={() => navigate('/impostazioni')}>
          Annulla
        </button>
        <button className="btn btn-primary btn-sm" disabled={!valid} onClick={save}>
          Salva
        </button>
      </div>
    </div>
  );
}
