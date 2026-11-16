import { useEffect, useRef, useState } from 'react';
import { fmtDateShort, fmtNum } from '../lib/format';

export interface ChartPoint {
  ts: number;
  value: number;
  detail?: string;
}

function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || Math.abs(max) || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  const step = (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  const ticks: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= Math.ceil(max / step) * step + step / 1e6; v += step) ticks.push(v);
  if (ticks.length < 2) ticks.push(ticks[0] + step);
  return ticks;
}

/** Linea singola con crosshair e tooltip: andamento di un esercizio nel tempo. */
export function ProgressChart({ points, unit }: { points: ChartPoint[]; unit: string }) {
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

  if (points.length < 2) {
    return <p className="muted small">Il grafico compare dopo almeno 2 sessioni.</p>;
  }

  const height = 180;
  const m = { t: 14, r: 16, b: 24, l: 40 };
  const iw = width - m.l - m.r;
  const ih = height - m.t - m.b;
  const t0 = points[0].ts;
  const t1 = points[points.length - 1].ts;
  const values = points.map((p) => p.value);
  const ticks = niceTicks(Math.min(...values), Math.max(...values));
  const y0 = ticks[0];
  const y1 = ticks[ticks.length - 1];
  const x = (ts: number) => m.l + (t1 === t0 ? iw / 2 : ((ts - t0) / (t1 - t0)) * iw);
  const y = (v: number) => m.t + ih - ((v - y0) / (y1 - y0 || 1)) * ih;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.ts).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  const last = points[points.length - 1];

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left + m.l;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p.ts) - px) < Math.abs(x(points[best].ts) - px)) best = i;
    });
    setHover(best);
  }

  const hp = hover !== null ? points[hover] : null;

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={`Andamento: ultimo valore ${fmtNum(Math.round(last.value))} ${unit}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} />
            <text className="axis" x={m.l - 6} y={y(t)} dy="0.32em" textAnchor="end">
              {fmtNum(t)}
            </text>
          </g>
        ))}
        <text className="axis" x={m.l} y={height - 6}>
          {fmtDateShort(t0)}
        </text>
        <text className="axis" x={width - m.r} y={height - 6} textAnchor="end">
          {fmtDateShort(t1)}
        </text>
        <path className="series-area" d={`${d}L${x(t1)},${m.t + ih}L${x(t0)},${m.t + ih}Z`} />
        <path className="series-line" d={d} />
        {points.map((p, i) => (
          <circle key={i} className="series-dot" cx={x(p.ts)} cy={y(p.value)} r={i === points.length - 1 || i === hover ? 5 : 3} />
        ))}
        {hp && <line className="crosshair" x1={x(hp.ts)} x2={x(hp.ts)} y1={m.t} y2={m.t + ih} />}
        <rect
          x={m.l}
          y={0}
          width={iw}
          height={height}
          fill="transparent"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {hp && (
        <div
          className="chart-tip"
          style={{ left: Math.min(Math.max(x(hp.ts), 70), width - 70), top: Math.max(0, y(hp.value) - 58) }}
        >
          <strong>
            {fmtNum(Math.round(hp.value * 10) / 10)} {unit}
          </strong>
          <span>{fmtDateShort(hp.ts)}</span>
          {hp.detail && <span>{hp.detail}</span>}
        </div>
      )}
    </div>
  );
}
