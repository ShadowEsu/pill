import { animate, stagger, createTimeline, utils } from 'animejs';
import { onScroll } from './scroll.js';
import { artFor, statSpark, timetable, heatmap } from './art.js';
import * as stationMod from './station.js';
const { mountStation, autoDemo, partFigures } = stationMod;
import { mountPhone, PHONE_SEQUENCES } from './phone.js';
import { mountBinaryPill } from './pill.js';
import './station.css';
import './pay.css';
import { mountRail, mountX402, mountCalc } from './pay.js';
import { mountFlow } from './flow.js';
import { mountStory, mountCoinbase, mountFigArrows, mountScreens } from './story.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduced) document.documentElement.classList.add('reduced');

/* ---------- reveal on scroll (Apple-style fade/lift) ---------- */
if (!reduced) {
  document.querySelectorAll('.reveal').forEach((el) => {
    animate(el, {
      opacity: [0, 1],
      translateY: [18, 0],
      duration: 800,
      ease: 'outCubic',
      autoplay: onScroll({ target: el, enter: 'bottom-=8% top', leave: 'top bottom', repeat: false }),
    });
  });
} else {
  utils.set('.reveal', { opacity: 1, translateY: 0 });
}

/* ---------- hero: the CAD drawing of the chamber beside the photo + word-by-word headline ---------- */
{
  const draw = document.querySelector('[data-hero-draw]');
  if (draw) draw.innerHTML = partFigures.container;
  // the product's mark, the binary pill, sits between the story and the table (static under reduced motion)
  const cv = document.getElementById('binary-pill');
  if (cv) mountBinaryPill(cv, { paper: true, cols: 64, rows: 40, scale: 1.35 });
  const h1 = document.querySelector('[data-split]');
  if (h1) {
    const wrapWords = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((tok) => {
            if (!tok) return;
            if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(tok)); return; }
            const s = document.createElement('span'); s.className = 'w'; s.textContent = tok; frag.appendChild(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') wrapWords(n);
      });
    };
    wrapWords(h1);
    if (!reduced) animate(h1.querySelectorAll('.w'), { opacity: [0, 1], translateY: ['0.35em', 0], duration: 900, delay: stagger(90, { start: 150 }), ease: 'outCubic' });
  }
  // the second line types itself in once the headline has landed
  const sub = document.querySelector('.hero-sub');
  if (sub) {
    const typed = sub.querySelector('.hs-typed');
    const text = sub.querySelector('.hs-ghost').textContent;
    if (reduced) { typed.textContent = text; sub.classList.add('done'); }
    else {
      sub.classList.add('typing');
      let n = 0;
      const tick = () => { typed.textContent = text.slice(0, ++n); if (n < text.length) setTimeout(tick, text[n] === ' ' ? 70 : 44); else setTimeout(() => sub.classList.add('done'), 1400); };
      setTimeout(tick, 1350);
    }
  }
}

/* ---------- typing headings (SomniQ): every .h2 types itself in when it scrolls into view ---------- */
if (!reduced) {
  document.querySelectorAll('.h2').forEach((h) => {
    if (h.closest('[data-split]')) return;
    const lines = h.innerHTML.split(/<br\s*\/?>/i).map((s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&'));
    const full = lines.join('\n');
    h.setAttribute('data-type', '');
    h.setAttribute('aria-label', full.replace('\n', ' '));
    // an invisible copy of the full heading holds its final height, so typing never pushes the page down
    const esc = full.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>');
    h.innerHTML = `<span class="tg" aria-hidden="true">${esc}</span><span class="tl" aria-hidden="true"><span class="typed"></span><span class="caret"></span></span>`;
    const typed = h.querySelector('.typed');
    let started = false;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || started) return;
      started = true; io.disconnect();
      let n = 0;
      const tick = () => {
        n++;
        const s = full.slice(0, n);
        typed.innerHTML = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>');
        if (n < full.length) setTimeout(tick, full[n] === ' ' ? 60 : 38);
        else setTimeout(() => h.classList.add('done'), 900);
      };
      tick();
    }, { threshold: 0.4 });
    io.observe(h);
  });
}

