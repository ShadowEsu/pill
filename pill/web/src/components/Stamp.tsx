// The verdict word, stamped: scale 1.3 → 1 with a slight rotation in 220 ms, a ring that spreads once, and the verdict's
// sound on the same frame. Tone by verdict: mint (PASS) / amber (NEEDS LAB) / grey (UNABLE TO VERIFY); never red.
// The word stays ink; colour is only the stamp's border. Reduced motion: already stamped, sound still plays once.
import { useEffect, useState } from 'react';
import { playSound, verdictSound } from '../lib/sound';
import { useReducedMotion } from '../lib/motion';
import type { Verdict } from '../lib/types';
import './cinema.css';

export const STAMP_TONE: Record<Verdict, string> = { PASS: 'var(--mint)', 'NEEDS LAB': 'var(--amber)', 'UNABLE TO VERIFY': 'var(--grey)' };

export default function Stamp({ verdict, size = 44, delay = 260, sound = true }: { verdict: Verdict; size?: number; delay?: number; sound?: boolean }) {
  const reduce = useReducedMotion();
  // which verdict has landed; a new verdict waits for its own stamp
  const [landed, setLanded] = useState<Verdict | null>(null);
  useEffect(() => {
    if (reduce) { if (sound) playSound(verdictSound(verdict)); return; }
    const t = window.setTimeout(() => { setLanded(verdict); if (sound) playSound(verdictSound(verdict)); }, delay);
    return () => clearTimeout(t);
  }, [verdict, delay, reduce, sound]);
  const down = reduce || landed === verdict;
  return (
    <span className={'cn-stamp' + (down ? (reduce ? '' : ' go') : ' cn-stamp-wait')} style={{ '--stamp': STAMP_TONE[verdict] } as React.CSSProperties}>
      <span className="cn-stamp-word" data-verdict={verdict} style={{ fontSize: size }}>{verdict}</span>
    </span>
  );
}
