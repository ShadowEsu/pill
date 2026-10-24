// Medical mode: every decision line from every delivery, newest first, grouped by delivery. Dense, mono, exportable.
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

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return deliveries
      .filter((d) => !needle || d.lot.toLowerCase().includes(needle))
      // reverse first so lines logged in the same millisecond keep newest-first order (sort is stable)
      .map((d) => ({ d, lines: [...d.log].reverse().sort((a, b) => b.at - a.at) }))
      .sort((a, b) => (b.lines[0]?.at ?? 0) - (a.lines[0]?.at ?? 0));
  }, [deliveries, q]);
  const total = groups.reduce((n, g) => n + g.lines.length, 0);

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

      {groups.length === 0 ? (
        <div className="card" style={{ textAlign: 'center' }}><p className="muted">No delivery has a lot matching <span className="mono">{q}</span>.</p></div>
      ) : groups.map(({ d, lines }) => (
        <section key={d.id} className="card" style={{ padding: 0, overflow: 'hidden' }} aria-label={`${d.supplier}, lot ${d.lot}`}>
          <Link to={`/delivery/${d.id}`} className="row between" style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', textDecoration: 'none', gap: 10 }}>
            <span className="row" style={{ minWidth: 0, gap: 8, fontSize: 14 }}>
              <span className="mono" style={{ flex: 'none', fontSize: 13 }}>{d.lot}</span>
              <span style={{ minWidth: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.supplier}</span>
            </span>
            <OutcomeChip outcome={d.outcome} />
          </Link>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {lines.map((l, i) => (
              <li key={i} className="mono" style={{ display: 'grid', gridTemplateColumns: '58px 1fr', gap: 10, padding: '7px 14px 7px 12px', borderLeft: `2px solid ${KIND[l.kind]}`, borderTop: i ? '1px solid var(--line)' : 0, fontSize: 11.5, lineHeight: 1.45 }}>
                <span className="muted">{new Date(l.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                <span style={{ overflowWrap: 'anywhere' }}>{l.text}</span>
              </li>
            ))}
          </ol>
        </section>
      ))}

      <p className="footnote">Software proposes. A pharmacist releases. Every line is logged. Money lines are SANDBOX / TESTNET.</p>
      <Action note={status ?? undefined}>
        <button type="button" className="btn ghost" onClick={copyCsv} disabled={total === 0}>Copy as CSV</button>
      </Action>
    </Screen>
  );
}
