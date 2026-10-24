// 28 px circle with the actor's initials; the ring colour is hashed from the name onto the series palette --c1…--c6.
import './viz.css';

function initials(actor: string) {
  const words = actor.split(/[,(]/)[0].trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return (words[0] ?? '?').charAt(0).toUpperCase();
  const second = /^\d+$/.test(words[1]) ? String(Number(words[1])) : words[1].replace(/[^A-Za-z]/g, '').charAt(0);
  return (words[0].replace(/[^A-Za-z]/g, '').charAt(0) + second).toUpperCase();
}

export default function ActorAvatar({ actor }: { actor: string }) {
  let h = 0;
  for (const ch of actor) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return <span className="avatar" title={actor} aria-hidden="true" style={{ ['--av' as string]: `var(--c${(h % 6) + 1})` }}>{initials(actor)}</span>;
}