/* ---------- counters (Stripe-style, count once) ---------- */
document.querySelectorAll('[data-count]').forEach((el) => {
  const final = el.textContent;
  const target = Number(el.dataset.count);
  const prefix = el.dataset.prefix || '';
  const fmt = el.dataset.format;
  const suffix = el.dataset.suffix || '';
  const decimals = Number(el.dataset.decimals || 0);
  const show = (v) => {
    if (fmt === 'k') el.textContent = prefix + Math.round(v / 1000) + 'k' + suffix;
    else el.textContent = prefix + (decimals ? v.toFixed(decimals) : Math.round(v).toLocaleString('en-US')) + suffix;
  };
  if (reduced) return;
  const obj = { v: 0 };
  animate(obj, {
    v: target,
    duration: 1400,
    ease: 'outExpo',
    onUpdate: () => show(obj.v),
    onComplete: () => { el.textContent = final; },
    autoplay: onScroll({ target: el, enter: 'bottom-=10% top', repeat: false }),
  });
});

/* ---------- typing line (SomniQ): cycles the verbs ---------- */
{
  const words = document.querySelector('#typeline .words');
  const phrases = ['It dissolves.', 'It watches.', 'It decides.', 'It holds the money.', 'It says when it cannot tell.'];
  if (words && !reduced) {
    let i = 0;
    const type = (text, cb) => {
      let n = 0;
      const tick = () => { words.textContent = text.slice(0, n++); if (n <= text.length) setTimeout(tick, 42); else cb && cb(); };
      tick();
    };
    const erase = (cb) => {
      const tick = () => { const t = words.textContent; if (t.length) { words.textContent = t.slice(0, -1); setTimeout(tick, 22); } else cb && cb(); };
      tick();
    };
    let running = false;
    const loop = () => { if (!running) return; type(phrases[i], () => setTimeout(() => erase(() => { i = (i + 1) % phrases.length; loop(); }), 1500)); };
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && !running) { running = true; words.textContent = ''; loop(); } else if (!e.isIntersecting) { running = false; } }, { threshold: 0.3 });
    io.observe(words);
  }
}

/* ---------- art slots: inline blueprint drawings for the steps ---------- */
document.querySelectorAll('.art-slot[data-art], .fig .art[data-part]').forEach((slot) => {
  const key = slot.dataset.art || slot.dataset.part;
  const svg = artFor(key);
  if (svg) slot.innerHTML = svg;
});
// part figures from the station module replace the placeholders
document.querySelectorAll('.fig .art[data-part]').forEach((slot) => {
  const svg = partFigures[slot.dataset.part];
  if (svg) slot.innerHTML = svg;
});
{
  const mount = document.getElementById('station-mount');
  if (mount) {
    const station = mountStation(mount);
    if (reduced) { station.setProgress(1); }
    else if (stationMod.attachScroll) {
      stationMod.attachScroll(station, { stage: document.getElementById('station'), idleAfterMs: 2500 });
    } else {
      const stage = document.getElementById('station');
      let driven = false;
      const stopDemo = autoDemo(station);
      onScroll({
        target: stage,
        enter: 'bottom top+=10%',
        leave: 'top bottom-=90%',
        sync: 0.3,
        onUpdate: (o) => { if (!driven) { driven = true; stopDemo(); } station.setProgress(utils.clamp(o.progress, 0, 1)); },
      });
    }
  }
}

/* ---------- FIG grid: strokes draw in when each figure scrolls into view ---------- */
if (!reduced) {
  document.querySelectorAll('.fig .art svg').forEach((svg) => {
    const shapes = [...svg.querySelectorAll('path, line, polyline, circle, ellipse, rect')].filter((s) => s.getTotalLength && !s.getAttribute('fill')?.startsWith('rgba(11'));
    shapes.forEach((s) => { const len = s.getTotalLength(); s.style.strokeDasharray = len; s.style.strokeDashoffset = len; });
    animate(shapes, {
      strokeDashoffset: 0,
      duration: 1400,
      delay: stagger(18),
      ease: 'inOutSine',
      autoplay: onScroll({ target: svg.closest('.fig'), enter: 'bottom-=10% top', repeat: false }),
    });
  });
}

