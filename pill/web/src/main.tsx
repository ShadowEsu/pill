import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './motion.css'
import App from './App.tsx'

// Button ripple: the press point becomes --rx/--ry on the pressed .btn (index.css .btn::after). One passive listener.
document.addEventListener('pointerdown', (e) => {
  const btn = (e.target as Element | null)?.closest?.('.btn') as HTMLElement | null;
  if (!btn) return;
  const r = btn.getBoundingClientRect();
  btn.style.setProperty('--rx', `${e.clientX - r.left}px`);
  btn.style.setProperty('--ry', `${e.clientY - r.top}px`);
}, { passive: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
