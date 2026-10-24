// Delivery outcome in the clinic's words: Ship yes / hold / ask. Warm red only for a held payment.
import type { Delivery } from '../lib/types';

const MAP: Record<Delivery['outcome'], { cls: string; text: string }> = {
  pending: { cls: '', text: 'Pending' },
  release: { cls: 'ok', text: 'Ship: yes' },
  hold: { cls: 'bad', text: 'Ship: hold' },
  escalate: { cls: 'warn', text: 'Ship: ask' },
  released: { cls: 'ok verdict-pass', text: 'Released' },
};

export default function OutcomeChip({ outcome }: { outcome: Delivery['outcome'] }) {
  const m = MAP[outcome];
  return <span className={'chip ' + m.cls} aria-label={'Outcome: ' + m.text}><span className="dot" />{m.text}</span>;
}
