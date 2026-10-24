// Medical mode: every decision line from every delivery, newest first, grouped by delivery. Dense, mono, exportable.
// Motion: rows stagger in, money/hold rules draw down, the lot filter folds groups open and shut.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Action, Screen } from '../components/Shell';
import OutcomeChip from '../components/OutcomeChip';
import { useStore } from '../lib/store';
import type { LogLine } from '../lib/types';

const KIND: Record<LogLine['kind'], string> = { info: 'var(--line-2)', ok: 'var(--mint)', hold: 'var(--warm)', money: 'var(--cb)' };
const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export default function Log() {
  const deliveries = useStore((s) => s.deliveries);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  // every delivery stays mounted; the filter folds non-matching ones shut so height and opacity can animate
  const all = useMemo(() => deliveries
    // reverse first so lines logged in the same millisecond keep newest-first order (sort is stable)
    .map((d) => ({ d, lines: [...d.log].reverse().sort((a, b) => b.at - a.at) }))
    .sort((a, b) => (b.lines[0]?.at ?? 0) - (a.lines[0]?.at ?? 0)), [deliveries]);
  const needle = q.trim().toLowerCase();
  const groups = useMemo(() => all.filter(({ d }) => !needle || d.lot.toLowerCase().includes(needle)), [all, needle]);
  const total = groups.reduce((n, g) => n + g.lines.length, 0);
  const open = new Set(groups.map((g) => g.d.id));

  async function copyCsv() {
    const rows = groups.flatMap((g) => g.lines.map((l) => [new Date(l.at).toISOString(), g.d.id, g.d.lot, l.kind, l.text].map(csvCell).join(',')));
    const csv = ['at,delivery,lot,kind,text', ...rows].join('\n');
    try {
      await navigator.clipboard.writeText(csv);
      setStatus(`Copied ${rows.length} lines as CSV.`);
    } catch {
      setStatus('This browser blocked the clipboard. Nothing was copied.');
    }
  }

  return (
    <Screen title="Decision log" eyebrow="Medical · all deliveries" back="/deliveries">
      <label className="stack" style={{ gap: 6 }}>
        <span className="eyebrow">Filter by lot</span>
        <input type="text" value={q} onChange={(e) => { setQ(e.target.value); setStatus(null); }} placeholder="e.g. B2-07" className="mono" spellCheck={false} autoCapitalize="characters" />
      </label>
      <p className="mono muted" style={{ fontSize: 12 }} aria-live="polite">{total} lines · {groups.length} deliveries · newest first</p>

      {groups.length === 0 && (
        <div className="card log-empty" style={{ textAlign: 'center' }}><p className="muted">No delivery has a lot matching <span className="mono">{q}</span>.</p></div>
      )}
      <div className="log-groups">
        {all.map(({ d, lines }, g) => {
          const shut = !open.has(d.id);
          return (
            <div key={d.id} className={'log-fold' + (shut ? ' shut' : '')} inert={shut}>
              <section className="card" style={{ padding: 0, overflow: 'hidden' }} aria-label={`${d.supplier}, lot ${d.lot}`}>
                <Link to={`/delivery/${d.id}`} className="row between" style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', textDecoration: 'none', gap: 10 }}>
                  <span className="row" style={{ minWidth: 0, gap: 8, fontSize: 14 }}>
                    <span className="mono" style={{ flex: 'none', fontSize: 13 }}>{d.lot}</span>
                    <span style={{ minWidth: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.supplier}</span>
                  </span>
                  <OutcomeChip outcome={d.outcome} />
                </Link>
                <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {lines.map((l, i) => (
                    <li key={i} className={'mono log-row' + (l.kind === 'money' || l.kind === 'hold' ? ' draw' : '')}
                      style={{ '--g': Math.min(g, 8), '--i': Math.min(i, 10), '--rule': KIND[l.kind], display: 'grid', gridTemplateColumns: '58px 1fr', gap: 10, padding: '7px 14px', borderTop: i ? '1px solid var(--line)' : 0, fontSize: 11.5, lineHeight: 1.45 } as React.CSSProperties}>
                      <span className="muted">{new Date(l.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      <span style={{ overflowWrap: 'anywhere' }}>{l.text}</span>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          );
        })}
      </div>

      <p className="footnote">Software proposes. A pharmacist releases. Every line is logged. Money lines are SANDBOX / TESTNET.</p>
      <Action note={status ?? undefined}>
        <button type="button" className="btn ghost" onClick={copyCsv} disabled={total === 0}>Copy as CSV</button>
      </Action>
    </Screen>
  );
}
