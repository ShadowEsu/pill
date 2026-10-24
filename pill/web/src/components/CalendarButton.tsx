// "Add to Google Calendar" through the pill-pay bridge (POST /calendar/event → Composio → the connected Google account).
// Honest states: no service configured → the button says so; failure → the error text; success → the event link.
import { useState } from 'react';
import { actions } from '../lib/store';

const PAY_URL = import.meta.env.VITE_PAY_URL as string | undefined;

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
