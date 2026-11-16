import { useEffect, useRef, useState } from 'react';
import { niceTicks } from './ProgressChart';

export interface BarDatum {
  label: string;
  title: string;
  value: number;
  detail?: string;
}

/** Colonne verticali a una serie, con tooltip al passaggio o al tocco. */
export function BarChart({ data, format }: { data: BarDatum[]; format: (v: number) => string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(200, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const height = 190;
  const m = { t: 12, r: 4, b: 26, l: 44 };
  const iw = width - m.l - m.r;
  const ih = height - m.t - m.b;
  const max = Math.max(0, ...data.map((d) => d.value));
  const ticks = niceTicks(0, max || 1, 3);
  const top = ticks[ticks.length - 1] || 1;
  const y = (v: number) => m.t + ih - (v / top) * ih;
  const band = iw / Math.max(1, data.length);
  // colonne al massimo 24px, e mai a riempire tutto lo spazio: il resto è aria tra le barre
  const barW = Math.min(24, Math.max(3, band * 0.68));
  const step = Math.ceil(data.length / 6);
  const hd = hover !== null ? data[hover] : null;

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label="Grafico a barre">
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} />
            <text className="axis" x={m.l - 6} y={y(t)} dy="0.32em" textAnchor="end">
              {format(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = m.l + band * i + band / 2;
          const x0 = cx - barW / 2;
          const x1 = cx + barW / 2;
          const yb = y(0);
          const yt = y(d.value);
          const h = yb - yt;
          const r = Math.min(4, barW / 2, h);
          const showLabel = i % step === 0 && (i === data.length - 1 || data.length - 1 - i >= step / 2 || step === 1);
          return (
            <g key={i}>
              {h > 0 && (
                <path
                  className={`bar${hover !== null && hover !== i ? ' dim' : ''}`}
                  d={`M${x0},${yb} V${yt + r} Q${x0},${yt} ${x0 + r},${yt} H${x1 - r} Q${x1},${yt} ${x1},${yt + r} V${yb} Z`}
                />
              )}
              {(showLabel || i === data.length - 1) && (
                <text
                  className="axis"
                  x={i === data.length - 1 ? Math.min(cx + band / 2, width - m.r) : i === 0 ? Math.max(cx - band / 2, m.l) : cx}
                  y={height - 8}
                  textAnchor={i === data.length - 1 ? 'end' : i === 0 ? 'start' : 'middle'}
                >
                  {d.label}
                </text>
              )}
              <rect
                x={m.l + band * i}
                y={m.t}
                width={band}
                height={ih}
                fill="transparent"
                onPointerEnter={() => setHover(i)}
                onPointerDown={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
              />
            </g>
          );
        })}
      </svg>
      {hd && hover !== null && (
        <div
          className="chart-tip"
          style={{ left: Math.min(Math.max(m.l + band * hover + band / 2, 80), width - 80), top: Math.max(0, y(hd.value) - 64) }}
        >
          <strong>{format(hd.value)}</strong>
          <span>{hd.title}</span>
          {hd.detail && <span>{hd.detail}</span>}
        </div>
      )}
    </div>
  );
}
