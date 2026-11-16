import { useEffect, useRef, useState } from 'react';
import { Timer, X } from 'lucide-react';
import { adjustRest, fmtClock, stopRest, useRestTimer } from '../lib/restTimer';

/** Barra in basso con il conto alla rovescia del recupero. A fine recupero vibra (su Android). */
export function RestTimerBar() {
  const rest = useRestTimer();
  const [now, setNow] = useState(Date.now());
  const signaled = useRef<number | null>(null);

  useEffect(() => {
    document.body.classList.toggle('has-rest', !!rest);
    if (!rest) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [rest]);

  const remaining = rest ? (rest.endsAt - now) / 1000 : 0;
  const finished = !!rest && remaining <= 0;

  useEffect(() => {
    if (!rest || !finished || signaled.current === rest.endsAt) return;
    signaled.current = rest.endsAt;
    if (document.visibilityState === 'visible') navigator.vibrate?.([250, 120, 250]);
    const t = setTimeout(stopRest, 5000);
    return () => clearTimeout(t);
  }, [rest, finished]);

  if (!rest) return null;
  const progress = Math.min(1, Math.max(0, 1 - remaining / rest.duration));

  return (
    <div className={`rest-bar${finished ? ' finished' : ''}`} role="timer" aria-live="polite">
      {!finished && <div className="rb-fill" style={{ transform: `scaleX(${progress})` }} />}
      <Timer size={22} />
      <div className="grow">
        <div className="rb-time">{finished ? 'Via!' : fmtClock(remaining)}</div>
        <div className="rb-label">{finished ? 'Recupero finito, prossima serie' : 'Recupero'}</div>
      </div>
      {!finished && (
        <>
          <button onClick={() => adjustRest(-15)} aria-label="Togli 15 secondi">
            −15
          </button>
          <button onClick={() => adjustRest(15)} aria-label="Aggiungi 15 secondi">
            +15
          </button>
        </>
      )}
      <button onClick={stopRest} aria-label="Chiudi timer">
        <X size={18} />
      </button>
    </div>
  );
}
