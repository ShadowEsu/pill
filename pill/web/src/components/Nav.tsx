// Navigation. Phone: a bottom tab bar whose active pill slides between tabs on a spring. ≥ 900 px: a left sidebar with
// the serif wordmark, the same sections (active row: sky tint + 3 px sky rule) and a station panel with the binary pill.
// Sections differ by mode. Routes are owned by App.tsx.
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { NavLink as RouterLink, useLocation } from 'react-router-dom';
import { useStore } from '../lib/store';
import { useMediaQuery, useReducedMotion } from '../lib/motion';
import { useNow } from '../lib/when';
import BinaryPill from './BinaryPill';

type IconName = 'dash' | 'box' | 'runs' | 'pulse' | 'log' | 'today' | 'pill' | 'cal' | 'ask';
interface Item { to: string; label: string; icon: IconName }
const MEDICAL: Item[] = [
  { to: '/', label: 'Dashboard', icon: 'dash' },
  { to: '/deliveries', label: 'Deliveries', icon: 'box' },
  { to: '/runs', label: 'Runs', icon: 'runs' },
  { to: '/activity', label: 'Activity', icon: 'pulse' },
  { to: '/log', label: 'Log', icon: 'log' },
];
const PERSONAL: Item[] = [
  { to: '/', label: 'Today', icon: 'today' },
  { to: '/medicines', label: 'Medicines', icon: 'pill' },
  { to: '/schedule', label: 'Schedule', icon: 'cal' },
  { to: '/activity', label: 'Activity', icon: 'pulse' },
  { to: '/ask', label: 'Ask', icon: 'ask' },
];

const ICONS: Record<IconName, string> = {
  dash: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  box: 'M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8',
  runs: 'M3 18c3 0 4-11 7-11s3 7 5 7 2-3 6-3',
  pulse: 'M3 12h4l2-5 4 10 2-5h6',
  log: 'M5 6h14M5 12h14M5 18h9',
  today: 'M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z',
  pill: 'M9 4.5a4.5 4.5 0 0 1 6.4 0l4.1 4.1a4.5 4.5 0 0 1-6.4 6.4l-8.6-8.6zM10.9 10.9l-4.4 4.4a4.5 4.5 0 0 0 6.4 6.4l4.4-4.4',
  cal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  ask: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
};

function NavIcon({ name }: { name: IconName }) {
  return (
    <svg className="nav-icon" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

function ago(ms: number) {
  const m = Math.max(0, Math.round(ms / 60e3));
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

/** The pill highlight that slides to the active item (measured; transform-only transition). `armed` turns on one frame after the first placement so it never slides in from the corner. */
function useIndicator(listRef: React.RefObject<HTMLUListElement | null>, key: string, wide: boolean) {
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [armed, setArmed] = useState(false);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const on = list.querySelector<HTMLElement>('.nav-item.on')?.closest('li') ?? null;
      setBox(on ? { x: on.offsetLeft, y: on.offsetTop, w: on.offsetWidth, h: on.offsetHeight } : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    return () => ro.disconnect();
  }, [listRef, key, wide]);
  useLayoutEffect(() => {
    if (!box || armed) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setArmed(true)));
    return () => cancelAnimationFrame(id);
  }, [box, armed]);
  return { box, armed };
}

export default function Nav() {
  const mode = useStore((s) => s.mode);
  const station = useStore((s) => s.station);
  const { pathname } = useLocation();
  const wide = useMediaQuery('(min-width: 900px)');
  const reduce = useReducedMotion();
  const now = useNow();
  const listRef = useRef<HTMLUListElement>(null);
  const items = mode === 'medical' ? MEDICAL : PERSONAL;
  const { box, armed } = useIndicator(listRef, pathname + '|' + mode, wide);
  const hidden = !mode || pathname.startsWith('/kiosk') || pathname.startsWith('/welcome');
  if (hidden) return null;
  const indStyle: CSSProperties | undefined = box
    ? { width: box.w, height: box.h, transform: `translate(${box.x}px, ${box.y}px)`, opacity: 1, transitionDuration: armed && !reduce ? undefined : '0s' }
    : undefined;
  return (
    <nav className={'nav nav-' + mode} aria-label="Sections">
      <div className="nav-brand">
        <span className="serif nav-word">Pill</span>
        <span className="eyebrow">{mode === 'medical' ? 'medical' : 'personal'}</span>
      </div>
      <ul className="nav-list" ref={listRef}>
        <li className="nav-ind" aria-hidden="true" style={indStyle} />
        {items.map((it) => (
          <li key={it.to}>
            <RouterLink to={it.to} end={it.to === '/'} className={({ isActive }) => 'nav-item' + (isActive ? ' on' : '')}>
              <NavIcon name={it.icon} />
              <span className="nav-label">{it.label}</span>
            </RouterLink>
          </li>
        ))}
      </ul>
      <div className="nav-foot">
        {wide && (
          <div className="nav-station">
            <BinaryPill width={180} height={96} dark={false} cell={4.5} scale={1.45} label="Station pill, idle" />
            <div className="nav-station-txt">
              <span className={'chip ' + (station.online ? 'ok beat' : 'bad')}><span className="dot" />{station.id} · {station.online ? 'online' : 'offline'}</span>
              <span className="footnote">{station.calibratedAt ? `Calibrated ${ago(now - station.calibratedAt)}` : 'Not calibrated yet'}</span>
            </div>
          </div>
        )}
        <RouterLink to="/welcome" className="footnote" style={{ textDecoration: 'underline' }}>Change who I am</RouterLink>
      </div>
    </nav>
  );
}
