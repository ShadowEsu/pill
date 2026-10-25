// The station hub (medical mode): is it there (online · simulated · offline, from the pay service's /station/status), what
// it is doing now (the PhaseRail, live from the run's own stream while a run is on; else idle), its water temperature,
// last blank and calibration, a way to start a run, the last five runs as capsules, and how a run works: the six phases
// with their times, the story the Run screen then plays.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import BinaryPill from '../components/BinaryPill';
import PhaseRail, { curveMarks, STATION } from '../components/PhaseRail';
import PillFill from '../components/PillFill';
import { PHASES, clock, type PhaseKey } from '../components/RunPhases';
import { Screen } from '../components/Shell';
import { stationStatus, stationStreamUrl, type StationStatus } from '../lib/station';
import { liveStream } from '../lib/stream';
import { useStore } from '../lib/store';
import type { Sample } from '../lib/types';
import '../phases.css';

const STORY: Record<PhaseKey, string> = {
  dark: 'All three LEDs (white, blue, red) go off inside the purple chamber. It has to read dark: a light leak over 100 counts means the lid is open.',
  blank: 'Clean water, lid closed, nothing moving, 10 seconds. Readings that hold within 2 % become the 100 % everything is measured against.',
  drop: 'The whole tablet goes in through the hole in the lid; stir 5 circles with the stick. The station waits for the inline light to fall 6 %, and asks again after 30 s.',
  dissolve: 'The tablet dissolves: Quick about 60–90 s, Full 2–10 min. Straight through, blue light dims; at 90°, riboflavin glows. Chalk only dims.',
  settle: 'The curve flattens. Twenty seconds with |dA/dt| under 0.001 per second is a plateau.',
  verdict: 'Seven fixed rules read the curve: PASS, NEEDS LAB or UNABLE TO VERIFY, with the rule that fired.',
};
const hm = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export default function Station() {
  const [status, setStatus] = useState<StationStatus | null | undefined>(undefined);
  const runs = useStore((s) => s.runs);
  const calibratedAt = useStore((s) => s.station.calibratedAt);
  const reference = useStore((s) => s.station.reference);

  useEffect(() => {
    let alive = true;
    const poll = () => void stationStatus().then((s) => { if (alive) setStatus(s); });
    poll();
    const timer = window.setInterval(poll, 2000);
    return () => { alive = false; clearInterval(timer); };
  }, []);

  // a run on the station: follow its own stream so the rail reads the curve the way the Run screen does
  const liveRun = status?.run && !status.run.ended ? status.run.id : null;
  const liveSrc = status?.src ?? null;
  const [samples, setSamples] = useState<Sample[]>([]);
  useEffect(() => {
    setSamples([]);
    if (!liveRun || !liveSrc) return;
    const stream = liveStream(stationStreamUrl(liveRun), liveSrc, liveRun);
    let all: Sample[] = [];
    const off = stream.subscribe((_s, a) => { all = a; });
    const flush = window.setInterval(() => setSamples(all.slice()), 500);
    return () => { off(); clearInterval(flush); stream.stop(); };
  }, [liveRun, liveSrc]);
  const marks = useMemo(() => curveMarks(samples), [samples]);

  const run = status?.run && !status.run.ended ? status.run : null;
  const at: PhaseKey | null = !run ? null
    : run.state === 'dark' || run.state === 'idle' ? 'dark'
    : run.state === 'blank' ? 'blank'
    : marks.drop == null ? 'drop'
    : marks.settle == null ? 'dissolve'
    : 'settle';
  const t = samples.at(-1)?.t ?? run?.t ?? 0;
  const progress = at === 'drop' ? Math.min(1, (1 - marks.inline) / STATION.drop) : at === 'dissolve' ? Math.min(1, t / 110) : at === 'settle' ? marks.window : 0.5;

  const word = status === undefined ? 'checking' : !status ? 'offline' : status.mode === 'sim' ? 'simulated' : 'online';
  const last = status?.last ?? null;
  const lastRuns = useMemo(() => [...runs].sort((a, b) => b.startedAt - a.startedAt).slice(0, 5), [runs]);
  const storeBlank = runs.find((r) => r.samples.length)?.samples[0]?.blank ?? null;
  const blank = last?.blank ? last.blank[0] - last.dark[0] : storeBlank;

  return (
    <Screen title="Station" eyebrow="STATION 01 · medical" back="/" tone="sky">
      <section className="st-hero" aria-label="Station status">
        <BinaryPill width={260} height={160} cell={5} scale={1.9} className="st-bpill" label="The station, printed in ones and zeros" />
        <span className="eyebrow">status</span>
        <p className="st-status" data-station-status={word}><span className={'st-pulse' + (word === 'online' ? ' on' : word === 'simulated' ? ' sim' : '')} aria-hidden="true" />{word}</p>
        <p className="st-sub">
          {word === 'offline' ? 'No station on the pay service. Runs play as replays until one is plugged in.'
            : word === 'checking' ? 'Asking the pay service for the station.'
            : `${status?.mode === 'sim' ? 'The pay service\u2019s simulator plays the firmware' : `USB serial ${status?.port ?? ''}`}${status?.hello ? ` · firmware ${status.hello.fw}` : ''}. ${run ? 'A run is on.' : 'Idle, ready for a run.'}`}
        </p>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <span className="chip" data-temp><span className="dot" style={{ background: 'var(--sky)' }} />water {last ? `${last.temp_c.toFixed(1)} °C` : '—'}</span>
          <span className="chip" data-blank><span className="dot" style={{ background: 'var(--c6)' }} />last blank {blank != null ? `${blank} counts` : '—'}</span>
          <span className="chip"><span className="dot" style={{ background: 'var(--mint)' }} />{calibratedAt ? `calibrated ${hm(calibratedAt)}${reference ? ` · ${reference}` : ''}` : 'not calibrated'}</span>
        </div>
      </section>

      <div className="wide-2">
      <section className="card stack" style={{ gap: 10 }} aria-label="What the station is doing">
        <div className="row between"><span className="eyebrow">doing now</span><span className="mono muted" style={{ fontSize: 12 }}>{run ? `run ${run.id}` : 'idle'}</span></div>
        {at ? (
          <PhaseRail at={at} progress={progress} layout="row" prepare={false} sound={false}
            clock={at === 'dark' || at === 'blank' ? run?.state ?? '' : `${clock(t)}`} note={run?.message ?? null} />
        ) : (
          <p style={{ color: 'var(--ink-2)' }}>{word === 'offline' ? 'Nothing: no station is connected.' : 'Idle. The lights are on and the chamber is waiting for clean water.'}</p>
        )}
        <Link to="/bottle" className="btn" style={{ textDecoration: 'none' }} data-action="start-run">Start a run</Link>
      </section>

      <section className="card stack" style={{ gap: 10 }} aria-label="Last five runs">
        <div className="row between"><span className="eyebrow">last 5 runs</span><Link to="/runs" className="eyebrow" style={{ textDecoration: 'none', color: 'var(--sky-ink)' }}>All runs →</Link></div>
        {lastRuns.length ? (
          <ul className="st-runs">
            {lastRuns.map((r) => (
              <li key={r.id} style={{ minWidth: 0 }}>
                <Link to={r.evaluation ? `/evaluation/${r.id}` : `/run/${r.id}`} aria-label={`Run ${r.id}, lot ${r.lot}, ${r.evaluation?.verdict ?? 'not finished'}`}>
                  <PillFill pct={r.evaluation?.pct ?? 0} verdict={r.evaluation?.verdict ?? null} size={70} label={false} ring={false} grid={false} running={false} />
                  <span className="mono">{r.lot}</span>
                  <span className="mono" style={{ fontWeight: 600, color: 'var(--ink)', whiteSpace: 'normal', textAlign: 'center', lineHeight: 1.15 }}>{r.evaluation ? r.evaluation.verdict : '…'}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="muted">No runs yet.</p>}
      </section>
      </div>

      <section className="stack" style={{ gap: 10 }} aria-label="How a run works">
        <div className="row between"><span className="eyebrow">how a run works</span><span className="mono muted" style={{ fontSize: 12 }}>Quick about 60–90 s · Full 2–10 min</span></div>
        <ol className="st-how">
          {PHASES.map((p, i) => (
            <li key={p.key} className={p.key === 'dark' ? 'dark' : undefined} style={{ '--c': p.key === 'dark' ? 'rgba(255,255,255,.2)' : p.color } as React.CSSProperties}>
              <span className="n">{i + 1} of 6</span>
              <span className="t">{p.name}</span>
              <span className="dur">{p.dur}</span>
              <span className="d">{STORY[p.key]}</span>
            </li>
          ))}
        </ol>
      </section>
    </Screen>
  );
}
