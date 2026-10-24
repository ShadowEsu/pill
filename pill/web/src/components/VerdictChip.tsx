// The verdict as a chip. Exact words only: PASS / NEEDS LAB / UNABLE TO VERIFY. Colour is in the dot and fill, the word stays ink.
import type { Verdict } from '../lib/types';

const CLS: Record<Verdict, string> = { PASS: 'ok verdict-pass', 'NEEDS LAB': 'warn verdict-needslab', 'UNABLE TO VERIFY': 'verdict-unable' };

export default function VerdictChip({ verdict }: { verdict: Verdict | null | undefined }) {
  if (!verdict) return <span className="chip"><span className="dot" />not tested</span>;
  return <span className={'chip ' + CLS[verdict]} aria-label={'Verdict: ' + verdict}><span className="dot" />{verdict}</span>;
}
