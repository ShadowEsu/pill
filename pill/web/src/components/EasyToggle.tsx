// The Easy mode switch (Settings, the Personal home): 125 % text, higher contrast, bigger hit areas (easy.css), and reading
// aloud on by default: sound on, the assistant reads its answers aloud, and the big rows get a Read aloud button.
import { actions, useStore } from '../lib/store';
import { followerSettings } from '../lib/follower';
import { playSound, setSoundOn } from '../lib/sound';

/** Easy mode on or off, with its read-aloud defaults (Settings uses this behind its own switch). */
export function setEasyMode(on: boolean) {
  actions.setEasy(on);
  followerSettings.setVoice(on);
  if (on) setSoundOn(true);
  playSound('tap');
}

export default function EasyToggle() {
  const easy = useStore((s) => s.easy);
  const toggle = () => setEasyMode(!easy);
  return (
    <button type="button" role="switch" aria-checked={easy} className="card easy-toggle" onClick={toggle} data-easy={easy}>
      <span>
        <b>Easy mode</b>
        <span className="sub">{easy ? 'On: larger words, stronger contrast, bigger buttons, reading aloud.' : 'Larger words, stronger contrast, bigger buttons, and Pill reads aloud.'}</span>
      </span>
      <span className="knob" aria-hidden="true" />
    </button>
  );
}
