// Settings (/settings): who I am, Easy mode, big text, sound, the follower assistant and its voice replies, the Google Calendar bridge status (live from pill-pay), the station,
// reset the demo data, the build, and credits & sources (the website first, so the site and the app read as one product).
// Groups carry a hand-drawn glyph each; switches spring their thumb.
import { useState } from 'react';
import { useCalendarStatus } from '../components/CalendarButton';
import { setEasyMode } from '../components/EasyToggle';
import { Link } from 'react-router-dom';
import { Screen } from '../components/Shell';
import Glyph, { type GlyphName } from '../components/Glyph';
import BinaryPill from '../components/BinaryPill';
import StationChip, { useStationStatus } from '../components/StationChip';
import { actions, useStore } from '../lib/store';
import { useSound } from '../lib/sound';
import { followerSettings, useFollowerSettings } from '../lib/follower';
import { dayLabel, hm } from '../lib/when';
import { REFERENCES } from '../data/reference';
import '../story.css';

const SHA: string = import.meta.env.VITE_SHA || 'dev';

const SITE = 'https://pill-site.vercel.app';
const CREDITS = [
  { t: 'Pill · the website', d: 'pill-site.vercel.app · how the station works, the story, the demo', href: SITE },
  { t: 'WHO fact sheet: substandard and falsified medical products', d: 'World Health Organization', href: 'https://www.who.int/news-room/fact-sheets/detail/substandard-and-falsified-medical-products' },
  { t: 'openFDA drug enforcement (recalls)', d: 'U.S. Food and Drug Administration', href: 'https://open.fda.gov/apis/drug/enforcement/' },
  { t: 'Nessie sandbox API', d: 'Capital One · SANDBOX', href: 'http://api.nessieisreal.com/' },
  { t: 'x402 payments on the Coinbase Developer Platform', d: 'Coinbase CDP · TESTNET', href: 'https://docs.cdp.coinbase.com/x402/welcome' },
  { t: 'Built at Cal Hacks 13.0', d: 'October 2026', href: 'https://www.calhacks.io/' },
];

