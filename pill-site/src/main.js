import { animate, stagger, onScroll, createTimeline, utils } from 'animejs';
import { artFor } from './art.js';
import * as stationMod from './station.js';
const { mountStation, autoDemo, partFigures } = stationMod;
import { mountPhone, PHONE_SEQUENCES } from './phone.js';
import { mountBinaryPill } from './pill.js';
import './station.css';

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

/* ---------- hero: binary pill + word-by-word headline ---------- */
{
  const cv = document.getElementById('binary-pill');
  if (cv) mountBinaryPill(cv, { paper: false, scale: 1.45 });
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
}

/* ---------- typing headings (SomniQ): every .h2 types itself in when it scrolls into view ---------- */
if (!reduced) {
  document.querySelectorAll('.h2').forEach((h) => {
    if (h.closest('[data-split]')) return;
    const lines = h.innerHTML.split(/<br\s*\/?>/i).map((s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&'));
    const full = lines.join('\n');
    h.setAttribute('data-type', '');
    h.setAttribute('aria-label', full.replace('\n', ' '));
    h.innerHTML = '<span class="typed"></span><span class="caret" aria-hidden="true"></span>';
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

/* ---------- results chart (illustration until the real CSV lands) ---------- */
{
  const mount = document.getElementById('chart-mount');
  if (mount) {
    const W = 1000, H = 420, L = 60, R = 24, T = 24, B = 48;
    const x = (t) => L + (t / 180) * (W - L - R);
    const y = (a) => T + (1 - a / 0.6) * (H - T - B);
    const curve = (A, k, t0, noise = 0) => {
      let d = '';
      for (let t = 0; t <= 180; t += 2) {
        const a = t < t0 ? 0 : A * (1 - Math.exp(-k * (t - t0)));
        const n = noise ? (Math.sin(t * 1.7) + Math.cos(t * 0.9)) * noise : 0;
        d += (t === 0 ? 'M' : 'L') + x(t).toFixed(1) + ' ' + y(Math.max(0, a + n)).toFixed(1) + ' ';
      }
      return d;
    };
    const band = [0.36, 0.47];
    const refs = Array.from({ length: 10 }, (_, i) => curve(0.395 + (i % 5) * 0.015, 0.045 + (i % 3) * 0.004, 14 + (i % 4), 0.004));
    const tums = (() => { let d = ''; for (let t = 0; t <= 180; t += 2) { const a = t < 16 ? 0 : 0.05 * (1 - Math.exp(-0.05 * (t - 16))) + (Math.sin(t * 2.1) * 0.006); d += (t === 0 ? 'M' : 'L') + x(t).toFixed(1) + ' ' + y(Math.max(0, a)).toFixed(1) + ' '; } return d; })();
    const grid = [0, 0.2, 0.4, 0.6].map((a) => `<line x1="${L}" x2="${W - R}" y1="${y(a)}" y2="${y(a)}" stroke="var(--line)"/><text x="${L - 10}" y="${y(a) + 4}" text-anchor="end" class="mono" font-size="12" fill="var(--muted)">${a.toFixed(1)}</text>`).join('');
    const ticks = [0, 60, 120, 180].map((t) => `<text x="${x(t)}" y="${H - 16}" text-anchor="middle" font-size="12" fill="var(--muted)" font-family="var(--mono)">${t}s</text>`).join('');
    mount.innerHTML = `
      <div class="box" style="padding:20px 20px 12px; position:relative">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
          <p class="caption">absorbance (inline) vs time</p>
          <p class="caption" style="color:var(--lab)">illustration · replaced by the real runs on Saturday</p>
        </div>
        <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Chart: ten riboflavin curves rising into a grey reference band; one chalk tablet curve staying flat near zero">
          <rect x="${L}" y="${y(band[1])}" width="${W - L - R}" height="${y(band[0]) - y(band[1])}" fill="rgba(22,24,27,0.06)"/>
          <text x="${W - R - 8}" y="${y(band[1]) - 8}" text-anchor="end" font-size="12" fill="var(--muted)" font-family="var(--mono)">reference band 0.36–0.47 (10 runs)</text>
          ${grid}${ticks}
          ${refs.map((d, i) => `<path d="${d}" fill="none" stroke="var(--blue)" stroke-width="1.4" opacity="${0.35 + (i % 3) * 0.12}" data-chart-line/>`).join('')}
          <path d="${tums}" fill="none" stroke="var(--lab)" stroke-width="2" data-chart-line/>
          <text x="${x(175)}" y="${y(0.07)}" text-anchor="end" font-size="12" fill="var(--lab)" font-family="var(--mono)">chalk tablet · NEEDS LAB · N1</text>
          <text x="${x(175)}" y="${y(0.52)}" text-anchor="end" font-size="12" fill="var(--blue-ink)" font-family="var(--mono)">riboflavin ¼ tablet · PASS · P1</text>
        </svg>
      </div>`;
    if (!reduced) {
      mount.querySelectorAll('[data-chart-line]').forEach((p, i) => {
        const len = p.getTotalLength();
        p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
        animate(p, { strokeDashoffset: [len, 0], duration: 1800, delay: i * 60, ease: 'inOutSine', autoplay: onScroll({ target: mount, enter: 'bottom-=10% top', repeat: false }) });
      });
    }
  }
}

/* ---------- nav: mark the active section ---------- */
{
  const links = [...document.querySelectorAll('.nav-links a')];
  const map = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { const a = map.get(e.target.id); if (a) a.style.color = e.isIntersecting ? 'var(--ink)' : ''; });
  }, { rootMargin: '-40% 0px -55% 0px' });
  map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
}
