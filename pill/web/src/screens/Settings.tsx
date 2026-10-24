// Settings (/settings): who I am, big text, sound, the Google Calendar bridge status (live from pill-pay), the station,
// reset the demo data, the build, and credits & sources.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Screen } from '../components/Shell';
import { actions, useStore } from '../lib/store';
import { useSound } from '../lib/sound';
import { dayLabel, hm } from '../lib/when';
import { REFERENCES } from '../data/reference';
import '../story.css';

const PAY_URL = import.meta.env.VITE_PAY_URL as string | undefined;
const SHA: string = import.meta.env.VITE_SHA || 'dev';

const CREDITS = [
  { t: 'WHO fact sheet: substandard and falsified medical products', d: 'World Health Organization', href: 'https://www.who.int/news-room/fact-sheets/detail/substandard-and-falsified-medical-products' },
  { t: 'openFDA drug enforcement (recalls)', d: 'U.S. Food and Drug Administration', href: 'https://open.fda.gov/apis/drug/enforcement/' },
  { t: 'Nessie sandbox API', d: 'Capital One · SANDBOX', href: 'http://api.nessieisreal.com/' },
  { t: 'x402 payments on the Coinbase Developer Platform', d: 'Coinbase CDP · TESTNET', href: 'https://docs.cdp.coinbase.com/x402/welcome' },
  { t: 'Built at Cal Hacks 13.0', d: 'October 2026', href: 'https://www.calhacks.io/' },
];

type Cal = { state: 'checking' } | { state: 'connected'; account: string; calendars: number | null } | { state: 'off'; why: string };

