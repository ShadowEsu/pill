// Navigation. Phone: a bottom tab bar. ≥ 900 px: a left sidebar with the same sections plus a station chip.
// Sections differ by mode. Routes are owned by App.tsx.
import { NavLink as RouterLink, useLocation } from 'react-router-dom';
import { useStore } from '../lib/store';

interface Item { to: string; label: string; icon: string; }
const MEDICAL: Item[] = [
  { to: '/', label: 'Dashboard', icon: '▦' },
  { to: '/deliveries', label: 'Deliveries', icon: '▤' },
  { to: '/runs', label: 'Runs', icon: '◔' },
  { to: '/activity', label: 'Activity', icon: '◎' },
  { to: '/log', label: 'Log', icon: '≡' },
];
const PERSONAL: Item[] = [
  { to: '/', label: 'Today', icon: '◷' },
  { to: '/medicines', label: 'Medicines', icon: '▤' },
  { to: '/schedule', label: 'Schedule', icon: '▦' },
  { to: '/activity', label: 'Activity', icon: '◎' },
  { to: '/ask', label: 'Ask', icon: '✦' },
];

export default function Nav() {
  const mode = useStore((s) => s.mode);
  const station = useStore((s) => s.station);
  const { pathname } = useLocation();
  if (!mode || pathname.startsWith('/kiosk') || pathname.startsWith('/welcome')) return null;
  const items = mode === 'medical' ? MEDICAL : PERSONAL;
  return (
    <nav className="nav" aria-label="Sections">
      <div className="nav-brand">
        <span className="serif" style={{ fontSize: 28 }}>Pill</span>
        <span className="eyebrow">{mode === 'medical' ? 'medical' : 'personal'}</span>
      </div>
      <ul className="nav-list">
        {items.map((it) => (
          <li key={it.to}>
            <RouterLink to={it.to} end={it.to === '/'} className={({ isActive }) => 'nav-item' + (isActive ? ' on' : '')}>
              <span className="nav-icon" aria-hidden="true">{it.icon}</span>
              <span className="nav-label">{it.label}</span>
            </RouterLink>
          </li>
        ))}
      </ul>
      <div className="nav-foot">
        <span className={'chip ' + (station.online ? 'ok' : 'bad')}><span className="dot" />{station.id} · {station.online ? 'online' : 'offline'}</span>
        <RouterLink to="/welcome" className="footnote" style={{ textDecoration: 'underline' }}>Change who I am</RouterLink>
      </div>
    </nav>
  );
}
