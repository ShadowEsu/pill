// anime.js onScroll, with the idle rAF loop fixed (anime.js 4.5.0, events/scroll.js).
// Each scroll container's 30 fps dataTimer is resumed when its scrollTicker begins and paused only when that ticker
// completes; but the 500 ms wake timer only ever *pauses* the scrollTicker, so it never completes and the dataTimer
// (and the engine's rAF) runs forever, even with nothing scrolling. Here the wake timer drives both: start on a
// scroll, stop 500 ms after the last one.
import { onScroll as animeOnScroll } from 'animejs';

const quieted = new WeakSet();

export function onScroll(params) {
  const obs = animeOnScroll(params);
  const c = obs.container;
  if (c && !quieted.has(c)) {
    quieted.add(c);
    c.scrollTicker.onBegin = () => {};
    c.wakeTicker.onBegin = () => { c.scrollTicker.resume(); c.dataTimer.resume(); };
    c.wakeTicker.onComplete = () => { c.scrollTicker.pause(); c.dataTimer.pause(); };
    c.dataTimer.pause();
  }
  return obs;
}