/* ---------- draw-in for the blueprint strokes in paper sections ---------- */
if (!reduced) {
  document.querySelectorAll('.art-slot svg [data-draw]').forEach((path) => {
    const len = path.getTotalLength ? path.getTotalLength() : 600;
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = len;
    animate(path, {
      strokeDashoffset: [len, 0],
      duration: 1400,
      ease: 'inOutSine',
      delay: stagger(120),
      autoplay: onScroll({ target: path.closest('.art-slot'), enter: 'bottom-=10% top', repeat: false }),
    });
  });
}
/* ---------- the money tree: ink arrows draw in once, heads and the dashed (not yet run) arrow fade in after ---------- */
{
  const mount = document.getElementById('flow-mount');
  const svg = mount && mountFlow(mount);
  if (svg && !reduced) {
    const lines = [...svg.querySelectorAll('[data-arrow]')];
    const late = [...svg.querySelectorAll('[data-head], [data-arrow-dash]')];
    lines.forEach((p) => { const len = p.getTotalLength(); p.style.strokeDasharray = len; p.style.strokeDashoffset = len; });
    late.forEach((p) => { p.style.opacity = 0; });
    const trigger = { target: svg, enter: 'bottom-=15% top', sync: 'play', repeat: false };
    animate(lines, { strokeDashoffset: 0, duration: 900, delay: stagger(45), ease: 'inOutSine', autoplay: onScroll(trigger) });
    animate(late, { opacity: [0, 1], duration: 400, delay: stagger(30, { start: 700 }), ease: 'outQuad', autoplay: onScroll({ ...trigger }) });
  }
}

/* ---------- phone mock ---------- */
{
  const loops = {
    'phone-mount': { sequence: [...PHONE_SEQUENCES.verdict, ['calibration', 6000]], still: 'pass' },
    'phone-clinic': { sequence: PHONE_SEQUENCES.clinic, still: 'delivery', caption: true },
    'phone-personal': { sequence: PHONE_SEQUENCES.personal, still: 'medicines', caption: true },
  };
  Object.entries(loops).forEach(([id, cfg]) => {
    const mount = document.getElementById(id);
    if (!mount) return;
    const phone = mountPhone(mount, { sequence: cfg.sequence, caption: cfg.caption });
    if (reduced) phone.setState(cfg.still); else phone.play();
  });
}

