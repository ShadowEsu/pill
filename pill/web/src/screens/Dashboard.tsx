// Medical dashboard ("/"): KPIs with trends, today's timetable, verdicts by lot × day, the money path, who did what, suppliers.
// Every number here is derived from the store; nothing is hard-coded. Money is SANDBOX / TESTNET.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Screen } from '../components/Shell';
import Kpi from '../components/Kpi';
import Timetable, { type TItem } from '../components/Timetable';
import Heatmap, { type Heat } from '../components/Heatmap';
import FlowArrows from '../components/FlowArrows';
import ActorAvatar from '../components/ActorAvatar';
import Curve from '../components/Curve';
import BinaryPill from '../components/BinaryPill';
import Glyph from '../components/Glyph';
import { useStore } from '../lib/store';
import { useReducedMotion } from '../lib/motion';
import { curve } from '../lib/rules';
import { PEOPLE } from '../data/history';
import { REFERENCES } from '../data/reference';
import type { Activity, Delivery, Reference, Run, Verdict } from '../lib/types';
import { DAY, H, dayStart, hm, hourOf, refTo, usd, useNow } from '../lib/when';
import EmptyState, { SettingsLink } from '../components/EmptyState';
import { scorecard } from '../lib/agent';
import '../components/viz.css';
import '../story.css';

const SAMPLE_MS = 110, LOOP_REST = 2200;

/** The station's last run, replayed slowly on a loop: the curve draws itself and the readout ticks. Reduced motion: the whole run. */
function StationPulse({ run, band, online }: { run: Run | undefined; band: Reference | null; online: boolean }) {
  const reduce = useReducedMotion();
  const total = run?.samples.length ?? 0;
  const [n, setN] = useState(reduce ? total : 2);
  useEffect(() => {
    if (reduce || total < 3) return;
    let k = 2, id = 0;
    const tick = () => {
      k = k >= total ? 2 : k + 1;
      setN(k);
      id = window.setTimeout(tick, k >= total ? LOOP_REST : SAMPLE_MS);
    };
    id = window.setTimeout(tick, SAMPLE_MS);
    return () => clearTimeout(id);
  }, [reduce, total]);
  if (!run || total < 3) return <EmptyState art="clock" action={<Link to="/run/new?replay=B2-07" className="btn ghost" style={{ textDecoration: 'none' }}>Run a replay</Link>}>No run on this station yet. The first one plays here.</EmptyState>;
  const shown = run.samples.slice(0, reduce ? total : n);
  const tip = curve(shown).at(-1)!;
  const mmss = `${Math.floor(tip.t / 60)}:${String(Math.round(tip.t % 60)).padStart(2, '0')}`;
  return (
    <div className="spulse">
      <div className="pulse-curve"><Curve samples={shown} band={band} width={360} height={150} live={n < total} /></div>
      <dl className="pulse-read">
        <div><dt>run</dt><dd>{run.lot}</dd></div>
        <div><dt>time</dt><dd>{mmss}</dd></div>
        <div><dt>A(t)</dt><dd>{tip.a.toFixed(3)}</dd></div>
        <div><dt>glow</dt><dd>{tip.g.toFixed(3)}</dd></div>
      </dl>
      <p className="footnote"><span className={'pulse-dot' + (online ? ' on' : '')} aria-hidden="true" />Replaying the last run ({run.id}, {run.evaluation?.verdict ?? 'running'}) at its own pace. Demo data.</p>
    </div>
  );
}

const HELD: Record<Delivery['outcome'], boolean> = { pending: false, release: false, released: false, hold: true, escalate: true };
const HEAT: Record<Verdict, Heat> = { PASS: 4, 'NEEDS LAB': 2, 'UNABLE TO VERIFY': 1 };
const loggedAt = (d: Delivery) => d.log[0]?.at ?? 0;
const sum = (ds: Delivery[]) => ds.reduce((a, d) => a + d.amountUsd, 0);
const signed = (n: number, unit = '', pre = '') => (n > 0 ? '+' : n < 0 ? '−' : '±') + pre + Math.abs(n).toLocaleString('en-US') + unit;

