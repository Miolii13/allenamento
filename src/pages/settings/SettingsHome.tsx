import type { ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarDays, ChevronRight, Cloud, CloudOff, DatabaseBackup, Plus, Timer, Wrench } from 'lucide-react';
import { db } from '../../db/db';
import { useSettings } from '../../db/repo';
import { Link } from '../../router';
import { PageHeader } from '../../components/PageHeader';
import { useSyncStatus } from '../../sync/controller';
import { fmtClock, useDefaultRest } from '../../lib/restTimer';
import { hasPlan, WEEKDAYS } from '../../lib/weekPlan';
import { daysAgo } from '../../lib/format';

const timeFmt = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });

export function SettingsRow({
  to,
  icon,
  tone = 'accent',
  title,
  sub,
}: {
  to: string;
  icon: ReactNode;
  tone?: 'accent' | 'success' | 'warning' | 'gold' | 'danger';
  title: string;
  sub?: ReactNode;
}) {
  return (
    <Link to={to} className="list-row">
      <span className={`tile-icon ${tone}`}>{icon}</span>
      <span className="lr-body">
        <span className="lr-title">{title}</span>
        {sub && <span className="lr-sub">{sub}</span>}
      </span>
      <ChevronRight size={18} className="chev" />
    </Link>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="settings-group">
      <div className="month-label">{title}</div>
      <div className="card flush">{children}</div>
      {note && <p className="muted xsmall settings-note">{note}</p>}
    </section>
  );
}

/** Menu delle impostazioni: ogni voce porta alla sua pagina e mostra il valore attuale. */
export function SettingsHome() {
  const settings = useSettings();
  const sync = useSyncStatus();
  const rest = useDefaultRest();
  const templates = useLiveQuery(() => db.templates.toArray());
  const exercises = useLiveQuery(() => db.exercises.toArray());

  const syncSub =
    sync.state === 'disabled'
      ? 'Non collegata'
      : sync.state === 'signed-out'
        ? 'Accedi per sincronizzare telefono e PC'
        : sync.state === 'error'
          ? 'Sincronizzazione non riuscita'
          : sync.state === 'syncing'
            ? 'Sincronizzazione in corso…'
            : sync.lastSync
              ? `Sincronizzato ${daysAgo(sync.lastSync)} alle ${timeFmt.format(sync.lastSync)}`
              : 'Connesso';

  const planSub = hasPlan(settings)
    ? settings!
        .weekPlan!.map((p, i) => {
          if (p.kind === 'run') return `${WEEKDAYS[i].slice(0, 3)} corsa`;
          if (p.kind === 'gym') return `${WEEKDAYS[i].slice(0, 3)} ${templates?.find((t) => t.id === p.templateId)?.name ?? '?'}`;
          return null;
        })
        .filter(Boolean)
        .join(' · ')
    : 'Non impostata';

  return (
    <div className="page">
      <PageHeader title="Impostazioni" />

      <Group title="Account">
        <SettingsRow
          to="/impostazioni/sincronizzazione"
          icon={sync.state === 'error' || sync.state === 'disabled' ? <CloudOff size={19} /> : <Cloud size={19} />}
          tone={sync.state === 'error' ? 'danger' : 'accent'}
          title="Sincronizzazione"
          sub={syncSub}
        />
      </Group>

      <Group title="Allenamento">
        <SettingsRow to="/impostazioni/settimana" icon={<CalendarDays size={19} />} tone="success" title="Settimana tipo" sub={planSub} />
        <SettingsRow
          to="/impostazioni/recupero"
          icon={<Timer size={19} />}
          tone="success"
          title="Recupero predefinito"
          sub={`${fmtClock(rest)} tra una serie e l'altra`}
        />
      </Group>

      <Group
        title="Attrezzatura"
        note="Attrezzi che hai in più versioni con pesi diversi: durante l'allenamento ti chiedo quale hai usato e converto i carichi."
      >
        {settings?.equipment.map((g) => {
          const n = exercises?.filter((e) => e.equipmentId === g.id).length ?? 0;
          return (
            <SettingsRow
              key={g.id}
              to={`/impostazioni/attrezzi/${g.id}`}
              icon={<Wrench size={18} />}
              tone="warning"
              title={g.name}
              sub={`${g.variants.map((v) => v.name).join(' · ')} — ${n} ${n === 1 ? 'esercizio' : 'esercizi'}`}
            />
          );
        })}
        <SettingsRow to="/impostazioni/attrezzi/nuovo" icon={<Plus size={19} />} tone="warning" title="Aggiungi attrezzo" />
      </Group>

      <Group title="Dati">
        <SettingsRow to="/impostazioni/backup" icon={<DatabaseBackup size={19} />} tone="gold" title="Backup" sub="Esporta o importa tutti i tuoi dati" />
      </Group>
    </div>
  );
}