/* ---------- the first real run: three numbers from runs/REAL_aspirin_first_test.csv ---------- */
{
  const mount = document.getElementById('chart-mount');
  if (mount) {
    const ROWS = [
      ['side sensor (90°) · cloudiness rise', 0.29, 'var(--mint-ink)'],
      ['inline · red channel change', 0.035, 'var(--blue-ink)'],
      ['blank noise', 0.006, 'var(--muted)'],
    ];
    // two drawings of the same three numbers: labels beside the bars on wide screens, above them on phones
    const chart = (narrow) => {
      const W = narrow ? 360 : 1000, L = narrow ? 0 : 300, R = narrow ? 56 : 90, rowH = narrow ? 70 : 64, T = 16;
      const H = T + ROWS.length * rowH + 30;
      const x = (v) => L + (v / 0.3) * (W - L - R);
      const grid = [0, 0.1, 0.2, 0.3].map((v) => `<line x1="${x(v)}" x2="${x(v)}" y1="${T}" y2="${H - 30}" stroke="var(--line)"/><text x="${x(v)}" y="${H - 8}" text-anchor="${narrow && v === 0 ? 'start' : 'middle'}" font-size="12" fill="var(--muted)" font-family="var(--mono)">${v.toFixed(1)}</text>`).join('');
      const bars = ROWS.map(([label, v, c], i) => {
        const y = T + i * rowH + (narrow ? 26 : 14), w = Math.max(3, x(v) - L).toFixed(1);
        const lab = narrow
          ? `<text x="0" y="${y - 9}" font-size="14" fill="var(--ink)" font-family="var(--sans)">${label}</text>`
          : `<text x="${L - 16}" y="${y + 21}" text-anchor="end" font-size="15" fill="var(--ink)" font-family="var(--sans)">${label}</text>`;
        return `${lab}
        <rect x="${L}" y="${y}" width="${w}" height="${narrow ? 26 : 32}" rx="8" fill="${c}" data-bar/>
        <text x="${(+w + L + 10).toFixed(1)}" y="${y + (narrow ? 18 : 21)}" font-size="15" fill="var(--ink)" font-family="var(--mono)">${v}</text>`;
      }).join('');
      return `<svg class="${narrow ? 'chart-narrow' : 'chart-wide'}" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Bar chart of the first real aspirin run: the side sensor's cloudiness signal rose by 0.29, the red channel changed by 0.035, and the blank noise was 0.006">${grid}${bars}</svg>`;
    };
    mount.innerHTML = `
      <div class="box" style="padding:20px 20px 12px">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:8px">
          <p class="caption">first real aspirin run · signal change, as the station app reports it</p>
          <p class="caption">runs/REAL_aspirin_first_test.csv · measured, not modelled</p>
        </div>
        ${chart(false)}${chart(true)}
      </div>`;
    if (!reduced) {
      const rects = mount.querySelectorAll('[data-bar]');
      rects.forEach((r) => { r.style.transformBox = 'fill-box'; r.style.transformOrigin = 'left center'; });
      animate(rects, { scaleX: [0, 1], duration: 1100, delay: stagger(160), ease: 'outCubic', autoplay: onScroll({ target: mount, enter: 'bottom-=10% top', sync: 'play', repeat: false }) });
    }
  }
}

/* ---------- nav: the current chapter (link highlight, chapter label, reading progress) ---------- */
{
  const links = [...document.querySelectorAll('.nav-links a')];
  const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  const chLabel = document.querySelector('.nav-ch');
  const sections = [...document.querySelectorAll('main > section')];
  let current = null;
  const setCurrent = (s) => {
    if (s === current) return;
    current = s;
    const navId = s.dataset.nav || s.id;
    links.forEach((a) => { const on = a === byId.get(navId); a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    // the chapter this section belongs to: its own, or the nearest one above it
    let ch = null;
    for (let i = sections.indexOf(s); i >= 0 && !ch; i--) ch = sections[i].querySelector('.chapter');
    if (chLabel) {
      chLabel.querySelector('b').textContent = ch ? ch.querySelector('.ch-n').textContent : '';
      chLabel.querySelector('span').textContent = ch ? ch.querySelector('.ch-t').textContent : '';
      chLabel.classList.toggle('on', !!ch);
    }
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) setCurrent(e.target); });
  }, { rootMargin: '-45% 0px -54% 0px' });
  sections.forEach((s) => io.observe(s));
  const bar = document.querySelector('.nav-progress');
  let raf = 0;
  const onScrollBar = () => { raf = 0; const max = document.documentElement.scrollHeight - innerHeight; bar.style.transform = `scaleX(${max > 0 ? (scrollY / max).toFixed(4) : 0})`; };
  if (bar) { addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(onScrollBar); }, { passive: true }); onScrollBar(); }
}

/* ---------- scroll story, Coinbase flow, FIG arrows ---------- */
{
  const story = document.getElementById('story');
  if (story) mountStory(story);
  const cb = document.getElementById('coinbase');
  if (cb) mountCoinbase(cb);
  const figs = document.querySelector('#parts .figs');
  if (figs) mountFigArrows(figs);
  const screens = document.querySelector('#screens [data-ss]');
  if (screens) mountScreens(screens);
}