/** Windows: this week = the last 7 local days; trend = last 3 days vs the 3 days before them. */
function kpis(deliveries: Delivery[], runs: Run[], now: number) {
  const today = dayStart(now);
  const inDays = (t: number, from: number, to: number) => t >= today - from * DAY && t < today - to * DAY + DAY;
  const week = deliveries.filter((d) => inDays(loggedAt(d), 6, 0));
  const recent = (t: number) => inDays(t, 2, 0), prior = (t: number) => inDays(t, 5, 3);
  const days = Array.from({ length: 7 }, (_, i) => 6 - i);
  const perDay = <T,>(xs: T[], at: (x: T) => number, f: (ys: T[]) => number) => days.map((k) => f(xs.filter((x) => inDays(at(x), k, k))));

  const evald = runs.filter((r) => r.evaluation && inDays(r.startedAt, 6, 0));
  const rate = (rs: Run[]) => (rs.length ? Math.round((rs.filter((r) => r.evaluation!.verdict === 'PASS').length / rs.length) * 100) : null);
  let carry = 0;
  const rateSeries = perDay(evald, (r) => r.startedAt, (rs) => (carry = rate(rs) ?? carry));
  const rRecent = rate(evald.filter((r) => recent(r.startedAt))), rPrior = rate(evald.filter((r) => prior(r.startedAt)));

  const held = deliveries.filter((d) => HELD[d.outcome]), released = deliveries.filter((d) => d.outcome === 'released');
  const trendOf = (ds: Delivery[], f: (x: Delivery[]) => number) => f(ds.filter((d) => recent(loggedAt(d)))) - f(ds.filter((d) => prior(loggedAt(d))));
  return {
    count: { value: week.length, trend: trendOf(deliveries, (x) => x.length), series: perDay(deliveries, loggedAt, (x) => x.length) },
    passRate: { value: rate(evald) ?? 0, trend: rRecent !== null && rPrior !== null ? rRecent - rPrior : 0, series: rateSeries, n: evald.length },
    held: { value: sum(held), trend: trendOf(held, sum), series: perDay(held, loggedAt, sum), n: held.length },
    released: { value: sum(released), trend: trendOf(released, sum), series: perDay(released, loggedAt, sum), n: released.length },
  };
}

const STAGE_RANK: Record<TItem['kind'], number> = { delivery: 0, run: 1, hold: 2, ask: 2, release: 3, calibration: 0, dose: 0, planned: 0, missed: 0 };

/** Today + yesterday as timetable blocks, from the named activity feed (lines that point at a delivery or run, plus calibration).
 *  One lot's steps within 45 min (logged → run → released / held) merge into a single block whose colour is the furthest step. */
function timetableItems(acts: Activity[], runs: Run[], deliveries: Delivery[], now: number): TItem[] {
  const t0 = dayStart(now) - DAY;
  const steps: TItem[] = [];
  for (const a of [...acts].sort((x, y) => x.at - y.at)) {
    if (a.at < t0) continue;
    const lane = a.at >= dayStart(now) ? 1 : 0;
    if (a.text.startsWith('calibrated')) { steps.push({ at: a.at, dur: 20, label: 'Calibration', sub: a.actor, kind: 'calibration', to: '/calibration', lane }); continue; }
    if (!a.ref) continue;
    const d = a.ref.kind === 'delivery' ? deliveries.find((x) => x.id === a.ref!.id) : deliveries.find((x) => x.runId === a.ref!.id);
    const ref = d ? { kind: 'delivery' as const, id: d.id } : a.ref;
    if (a.ref.kind === 'delivery' && a.kind === 'money' && a.text.startsWith('logged delivery')) {
      steps.push({ at: a.at, dur: 6, label: d?.lot ?? 'Delivery', sub: `logged ${d ? usd(d.amountUsd) : ''}`, kind: 'delivery', ref, lane });
    } else if (a.ref.kind === 'run' && a.text.startsWith('started run')) {
      const r = runs.find((x) => x.id === a.ref!.id);
      const fin = acts.find((x) => x.ref?.id === a.ref!.id && x.text.startsWith('finished run'));
      const end = fin?.at ?? (r ? r.startedAt + r.samples.length * 1000 : a.at);
      steps.push({ at: a.at, dur: Math.max(4, (end - a.at) / 60e3), label: r?.lot ?? a.ref.id, sub: r?.evaluation?.verdict ?? 'running', kind: 'run', ref, lane });
    } else if (a.text.startsWith('tapped RELEASE')) {
      steps.push({ at: a.at, dur: 6, label: d?.lot ?? 'Release', sub: 'released', kind: 'release', ref, lane });
    } else if (a.actor === PEOPLE.agent && a.kind === 'hold') {
      steps.push({ at: a.at, dur: 6, label: d?.lot ?? 'Hold', sub: `${d?.outcome === 'escalate' ? 'ask' : 'held'} ${d?.clause ?? ''}`, kind: d?.outcome === 'escalate' ? 'ask' : 'hold', ref, lane });
    }
  }
  const out: TItem[] = [];
  for (const s of steps) {
    const prev = out.findLast((o) => o.label === s.label && o.lane === s.lane && o.kind !== 'calibration');
    const prevEnd = prev ? prev.at + (prev.dur ?? 0) * 60e3 : 0;
    if (prev && s.kind !== 'calibration' && s.at - prevEnd < 45 * 60e3) {
      prev.dur = (Math.max(prevEnd, s.at + (s.dur ?? 0) * 60e3) - prev.at) / 60e3;
      prev.sub = `${prev.sub} → ${s.sub}`;
      if (STAGE_RANK[s.kind] > STAGE_RANK[prev.kind]) prev.kind = s.kind;
    } else out.push({ ...s });
  }
  return out;
}

