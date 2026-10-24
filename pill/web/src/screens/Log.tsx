// Medical mode: every decision line from every delivery, newest first, grouped by delivery. A mono ledger: alternating tints,
// a type chip per line, money/hold rules that draw down, totals by type, and an export that copies the CSV.
// Motion: rows stagger in, rules draw, the lot filter folds groups open and shut, the copy button confirms with a drawn check.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Action, Screen } from '../components/Shell';
import OutcomeChip from '../components/OutcomeChip';
import Glyph from '../components/Glyph';
import { useStore } from '../lib/store';
import type { LogLine } from '../lib/types';
import '../story.css';

const KIND: Record<LogLine['kind'], string> = { info: 'var(--line-2)', ok: 'var(--mint)', hold: 'var(--warm)', money: 'var(--cb)' };
const WORD: Record<LogLine['kind'], string> = { info: 'note', ok: 'done', hold: 'hold', money: 'money' };
const KINDS: LogLine['kind'][] = ['money', 'hold', 'ok', 'info'];
const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export default function Log() {
  const deliveries = useStore((s) => s.deliveries);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(0);

  // every delivery stays mounted; the filter folds non-matching ones shut so height and opacity can animate
  const all = useMemo(() => deliveries
    // reverse first so lines logged in the same millisecond keep newest-first order (sort is stable)
    .map((d) => ({ d, lines: [...d.log].reverse().sort((a, b) => b.at - a.at) }))
    .sort((a, b) => (b.lines[0]?.at ?? 0) - (a.lines[0]?.at ?? 0)), [deliveries]);
  const needle = q.trim().toLowerCase();
  const groups = useMemo(() => all.filter(({ d }) => !needle || d.lot.toLowerCase().includes(needle)), [all, needle]);
  const total = groups.reduce((n, g) => n + g.lines.length, 0);
  const open = new Set(groups.map((g) => g.d.id));
  const byKind = KINDS.map((k) => ({ k, n: groups.reduce((n, g) => n + g.lines.filter((l) => l.kind === k).length, 0) }));

  async function copyCsv() {
    const rows = groups.flatMap((g) => g.lines.map((l) => [new Date(l.at).toISOString(), g.d.id, g.d.lot, l.kind, l.text].map(csvCell).join(',')));
    const csv = ['at,delivery,lot,kind,text', ...rows].join('\n');
    try {
      await navigator.clipboard.writeText(csv);
      setStatus(`Copied ${rows.length} lines as CSV.`);
      setCopied((c) => c + 1);
    } catch {
      setStatus('This browser blocked the clipboard. Nothing was copied.');
    }
  }

  return (
    <Screen title="Decision log" tone="violet" eyebrow="Medical · all deliveries" back="/deliveries"
      art={<span className="runs-art" aria-hidden="true"><Glyph name="escrow" size={50} /><Glyph name="wallet" size={40} delay={200} /></span>}
      right={<button type="button" className="chip log-export" onClick={copyCsv} disabled={total === 0}>Export CSV</button>}>
      <div className="log-top">
        <label className="stack" style={{ gap: 6 }}>
          <span className="eyebrow">Filter by lot</span>
          <input type="text" value={q} onChange={(e) => { setQ(e.target.value); setStatus(null); }} placeholder="e.g. B2-07" className="mono" spellCheck={false} autoCapitalize="characters" />
        </label>
        <div className="log-kinds" aria-label="Lines by type">
          {byKind.map(({ k, n }, i) => (
            <span key={k} className="log-kind" style={{ '--rule': KIND[k], '--i': i } as React.CSSProperties}>
              <span className="num">{n}</span><span className="chip"><span className="dot" style={{ background: KIND[k] }} />{WORD[k]}</span>
            </span>
          ))}
        </div>
      </div>
      <p className="mono muted" style={{ fontSize: 12 }} aria-live="polite">{total} lines · {groups.length} deliveries · newest first</p>

      {groups.length === 0 && (
        <div className="card log-empty" style={{ textAlign: 'center', display: 'grid', justifyItems: 'center', gap: 8 }}><Glyph name="escrow" size={56} /><p className="muted">No delivery has a lot matching <span className="mono">{q}</span>.</p></div>
      )}
      <div className="log-groups">
        {all.map(({ d, lines }, g) => {
          const shut = !open.has(d.id);
          return (
            <div key={d.id} className={'log-fold' + (shut ? ' shut' : '')} inert={shut}>
              <section className="card ledger" style={{ padding: 0, overflow: 'hidden' }} aria-label={`${d.supplier}, lot ${d.lot}`}>
                <Link to={`/delivery/${d.id}`} className="ledger-head">
                  <span className="row" style={{ minWidth: 0, gap: 10, fontSize: 14 }}>
                    <span className="ledger-lot mono">{d.lot}</span>
                    <span style={{ minWidth: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.supplier}</span>
                  </span>
                  <span className="row" style={{ gap: 8, flex: 'none' }}>
                    <span className="num muted" style={{ fontSize: 12 }}>${d.amountUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    <OutcomeChip outcome={d.outcome} />
                  </span>
                </Link>
                <ol className="ledger-rows">
                  {lines.map((l, i) => (
                    <li key={i} className={'mono log-row ledger-row' + (l.kind === 'money' || l.kind === 'hold' ? ' draw' : '')}
                      style={{ '--g': Math.min(g, 8), '--i': Math.min(i, 10), '--rule': KIND[l.kind] } as React.CSSProperties}>
                      <span className="muted">{new Date(l.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      <span className={'chip ledger-kind k-' + l.kind}><span className="dot" style={{ background: KIND[l.kind] }} />{WORD[l.kind]}</span>
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
        <button type="button" className="btn ghost" onClick={copyCsv} disabled={total === 0}>
          {copied > 0 && <svg key={copied} className="med-check draw" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.6" pathLength={1} /><path d="M6 10.4 8.7 13 14 7.4" pathLength={1} /></svg>}
          Copy as CSV
        </button>
      </Action>
    </Screen>
  );
}
