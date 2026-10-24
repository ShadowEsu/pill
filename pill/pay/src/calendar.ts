// Google Calendar bridge. Uses the Composio CLI already logged in on this Mac (connected account alias from CALENDAR_ACCOUNT,
// default 'preston-personal'). The app calls POST /calendar/event; we shell out to `composio execute GOOGLECALENDAR_CREATE_EVENT`.
// If the CLI or the connection is missing, we say so and create nothing.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';

const run = promisify(execFile);
const CLI = process.env.COMPOSIO_BIN || path.join(os.homedir(), '.local', 'bin', 'composio');
const ACCOUNT = process.env.CALENDAR_ACCOUNT || 'preston-personal';
const TZ = process.env.CALENDAR_TZ || 'America/Los_Angeles';

export interface CalendarEventInput {
  summary: string;
  description?: string;
  start: string;          // 'YYYY-MM-DDTHH:mm:ss' local to TZ
  minutes?: number;       // duration, default 30
  recurrenceDaily?: boolean; // dose reminders repeat daily
}

export interface CalendarResult {
  ok: boolean;
  mode: 'composio' | 'unavailable';
  account: string;
  id?: string;
  link?: string;
  start?: string;
  error?: string;
}

function parseCli(out: string) {
  const i = out.indexOf('{');
  if (i < 0) throw new Error('no JSON in CLI output');
  return JSON.parse(out.slice(i)) as { successful?: boolean; error?: string; data?: { response_data?: Record<string, unknown> } & Record<string, unknown> };
}

export async function calendarStatus(): Promise<{ mode: CalendarResult['mode']; account: string; calendars?: number; error?: string }> {
  try {
    const { stdout } = await run(CLI, ['execute', 'GOOGLECALENDAR_LIST_CALENDARS', '--account', ACCOUNT, '-d', '{}'], { timeout: 30000 });
    const d = parseCli(stdout);
    const data = (d.data ?? {}) as { calendars?: unknown[]; items?: unknown[] };
    return { mode: 'composio', account: ACCOUNT, calendars: (data.calendars ?? data.items)?.length ?? 0 };
  } catch (e) {
    return { mode: 'unavailable', account: ACCOUNT, error: (e as Error).message.slice(0, 200) };
  }
}

export async function createEvent(input: CalendarEventInput): Promise<CalendarResult> {
  const payload: Record<string, unknown> = {
    calendar_id: 'primary',
    summary: input.summary,
    description: (input.description ? input.description + '\n\n' : '') + 'Created by the Pill app (screening result, not a pharmacopeial test).',
    start_datetime: input.start,
    event_duration_hour: 0,
    event_duration_minutes: input.minutes ?? 30,
    timezone: TZ,
  };
  if (input.recurrenceDaily) payload.recurrence = ['RRULE:FREQ=DAILY'];
  try {
    const { stdout } = await run(CLI, ['execute', 'GOOGLECALENDAR_CREATE_EVENT', '--account', ACCOUNT, '-d', JSON.stringify(payload)], { timeout: 30000 });
    const d = parseCli(stdout);
    const ev = (d.data?.response_data ?? d.data ?? {}) as { id?: string; htmlLink?: string; start?: { dateTime?: string } };
    if (!d.successful) return { ok: false, mode: 'composio', account: ACCOUNT, error: d.error || 'Composio reported failure' };
    return { ok: true, mode: 'composio', account: ACCOUNT, id: ev.id, link: ev.htmlLink, start: ev.start?.dateTime };
  } catch (e) {
    return { ok: false, mode: 'unavailable', account: ACCOUNT, error: (e as Error).message.slice(0, 200) };
  }
}
