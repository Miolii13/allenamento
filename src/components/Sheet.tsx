import { useEffect, type ReactNode } from 'react';

/** Pannello modale: dal basso su telefono, centrato su schermi larghi. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="btn ghost icon" onClick={onClose} aria-label="Chiudi">
            ✕
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