/* ---------- at the table: the Pill Gate phase rail fills phase by phase ---------- */
{
  const rail = document.querySelector('#table .pg-rail');
  if (rail && !reduced) {
    const bars = rail.querySelectorAll('.pg-bar i');
    utils.set(bars, { scaleX: 0 });
    animate(bars, { scaleX: [0, 1], duration: 700, delay: stagger(420, { start: 300 }), ease: 'inOutSine', autoplay: onScroll({ target: rail, enter: 'bottom-=15% top', sync: 'play', repeat: false }) });
  }
}

/* ---------- stats band: a small chart under each number ---------- */
document.querySelectorAll('#problem .stat').forEach((stat, i) => {
  const big = stat.querySelector('.big');
  big.insertAdjacentHTML('afterend', statSpark(i));
  if (reduced) return;
  const shapes = stat.querySelectorAll('.spark rect, .spark circle, .spark line');
  const lines = stat.querySelectorAll('.spark .sp-line');
  const auto = () => onScroll({ target: stat, enter: 'bottom-=10% top', repeat: false });
  const area = stat.querySelector('.spark .sp-area');
  utils.set([...shapes, ...(area ? [area] : [])], { opacity: 0 });
  if (shapes.length) animate(shapes, { scaleY: [0, 1], opacity: [0, 1], duration: 700, delay: stagger(45, { start: 250 }), ease: 'outCubic', autoplay: auto() });
  lines.forEach((p) => { const len = p.getTotalLength(); p.style.strokeDasharray = len; p.style.strokeDashoffset = len; animate(p, { strokeDashoffset: 0, duration: 1400, delay: 200, ease: 'inOutSine', autoplay: auto() }); });
  if (area) animate(area, { opacity: [0, 1], duration: 1200, delay: 700, ease: 'outCubic', autoplay: auto() });
});

/* ---------- clinic: a day on a timeline + verdicts by lot and day ---------- */
{
  const tt = document.getElementById('tt-mount');
  const hm = document.getElementById('heat-mount');
  if (tt) {
    tt.innerHTML = timetable();
    if (!reduced) {
      const blocks = tt.querySelectorAll('.tt-b');
      utils.set(blocks, { opacity: 0 });
      animate(blocks, { opacity: [0, 1], translateY: [14, 0], duration: 700, delay: stagger(160, { start: 200 }), ease: 'outCubic', autoplay: onScroll({ target: tt, enter: 'bottom-=12% top', repeat: false }) });
      animate(tt.querySelectorAll('.tt-bar i'), { scaleX: [0, 1], duration: 520, delay: stagger(110, { start: 380 }), ease: 'outCubic', autoplay: onScroll({ target: tt, enter: 'bottom-=12% top', repeat: false }) });
    }
  }
  if (hm) {
    hm.innerHTML = heatmap();
    if (!reduced) {
      const cells = hm.querySelectorAll('.hm-c');
      utils.set(cells, { opacity: 0 });
      animate(cells, { opacity: [0, 1], scale: [0.6, 1], duration: 500, delay: stagger(22, { grid: [7, 6], from: 'first', start: 200 }), ease: 'outBack(1.6)', autoplay: onScroll({ target: hm, enter: 'bottom-=12% top', repeat: false }) });
    }
  }
}

/* ---------- what you see on stage: three phones, three outcomes ---------- */
document.querySelectorAll('.onstage-phone').forEach((slot) => {
  const state = slot.dataset.state;
  const phone = mountPhone(slot, { state });
  if (reduced) return;
  let played = false;
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting || played) return;
    played = true; io.disconnect();
    phone.setState(state);
  }, { threshold: 0.45 });
  io.observe(slot);
});

/* ---------- payments: rail, x402 call, calculator ---------- */
{
  const rail = document.getElementById('rail-mount');
  const x402 = document.getElementById('x402-mount');
  const calc = document.getElementById('calc-mount');
  if (rail) mountRail(rail);
  if (x402) mountX402(x402);
  if (calc) mountCalc(calc);
}
