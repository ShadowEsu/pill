// "Add to Google Calendar" through the pill-pay bridge (POST /calendar/event → Composio → the connected Google account).
// Honest states: no service configured → the button says so; failure → the error text; success → the event link.
// Also the bridge's status (GET /calendar/status) as a hook and a chip: connected / not connected (Settings, Schedule).
import { useEffect, useState } from 'react';
import { actions } from '../lib/store';

const PAY_URL = import.meta.env.VITE_PAY_URL as string | undefined;

export type CalendarStatus = { state: 'checking' } | { state: 'connected'; account: string; calendars: number | null } | { state: 'off'; why: string };

/** The Google Calendar bridge, asked once per mount. */
export function useCalendarStatus(): CalendarStatus {
  const [cal, setCal] = useState<CalendarStatus>(PAY_URL ? { state: 'checking' } : { state: 'off', why: 'no pay service configured (VITE_PAY_URL)' });
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
  return cal;
}

export function CalendarChip({ cal }: { cal: CalendarStatus }) {
  return (
    <span className={'chip ' + (cal.state === 'connected' ? 'ok' : cal.state === 'checking' ? 'live' : '')} data-calendar={cal.state} title={cal.state === 'off' ? cal.why : undefined}>
      <span className="dot" />{cal.state === 'connected' ? 'Google Calendar connected' : cal.state === 'checking' ? 'checking Google Calendar' : 'Google Calendar not connected'}
    </span>
  );
}
interface Props {
  summary: string;
  description?: string;
  start: string;          // 'YYYY-MM-DDTHH:mm:ss' local
  minutes?: number;
  recurrenceDaily?: boolean;
  label?: string;
  compact?: boolean;
}

interface Result { ok: boolean; mode: string; account: string; link?: string; error?: string; }

export default function CalendarButton({ summary, description, start, minutes = 30, recurrenceDaily = false, label = 'Add to Google Calendar', compact = false }: Props) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'fail'>('idle');
  const [result, setResult] = useState<Result | null>(null);

  if (!PAY_URL) return <p className="footnote">Google Calendar: connect the pill-pay service (VITE_PAY_URL) to add events.</p>;

  const go = async () => {
    setState('busy');
    try {
      const r = await fetch(`${PAY_URL}/calendar/event`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ summary, description, start, minutes, recurrenceDaily }) });
      const j = (await r.json()) as Result;
      setResult(j);
      setState(j.ok ? 'done' : 'fail');
      if (j.ok) actions.activity('Google Calendar', `event added · ${summary} · ${j.account}`, 'ok');
    } catch (e) {
      setResult({ ok: false, mode: 'unavailable', account: '', error: (e as Error).message });
      setState('fail');
    }
  };

  if (state === 'done' && result?.ok) {
    return <a className={'chip ok'} href={result.link} target="_blank" rel="noopener" style={{ textDecoration: 'none' }}><span className="dot" />Added to Google Calendar · {result.account}</a>;
  }
  return (
    <div className="stack" style={{ gap: 6 }}>
      <button type="button" className={'btn ghost' + (compact ? '' : '')} style={compact ? { minHeight: 44, fontSize: 15 } : undefined} disabled={state === 'busy'} onClick={go}>
        {state === 'busy' ? 'Adding…' : label}
      </button>
      {state === 'fail' && <p className="footnote" role="alert">Could not add: {result?.error ?? 'unknown error'}</p>}
    </div>
  );
}
