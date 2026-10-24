// Soft moving light behind the whole app: three large blurred gradient blobs drifting on slow CSS loops.
// Medical: sky + mint. Personal: mint + amber. Fixed, z-index 0, no pointer events. Reduced motion: still.
import { useStore } from '../lib/store';

export default function Ambient() {
  const mode = useStore((s) => s.mode);
  return (
    <div className={'ambient ' + (mode === 'personal' ? 'personal' : 'medical')} aria-hidden="true">
      <i className="amb-a" />
      <i className="amb-b" />
      <i className="amb-c" />
    </div>
  );
}
