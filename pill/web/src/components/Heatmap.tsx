// Heat map: rows × cols of rounded cells on the --heat-0…4 ramp; null = hatched empty. Cells pop in 12 ms apart;
// hover (or focus) floats a tooltip over the cell; a tap pins the caption line.
import { useRef, useState } from 'react';
import './viz.css';

export type Heat = 0 | 1 | 2 | 3 | 4 | null;

export default function Heatmap({ rows, cols, value, rowLabels, colLabels, legend, cellText, onCell, label, rowWidth = 64, cellHeight }: {
  rows: number; cols: number; value: (r: number, c: number) => Heat;
  rowLabels: string[]; colLabels: string[];
  legend: { v: Heat; label: string }[];
  /** words for one cell, shown as the title and in the caption when tapped */ cellText?: (r: number, c: number) => string;
  onCell?: (r: number, c: number) => void; label: string; rowWidth?: number; cellHeight?: number;
}) {
  const [pick, setPick] = useState<[number, number] | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; text: string; flip: 'l' | 'r' | 'c' } | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const showTip = (el: HTMLElement, text: string) => {
    const g = grid.current;
    if (!g) return;
    const x = el.offsetLeft + el.offsetWidth / 2;
    setTip({ x, y: el.offsetTop, text, flip: x < 115 ? 'l' : x > g.clientWidth - 115 ? 'r' : 'c' });
  };
  const words = (r: number, c: number) => {
    if (cellText) return cellText(r, c);
    const v = value(r, c);
    return `${rowLabels[r]} · ${colLabels[c]} · ${legend.find((l) => l.v === v)?.label ?? 'no data'}`;
  };
  const cells = [];
  for (let r = 0; r < rows; r++) {
    cells.push(<span key={'r' + r} className="heat-row" title={rowLabels[r]}>{rowLabels[r]}</span>);
    for (let c = 0; c < cols; c++) {
      const v = value(r, c);
      const on = pick?.[0] === r && pick?.[1] === c;
      cells.push(
        <button key={r + '-' + c} type="button" className={'heat-cell ' + (v === null ? 'empty' : 'v' + v) + (on ? ' on' : '')}
          style={{ animationDelay: `${Math.min(r * cols + c, 100) * 12}ms`, height: cellHeight }}
          aria-label={words(r, c)} aria-pressed={on}
          onMouseEnter={(e) => showTip(e.currentTarget, words(r, c))} onFocus={(e) => showTip(e.currentTarget, words(r, c))}
          onMouseLeave={() => setTip(null)} onBlur={() => setTip(null)}
          onClick={() => { setPick(on ? null : [r, c]); onCell?.(r, c); }} />,
      );
    }
  }
  return (
    <div className="stack" style={{ gap: 8, minWidth: 0 }}>
      <div ref={grid} className="heat" role="group" aria-label={label} style={{ gridTemplateColumns: `${rowWidth}px repeat(${cols}, minmax(0, 1fr))` }}>
        <span />
        {colLabels.map((c, i) => <span key={i} className="heat-col">{c}</span>)}
        {cells}
        {tip && <span key={tip.text} className={'heat-tip ' + tip.flip} role="tooltip" style={{ left: tip.x, top: tip.y }}>{tip.text}</span>}
      </div>
      <p className="heat-caption" aria-live="polite">{pick ? words(pick[0], pick[1]) : 'Tap a cell for details'}</p>
      <div className="legend">
        {legend.map((l) => <span key={String(l.v) + l.label}><i className={'heat-cell ' + (l.v === null ? 'empty' : 'v' + l.v)} style={{ animation: 'none', height: 10, width: 10 }} />{l.label}</span>)}
      </div>
    </div>
  );
}
