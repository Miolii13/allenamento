import type { ReactNode } from 'react';
import { EmptyState, PageHeader } from '../components/PageHeader';

export function ComingSoon({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="page">
      <PageHeader title={title} />
      <div className="card">
        <EmptyState icon={icon} title="In arrivo" text={text} />
      </div>
    </div>
  );
}