function Switch({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" onClick={onToggle} />;
}

export default function Settings() {
  const mode = useStore((s) => s.mode);
  const bigText = useStore((s) => s.bigText);
  const station = useStore((s) => s.station);
  const sound = useSound();
  const [cal, setCal] = useState<Cal>(PAY_URL ? { state: 'checking' } : { state: 'off', why: 'no pay service configured (VITE_PAY_URL)' });
  const [confirm, setConfirm] = useState(false);
  const [resetAt, setResetAt] = useState<number | null>(null);

  useEffect(() => {
    if (!PAY_URL) return;
    // A flag, not an AbortController: the status call is cheap, and an aborted fetch shows up as a failed request.
    let alive = true;
    fetch(`${PAY_URL}/calendar/status`)
      .then((r) => r.json() as Promise<unknown>)
      .then((d) => {
        if (!alive) return;
        if (!d || typeof d !== 'object' || !('mode' in d)) { setCal({ state: 'off', why: 'unexpected reply from the pay service' }); return; }
        const account = 'account' in d && typeof d.account === 'string' ? d.account : 'unknown';
        if (d.mode === 'composio') setCal({ state: 'connected', account, calendars: 'calendars' in d && typeof d.calendars === 'number' ? d.calendars : null });
        else setCal({ state: 'off', why: 'error' in d && typeof d.error === 'string' ? d.error.split('\n')[0].slice(0, 120) : `no Google account linked as ${account}` });
      })
      .catch((e: unknown) => { if (alive) setCal({ state: 'off', why: `pay service unreachable (${e instanceof Error ? e.message : 'network error'})` }); });
    return () => { alive = false; };
  }, []);

  const ref = station.reference ? REFERENCES[station.reference] : null;
  const reset = () => {
    const keep = mode;
    actions.reset();
    if (keep) actions.setMode(keep);
    setConfirm(false);
    setResetAt(Date.now());
  };

  return (
    <Screen title="Settings" back eyebrow="Pill">
      <div className="wide-2">
        <div className="stack" style={{ gap: 16 }}>
          <section className="card set-group" aria-label="You">
            <div className="set-row">
              <span><span className="lbl">Who I am</span>
                <span className="sub">{mode === 'medical' ? 'Medical · a hospital, clinic or medical center' : mode === 'personal' ? 'Personal · for myself or my family' : 'Not chosen yet'}</span></span>
              <Link to="/welcome" className="btn ghost" style={{ textDecoration: 'none' }}>Change</Link>
            </div>
            <div className="set-row">
              <span><span className="lbl">Big text</span><span className="sub">Larger words and buttons everywhere.</span></span>
              <Switch on={bigText} label="Big text" onToggle={() => { actions.setBigText(!bigText); sound.play('tap'); }} />
            </div>
            <div className="set-row">
              <span><span className="lbl">Sound</span><span className="sub">A chime for PASS, a low note for NEEDS LAB, a soft hush for UNABLE TO VERIFY.</span></span>
              <span className="row" style={{ gap: 12 }}>
                <button type="button" className="btn ghost" disabled={!sound.on} onClick={() => sound.play('chime')}>Test</button>
                <Switch on={sound.on} label="Sound" onToggle={() => { sound.setOn(!sound.on); if (!sound.on) window.setTimeout(() => sound.play('tick'), 30); }} />
              </span>
            </div>
            <div className="set-row">
              <span><span className="lbl">How Pill works</span><span className="sub">Seven short chapters.</span></span>
              <Link to="/story" className="btn ghost" style={{ textDecoration: 'none' }}>Open</Link>
            </div>
          </section>

          <section className="card set-group" aria-label="Connections">
            <div className="set-row" aria-live="polite">
              <span><span className="lbl">Google Calendar</span>
                <span className="sub mono">{cal.state === 'checking' ? 'checking…' : cal.state === 'connected' ? `connected as ${cal.account}${cal.calendars != null ? ` · ${cal.calendars} calendars` : ''}` : `not connected · ${cal.why}`}</span></span>
              <span className={'chip ' + (cal.state === 'connected' ? 'ok' : cal.state === 'checking' ? 'live' : '')}><span className="dot" />{cal.state === 'connected' ? 'connected' : cal.state === 'checking' ? 'checking' : 'off'}</span>
            </div>
            <div className="set-row">
              <span><span className="lbl">Station</span>
                <span className="sub mono">{station.id} · {station.online ? 'online' : 'offline'}{station.calibratedAt ? ` · calibrated ${dayLabel(station.calibratedAt).toLowerCase()} ${hm(station.calibratedAt)}` : ' · not calibrated'}</span>
                <span className="sub mono">{ref ? `${ref.drug} band ${ref.bandLow}–${ref.bandHigh} · ${ref.runs} runs · CV ${ref.cv} %` : 'no reference band'}</span></span>
              <span className={'chip ' + (station.online ? 'ok' : 'bad')}><span className="dot" />{station.online ? 'online' : 'offline'}</span>
            </div>
          </section>

          <section className="card set-group" aria-label="Demo data">
            <div className="set-row">
              <span><span className="lbl">Reset demo data</span>
                <span className="sub">{resetAt ? `Reset at ${hm(resetAt)}. The seeded week is back.` : 'Puts the seeded week of runs, bottles and deliveries back. Your mode stays.'}</span></span>
              {!confirm && <button type="button" className="btn ghost" onClick={() => setConfirm(true)}>Reset</button>}
            </div>
            {confirm && (
              <div className="set-row" role="alertdialog" aria-label="Confirm reset">
                <span className="sub" style={{ color: 'var(--ink)' }}>Every run, bottle and delivery you added is removed. This cannot be undone.</span>
                <span className="row" style={{ gap: 8 }}>
                  <button type="button" className="btn ghost" onClick={() => setConfirm(false)} autoFocus>Cancel</button>
                  <button type="button" className="btn" onClick={reset}>Reset</button>
                </span>
              </div>
            )}
          </section>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <section className="card" aria-label="Credits and sources" style={{ display: 'grid', gap: 4, padding: '16px 20px' }}>
            <h2 style={{ fontSize: 17 }}>Credits &amp; sources</h2>
            <ul className="credits">
              {CREDITS.map((c) => (
                <li key={c.href}><a href={c.href} target="_blank" rel="noopener noreferrer"><span><span className="t">{c.t}</span><span className="d">{c.d}</span></span><span className="pointer" aria-hidden="true">↗</span></a></li>
              ))}
            </ul>
          </section>
          <p className="footnote mono" style={{ textAlign: 'center' }}>Pill app · build {SHA} · screening result, not a pharmacopeial test</p>
        </div>
      </div>
    </Screen>
  );
}