function lotHeat(runs: Run[], deliveries: Delivery[], now: number) {
  const first = new Map<string, number>();
  const seen = (lot: string, t: number) => first.set(lot, Math.min(first.get(lot) ?? Infinity, t));
  deliveries.forEach((d) => seen(d.lot, loggedAt(d)));
  runs.forEach((r) => seen(r.lot, r.startedAt));
  const lots = [...first.entries()].sort((a, b) => a[1] - b[1]).map(([l]) => l);
  const days = Array.from({ length: 7 }, (_, i) => dayStart(now) - (6 - i) * DAY);
  const pick = (r: number, c: number) => runs.filter((x) => x.lot === lots[r] && x.startedAt >= days[c] && x.startedAt < days[c] + DAY).sort((a, b) => b.startedAt - a.startedAt)[0];
  return { lots, days, pick };
}

export default function Dashboard() {
  const deliveries = useStore((s) => s.deliveries);
  const runs = useStore((s) => s.runs);
  const acts = useStore((s) => s.activities);
  const station = useStore((s) => s.station);
  const now = useNow();
  const k = kpis(deliveries, runs, now);
  const agent = scorecard(deliveries);

  const items = timetableItems(acts, runs, deliveries, now);
  const hrs = [...items.map((i) => hourOf(i.at)), hourOf(now)];
  const start = Math.max(0, Math.min(6, Math.floor(Math.min(...hrs)))), end = Math.min(24, Math.max(20, Math.ceil(Math.max(...hrs) + 0.4)));

  const heat = lotHeat(runs, deliveries, now);
  const colLabels = heat.days.map((d) => { const x = new Date(d); return x.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2) + ' ' + x.getDate(); });

  const today = dayStart(now);
  const loggedToday = deliveries.filter((d) => loggedAt(d) >= today);
  const releaseLines = deliveries.flatMap((d) => d.log.filter((l) => l.kind === 'money' && l.text.startsWith('USDC') && l.at >= today).map((l) => ({ d, at: l.at })));
  const releasedToday = releaseLines.reduce((a, x) => a + x.d.amountUsd, 0);
  const inEscrow = sum(deliveries.filter((d) => d.outcome !== 'released'));

  const suppliers = [...new Set(deliveries.map((d) => d.supplier))].map((name) => {
    const ds = deliveries.filter((d) => d.supplier === name);
    const pass = ds.filter((d) => !HELD[d.outcome] && runs.find((r) => r.id === d.runId)?.evaluation?.verdict === 'PASS');
    return { name, total: sum(ds), pass: sum(pass), held: sum(ds.filter((d) => HELD[d.outcome])), n: ds.length };
  }).sort((a, b) => b.total - a.total);
  const maxTotal = Math.max(1, ...suppliers.map((s) => s.total));
  const ref = station.reference ? REFERENCES[station.reference] : null;

  const lastRun = [...runs].filter((r) => r.samples.length > 2).sort((a, b) => b.startedAt - a.startedAt)[0];
  const lotsWeek = new Set(deliveries.filter((d) => loggedAt(d) >= today - 6 * DAY).map((d) => d.lot)).size;

  return (
    <Screen title="Dashboard" tone="sky" eyebrow={new Date(now).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
      art={<BinaryPill dark={false} width={150} height={78} scale={2.5} cell={5} className="head-pill" label="Pill, printed in ones and zeros" />}
      right={<>
        <span className={'chip ' + (station.online ? 'ok' : 'bad')}><span className="dot" />{station.id}</span>
        <SettingsLink />
      </>}>
      <section className="dash-hero" aria-label="This week at a glance">
        <div className="dash-hero-head">
          <h2 className="serif">This week, at a glance</h2>
          <span className="mono muted" style={{ fontSize: 12 }}>{lotsWeek} lots · {k.passRate.n} runs · last 7 days · demo data</span>
        </div>
        <div className="wide-4 dash-kpis">
          <Kpi label="Deliveries this week" value={k.count.value} trend={k.count.trend} delta={`${signed(k.count.trend)} vs prior 3d`} series={k.count.series} accent="var(--c1)" />
          <Kpi label="PASS rate" value={k.passRate.value} unit="%" trend={k.passRate.trend} delta={`${signed(k.passRate.trend, ' pts')} · ${k.passRate.n} runs`} series={k.passRate.series} accent="var(--c2)" />
          <Kpi label="Held" value={k.held.value} prefix="$" trend={k.held.trend} goodWhen="down" warnOnBad delta={`${signed(k.held.trend, '', '$')} · ${k.held.n} lots`} series={k.held.series} accent="var(--warm)" tag="SANDBOX" />
          <Kpi label="Released" value={k.released.value} prefix="$" trend={k.released.trend} delta={`${signed(k.released.trend, '', '$')} vs prior 3d`} series={k.released.series} accent="var(--cb)" tag="TESTNET" />
        </div>
      </section>

      <div className="wide-2">
        <section className="card panel hover-line" aria-label="Station pulse">
          <div className="panel-head">
            <h2 className="row" style={{ gap: 10 }}><Glyph name="station" size={30} />Station pulse</h2>
            <span className={'chip ' + (station.online ? 'live' : 'bad')}><span className="dot" />{station.online ? 'online' : 'offline'}</span>
          </div>
          <StationPulse run={lastRun} band={ref} online={station.online} />
          <span className="mono muted" style={{ fontSize: 11.5 }}>
            {ref ? `${ref.drug} band ${ref.bandLow}–${ref.bandHigh} · ${ref.runs} runs · CV ${ref.cv} %` : 'no reference band'}{station.calibratedAt ? ` · calibrated ${hm(station.calibratedAt)}` : ''}
          </span>
        </section>
        <section className="card panel hover-line " aria-label="Timetable">
          <div className="panel-head"><h2>Timetable</h2><span className="eyebrow">yesterday · today</span></div>
          {items.length ? <Timetable items={items} start={start} end={end} nowLine lanes={['Yesterday', 'Today']} hourPx={40} label="Deliveries, runs and releases by time" now={now} />
            : <EmptyState art="clock" action={<Link to="/bottle" className="btn" style={{ textDecoration: 'none' }}>Scan a bottle</Link>}>Nothing logged yesterday or today. The first scan starts the day.</EmptyState>}
          <div className="legend">
            <span><i style={{ background: 'var(--cb-tint)', boxShadow: 'inset 3px 0 var(--cb)' }} />logged</span>
            <span><i style={{ background: 'var(--sky-tint)', boxShadow: 'inset 3px 0 var(--sky)' }} />run</span>
            <span><i style={{ background: 'rgba(0,82,255,.2)', boxShadow: 'inset 3px 0 var(--cb)' }} />released</span>
            <span><i style={{ background: 'var(--warm-tint)', boxShadow: 'inset 3px 0 var(--warm)' }} />held</span>
            <span><i style={{ background: 'var(--amber-tint)', boxShadow: 'inset 3px 0 var(--amber)' }} />ask a person</span>
            <span><i style={{ background: 'rgba(180,140,255,.16)', boxShadow: 'inset 3px 0 var(--c4)' }} />calibration</span>
          </div>
        </section>
      </div>

      <div className="wide-2">
        <section className="card panel hover-line" aria-label="Verdicts by lot and day">
          <div className="panel-head"><h2>Verdicts by lot and day</h2><span className="eyebrow">{heat.lots.length} lots · 7 days</span></div>
          {heat.lots.length === 0 ? <EmptyState art="grid" action={<Link to="/run/new?replay=B2-07" className="btn ghost" style={{ textDecoration: 'none' }}>Run a replay</Link>}>No lots tested this week. Each run lands here as one square.</EmptyState> : <Heatmap label="Verdicts by lot and day" rows={heat.lots.length} cols={7} rowLabels={heat.lots} colLabels={colLabels}
            value={(r, c) => { const x = heat.pick(r, c); return x ? (x.evaluation ? HEAT[x.evaluation.verdict] : 0) : null; }}
            cellText={(r, c) => { const x = heat.pick(r, c); return `${heat.lots[r]} · ${new Date(heat.days[c]).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })} · ${x ? `${x.evaluation?.verdict ?? 'running'} · ${x.id}${x.evaluation?.pct ? ` · ${x.evaluation.pct} % of ref` : ''}` : 'not tested'}`; }}
            legend={[{ v: 4, label: 'PASS' }, { v: 2, label: 'NEEDS LAB' }, { v: 1, label: 'UNABLE TO VERIFY' }, { v: 0, label: 'running' }, { v: null, label: 'not tested' }]} />}
          <p className="footnote">Screening result, not a pharmacopeial test.</p>
        </section>
        <section className="card panel hover-line" aria-label="Money path today">
          <div className="panel-head"><h2 className="row" style={{ gap: 10 }}><Glyph name="wallet" size={28} />Money path</h2><span className="eyebrow">today · SANDBOX</span></div>
          <FlowArrows label="Money path today" token
            nodes={[
              { id: 'clinic', label: 'Clinic', value: usd(sum(loggedToday)), sub: `${loggedToday.length} logged today`, accent: 'var(--c1)' },
              { id: 'escrow', label: 'Escrow', value: usd(inEscrow), sub: 'held until a tap', accent: 'var(--amber)' },
              { id: 'supplier', label: 'Suppliers', value: usd(releasedToday), sub: `${releaseLines.length} released today`, accent: 'var(--cb)' },
            ]}
            edges={[
              { from: 'clinic', to: 'escrow', label: `${usd(sum(loggedToday))} in`, live: loggedToday.some((d) => now - loggedAt(d) < H), color: 'var(--cb)' },
              { from: 'escrow', to: 'supplier', label: `${usd(releasedToday)} out`, live: releaseLines.some((x) => now - x.at < H), color: 'var(--cb)' },
            ]} />
          <p className="footnote">USDC on Base Sepolia (TESTNET), mirrored in the Nessie SANDBOX. A release needs a pharmacist's tap.</p>
        </section>
      </div>

      <div className="wide-2">
        <section className="card panel hover-line" aria-label="Who did what today">
          <div className="panel-head"><h2>Who did what today</h2><Link to="/activity" className="eyebrow" style={{ textDecoration: 'none', color: 'var(--sky-ink)' }}>All <span className="pointer">→</span></Link></div>
          {acts.length === 0 ? <EmptyState art="feed">Nobody has done anything yet. Every scan, run and tap is named here.</EmptyState> : <ul className="feed feed-slide">
            {acts.slice(0, 8).map((a, i) => {
              const to = refTo(a.ref);
              const body = <><ActorAvatar actor={a.actor} /><span className="feed-text"><b>{a.actor}</b> {a.text}</span><span className="feed-time">{a.at >= today ? hm(a.at) : new Date(a.at).toLocaleDateString('en-US', { weekday: 'short' }) + ' ' + hm(a.at)}</span></>;
              return <li key={a.id} style={{ '--i': i } as React.CSSProperties}>{to ? <Link to={to} className={'feed-line k-' + a.kind}>{body}</Link> : <div className={'feed-line k-' + a.kind}>{body}</div>}</li>;
            })}
          </ul>}
        </section>

        <section className="card panel hover-line" aria-label="Suppliers">
          <div className="panel-head"><h2 className="row" style={{ gap: 10 }}><Glyph name="supplier" size={28} />Suppliers</h2><span className="eyebrow">delivered · SANDBOX</span></div>
          {suppliers.length === 0 ? <EmptyState art="box" action={<Link to="/deliveries" className="btn ghost" style={{ textDecoration: 'none' }}>Open deliveries</Link>}>No deliveries logged yet. Each one waits in escrow until its lot is tested.</EmptyState> : <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 14 }}>
            {suppliers.map((s, i) => (
              <li key={s.name} className="stack" style={{ gap: 6 }}>
                <div className="row between" style={{ gap: 8 }}>
                  <span className="row" style={{ gap: 8, minWidth: 0 }}>
                    <ActorAvatar actor={s.name} />
                    <span style={{ fontSize: 13.5, fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                  </span>
                  <span className="mono" style={{ fontSize: 12.5 }}>{usd(s.total)}</span>
                </div>
                <div className="bar sup-bar" style={{ width: `${(s.total / maxTotal) * 100}%`, background: 'var(--sky-tint)', '--i': i } as React.CSSProperties} title={`${s.name}: ${usd(s.total)} delivered, ${usd(s.pass)} PASS, ${usd(s.held)} held`}>
                  <span style={{ width: `${(s.pass / s.total) * 100}%`, background: 'var(--mint)', animationDelay: `${300 + i * 110}ms` }} />
                  <span style={{ width: `${(s.held / s.total) * 100}%`, background: 'var(--warm)', animationDelay: `${420 + i * 110}ms` }} />
                </div>
                <span className="mono muted" style={{ fontSize: 11 }}>{s.n} lots · PASS {usd(s.pass)} · held {usd(s.held)}</span>
              </li>
            ))}
          </ul>}
          <div className="legend">
            <span><i style={{ background: 'var(--mint)' }} />PASS, not held</span>
            <span><i style={{ background: 'var(--warm)' }} />held</span>
            <span><i style={{ background: 'var(--sky-tint)' }} />pending / other</span>
          </div>
        </section>
      </div>

      <Link to="/agent" className="card panel hover-line dash-agent" aria-label="Policy agent record" data-agent-card>
        <span className="dash-agent-art" aria-hidden="true"><Glyph name="escrow" size={52} /></span>
        <span className="stack" style={{ gap: 4, flex: '1 1 220px', minWidth: 0 }}>
          <span className="eyebrow">Software proposes · a person releases</span>
          <span className="row" style={{ gap: 8, fontWeight: 600, fontSize: 18 }}><ActorAvatar actor={PEOPLE.agent} />Policy agent record <span className="pointer" aria-hidden="true">→</span></span>
          <span className="mono muted" style={{ fontSize: 12 }}>{agent.proposed} proposed · {agent.releasedByPerson} released by a person · {agent.held} held · {agent.escalated} escalated · {agent.asked} asked a person</span>
        </span>
        <span className="chip"><span className="dot" style={{ background: 'var(--ink)' }} />{usd(agent.movedByAgentAlone)} moved by the agent alone</span>
      </Link>

      <section className="card decor-dots dash-station" aria-label="Station">
        <Glyph name="cup" size={40} />
        <span className="stack" style={{ gap: 2, flex: '1 1 220px', minWidth: 0 }}>
          <span style={{ fontWeight: 600 }}>{station.id} · {station.online ? 'online' : 'offline'}</span>
          <span className="mono" style={{ fontSize: 12, color: 'var(--ink-2)' }}>{ref ? `${ref.drug} band ${ref.bandLow}–${ref.bandHigh}` : 'no reference band'}{station.calibratedAt ? ` · calibrated ${hm(station.calibratedAt)}` : ''}</span>
        </span>
        <div className="row" style={{ gap: 10, flex: '1 1 300px', justifyContent: 'flex-end' }}>
          <Link to="/calibration" className="btn ghost" style={{ textDecoration: 'none', width: 'auto', flex: 1, maxWidth: 200 }}>Calibration</Link>
          <Link to="/bottle" className="btn" style={{ textDecoration: 'none', width: 'auto', flex: 1, maxWidth: 220 }}>Scan a bottle</Link>
        </div>
      </section>
    </Screen>
  );
}
