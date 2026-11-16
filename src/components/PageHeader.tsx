import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Link } from '../router';

interface Props {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: { to: string; label: string };
  action?: ReactNode;
}

/** Intestazione di pagina: link indietro, titolo grande, sottotitolo e un'azione a destra. */
export function PageHeader({ title, subtitle, back, action }: Props) {
  return (
    <header className="page-header">
      {back && (
        <div className="ph-top">
          <Link to={back.to} className="back-link">
            <ChevronLeft size={22} />
            {back.label}
          </Link>
        </div>
      )}
      <div className="ph-title">
        <h1>{title}</h1>
        {action}
      </div>
      {subtitle && <p className="ph-sub">{subtitle}</p>}
    </header>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="es-ico">{icon}</div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}
