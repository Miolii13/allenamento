import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, ListChecks, Plus, Trash2 } from 'lucide-react';
import { db, uid } from '../../db/db';
import type { Program } from '../../db/types';
import { EmptyState, PageHeader } from '../../components/PageHeader';
import { initials, usePrograms } from '../../lib/programs';
import { Link, navigate } from '../../router';

/** Scheda: nome e allenamenti che contiene (ognuno con i suoi esercizi). */
export function ProgramEditor({ id }: { id: string }) {
  const isNew = id === 'nuova';
  const programs = usePrograms();
  const entry = programs?.find((p) => p.program.id === id);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (name !== null) return;
    if (isNew) setName('');
    else if (entry) setName(entry.program.name);
  }, [name, isNew, entry]);

  if (!programs || name === null) {
    if (programs && !isNew && !entry)
      return (
        <div className="page">
          <PageHeader title="Scheda non trovata" back={{ to: '/pesi', label: 'Oggi' }} />
        </div>
      );
    return <p className="page muted">Caricamento…</p>;
  }

  const days = entry?.templates ?? [];

  /** Salva la scheda (la crea se è nuova) e restituisce il suo id. */
  async function saveProgram(): Promise<string> {
    const now = Date.now();
    if (isNew) {
      const program: Program = {
        id: uid(),
        name: name!.trim() || 'Nuova scheda',
        order: Math.max(0, ...programs!.map((p) => p.program.order)) + 1,
        createdAt: now,
        updatedAt: now,
      };
      await db.programs.add(program);
      return program.id;
    }
    // anche la scheda predefinita "virtuale" diventa una scheda vera alla prima modifica
    await db.programs.put({ ...entry!.program, name: name!.trim() || entry!.program.name, createdAt: entry!.program.createdAt || now, updatedAt: now });
    return id;
  }

  async function save() {
    await saveProgram();
    navigate('/pesi');
  }

  async function addDay() {
    const pid = await saveProgram();
    navigate(`/pesi/allenamento/nuovo?scheda=${pid}`);
  }

  async function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= days.length) return;
    const list = [...days];
    [list[i], list[j]] = [list[j], list[i]];
    const orders = days.map((d) => d.order).sort((a, b) => a - b);
    await db.templates.bulkPut(list.map((t, k) => ({ ...t, programId: id, order: orders[k] ?? k + 1, updatedAt: Date.now() })));
  }

  async function remove() {
    const msg = days.length
      ? `Eliminare la scheda «${name}» e i suoi ${days.length} allenamenti? Gli allenamenti già fatti restano nello storico.`
      : `Eliminare la scheda «${name}»?`;
    if (!confirm(msg)) return;
    await db.transaction('rw', db.programs, db.templates, async () => {
      for (const t of days) await db.templates.delete(t.id);
      await db.programs.delete(id);
    });
    navigate('/pesi', { replace: true });
  }

  return (
    <div className="page">
      <PageHeader
        title={isNew ? 'Nuova scheda' : name || 'Scheda'}
        back={{ to: '/pesi', label: 'Oggi' }}
        subtitle="Una scheda raccoglie gli allenamenti che fai a rotazione (es. Upper 1, Lower, Upper 2); ogni allenamento ha i suoi esercizi."
      />

      <label className="field">
        <span>Nome della scheda</span>
        <input value={name} placeholder="Es. Upper/Lower novembre" onChange={(e) => setName(e.target.value)} />
      </label>

      <section className="section">
        <div className="section-title">
          <h2>Allenamenti</h2>
          <span className="muted small">{days.length}</span>
        </div>
        {days.length === 0 ? (
          <div className="card">
            <EmptyState icon={<ListChecks size={26} />} title="Nessun allenamento" text="Aggiungi il primo allenamento di questa scheda." />
          </div>
        ) : (
          <div className="card flush">
            {days.map((t, i) => (
              <div key={t.id} className="list-row" style={{ cursor: 'default' }}>
                <span className="tile-icon">{initials(t.name)}</span>
                <Link to={`/pesi/allenamento/${t.id}`} className="lr-body" style={{ color: 'inherit', textDecoration: 'none' }}>
                  <span className="lr-title">{t.name}</span>
                  <span className="lr-sub">
                    {t.items.length} esercizi · {t.items.reduce((n, it) => n + it.sets.length, 0)} serie
                  </span>
                </Link>
                <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Sposta ${t.name} prima`}>
                  <ArrowUp size={18} />
                </button>
                <button className="icon-btn" disabled={i === days.length - 1} onClick={() => move(i, 1)} aria-label={`Sposta ${t.name} dopo`}>
                  <ArrowDown size={18} />
                </button>
                <Link to={`/pesi/allenamento/${t.id}`} className="icon-btn" aria-label={`Apri ${t.name}`}>
                  <ChevronRight size={18} />
                </Link>
              </div>
            ))}
          </div>
        )}
        <button className="btn btn-block" onClick={addDay}>
          <Plus size={18} /> Aggiungi allenamento
        </button>
      </section>

      <div className="sticky-actions">
        {!isNew && (
          <button className="btn btn-danger-text btn-sm" onClick={remove}>
            <Trash2 size={16} /> Elimina scheda
          </button>
        )}
        <span className="grow" />
        <button className="btn btn-sm" onClick={() => navigate('/pesi')}>
          Annulla
        </button>
        <button className="btn btn-primary btn-sm" onClick={save}>
          Salva
        </button>
      </div>
    </div>
  );
}