function Switch({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" onClick={onToggle} />;
}

function GroupHead({ glyph, title, i }: { glyph: GlyphName; title: string; i: number }) {
  return <h2 className="set-head"><span className="set-glyph" aria-hidden="true"><Glyph name={glyph} size={30} delay={i * 150} /></span>{title}</h2>;
}

export default function Settings() {
  const mode = useStore((s) => s.mode);
  const bigText = useStore((s) => s.bigText);
  const easy = useStore((s) => s.easy);
  const station = useStore((s) => s.station);
  const live = useStationStatus();   // the pay service's /station/status: serial · simulated · no station
  const sound = useSound();
  const follower = useFollowerSettings();
  const cal = useCalendarStatus();
  const [confirm, setConfirm] = useState(false);
  const [resetAt, setResetAt] = useState<number | null>(null);

  const ref = station.reference ? REFERENCES[station.reference] : null;
  const reset = () => {
    const keep = mode;
    actions.reset();
    if (keep) actions.setMode(keep);
    setConfirm(false);
    setResetAt(Date.now());
  };

  return (
    <Screen title="Settings" back eyebrow="Pill" tone="violet" art={<Glyph name="led" size={54} />}>
      <div className="wide-2">
        <div className="stack cascade" style={{ gap: 16 }}>
          <section className="card set-group" aria-label="You" style={{ '--i': 0 } as React.CSSProperties}>
            <GroupHead glyph={mode === 'personal' ? 'tablet' : 'clinic'} title="You" i={0} />
            <div className="set-row">
              <span><span className="lbl">Who I am</span>
                <span className="sub">{mode === 'medical' ? 'Medical · a hospital, clinic or medical center' : mode === 'personal' ? 'Personal · for myself or my family' : 'Not chosen yet'}</span></span>
              <Link to="/welcome" className="btn ghost" style={{ textDecoration: 'none' }}>Change</Link>
            </div>
            <div className="set-row" data-easy-row>
              <span><span className="lbl">Easy mode</span><span className="sub">Words 25 % larger, stronger contrast, bigger buttons, and reading aloud on: sound on, the assistant reads its answers, big rows get a Read aloud button.</span></span>
              <Switch on={easy} label="Easy mode" onToggle={() => setEasyMode(!easy)} />
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
              <span><span className="lbl">Follower assistant</span><span className="sub">The round Pill button, bottom right. Gemini explains the screen you are on; a pharmacist or doctor decides.</span></span>
              <Switch on={follower.on} label="Follower assistant" onToggle={() => { followerSettings.setOn(!follower.on); sound.play('tap'); }} />
            </div>
            <div className="set-row">
              <span><span className="lbl">Voice replies</span><span className="sub">The assistant reads each answer aloud with the browser voice.</span></span>
              <Switch on={follower.voice} label="Voice replies" onToggle={() => { followerSettings.setVoice(!follower.voice); sound.play('tap'); }} />
            </div>
            <div className="set-row">
              <span><span className="lbl">How Pill works</span><span className="sub">Seven short chapters.</span></span>
              <Link to="/story" className="btn ghost" style={{ textDecoration: 'none' }}>Open</Link>
            </div>
          </section>

          <section className="card set-group" aria-label="Connections" style={{ '--i': 1 } as React.CSSProperties}>
            <GroupHead glyph="calendar" title="Connections" i={1} />
            <div className="set-row" aria-live="polite">
              <span><span className="lbl">Google Calendar</span>
                <span className="sub mono">{cal.state === 'checking' ? 'checking…' : cal.state === 'connected' ? `connected as ${cal.account}${cal.calendars != null ? ` · ${cal.calendars} calendars` : ''}` : `not connected · ${cal.why}`}</span></span>
              <span className={'chip ' + (cal.state === 'connected' ? 'ok' : cal.state === 'checking' ? 'live' : '')}><span className="dot" />{cal.state === 'connected' ? 'connected' : cal.state === 'checking' ? 'checking' : 'off'}</span>
            </div>
            <div className="set-row" aria-live="polite" data-station-row>
              <span><span className="lbl">Station</span>
                <span className="sub mono">{live === undefined ? 'asking the pay service…' : live ? `${live.mode === 'sim' ? 'simulator (SERIAL_PORT=sim)' : `USB serial ${live.port ?? ''}`.trim()} · run ${live.state}${live.hello ? ` · firmware ${live.hello.fw}` : ''}` : 'no station on the pay service; runs play the recorded replays'}</span>
                <span className="sub mono">{station.calibratedAt ? `calibrated ${dayLabel(station.calibratedAt).toLowerCase()} ${hm(station.calibratedAt)}` : 'not calibrated'} · {ref ? `${ref.drug} band ${ref.bandLow}–${ref.bandHigh} · ${ref.runs} runs · CV ${ref.cv} %` : 'no reference band'}</span></span>
              <StationChip status={live} />
            </div>
          </section>

          <section className="card set-group" aria-label="Demo data" style={{ '--i': 2 } as React.CSSProperties}>
            <GroupHead glyph="station" title="Demo data" i={2} />
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

        <div className="stack cascade" style={{ gap: 16, '--cascade-start': '200ms' } as React.CSSProperties}>
          <a href={SITE} target="_blank" rel="noopener noreferrer" className="card set-site" style={{ '--i': 0 } as React.CSSProperties}>
            <BinaryPill dark width={200} height={120} scale={2.2} className="set-site-pill" label="Pill, printed in ones and zeros" />
            <span className="set-site-copy">
              <span className="eyebrow" style={{ color: 'rgba(255,255,255,.6)' }}>About Pill</span>
              <span className="serif" style={{ fontSize: 28, lineHeight: 1.05 }}>The box measures. Pill explains.</span>
              <span className="mono" style={{ fontSize: 12, color: 'rgba(255,255,255,.7)' }}>pill-site.vercel.app ↗</span>
            </span>
          </a>
          <section className="card set-group" aria-label="Credits and sources" style={{ '--i': 1 } as React.CSSProperties}>
            <GroupHead glyph="lab" title="Credits & sources" i={3} />
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
