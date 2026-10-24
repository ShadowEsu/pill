// Small line-art drawings for the "one run" steps and the clinic/personal screens.
// Paper sections use ink strokes; the station module supplies the dark FIG grid drawings.
const S = 'fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"';
const G = 'fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="3 4" opacity=".45"';
const wrap = (inner, label) => `<svg viewBox="0 0 400 300" width="100%" role="img" aria-label="${label}" style="color:var(--ink-2)">${inner}</svg>`;

const art = {
  bottle: wrap(`
    <g ${G}><line x1="40" y1="260" x2="360" y2="260"/><line x1="200" y1="30" x2="200" y2="260"/></g>
    <g ${S} data-draw>
      <path d="M150 90 h100 v22 h-8 v140 a10 10 0 0 1 -10 10 h-64 a10 10 0 0 1 -10 -10 v-140 h-8 z"/>
      <rect x="166" y="140" width="68" height="70" rx="4"/>
      <path d="M176 156 h48 M176 168 h36 M176 180 h44 M176 192 h28"/>
      <rect x="150" y="68" width="100" height="22" rx="4"/>
    </g>
    <g ${S} data-draw><rect x="290" y="110" width="70" height="120" rx="8"/><rect x="302" y="130" width="46" height="60" rx="3"/><circle cx="325" cy="206" r="6"/></g>
    <g ${S} data-draw><path d="M258 170 h32"/><path d="M284 164 l6 6 l-6 6"/></g>
    <text x="362" y="100" text-anchor="end" font-family="var(--mono)" font-size="10" fill="currentColor" opacity=".7">lot · drug · maker</text>
    <text x="362" y="250" text-anchor="end" font-family="var(--mono)" font-size="10" fill="currentColor" opacity=".7">no record for this lot</text>
  `, 'A pill bottle photographed by a phone; the label fields are read and the lot is checked'),

  blank: wrap(`
    <g ${G}><line x1="40" y1="260" x2="360" y2="260"/></g>
    <g ${S} data-draw>
      <path d="M120 70 h160 l-10 180 h-140 z"/>
      <path d="M128 150 h144" stroke-dasharray="6 5"/>
      <path d="M134 120 q66 -14 132 0" opacity=".6"/>
    </g>
    <g ${S} data-draw><rect x="60" y="150" width="22" height="22" rx="4"/><path d="M82 161 h38" stroke-dasharray="2 3"/></g>
    <g ${S} data-draw><rect x="318" y="150" width="22" height="22" rx="4"/><path d="M280 161 h38" stroke-dasharray="2 3"/></g>
    <text x="58" y="142" font-family="var(--mono)" font-size="10" fill="currentColor" opacity=".7">LED off → dark</text>
    <text x="238" y="142" font-family="var(--mono)" font-size="10" fill="currentColor" opacity=".7">water → blank</text>
    <text x="150" y="235" font-family="var(--mono)" font-size="10" fill="currentColor" opacity=".7">lid closed · paddle on · CV &lt; 2%</text>
  `, 'The chamber with plain water: a dark reading, then a blank reading'),

  drop: wrap(`
    <g ${G}><line x1="40" y1="260" x2="360" y2="260"/></g>
    <g ${S} data-draw>
      <path d="M120 70 h160 l-10 180 h-140 z"/>
      <path d="M128 150 h144" stroke-dasharray="6 5"/>
      <rect x="190" y="168" width="20" height="10" rx="5"/>
      <path d="M200 40 v40" stroke-dasharray="3 4"/><path d="M194 74 l6 8 l6 -8"/>
      <path d="M170 90 h60 M200 90 v30" /><path d="M186 120 h28" />
    </g>
    <g data-draw><path d="M72 161 h110" stroke="var(--blue)" stroke-width="2.4" stroke-linecap="round"/><path d="M214 161 h104" stroke="var(--blue)" stroke-width="2.4" stroke-linecap="round" opacity=".35"/></g>
    <g data-draw><path d="M200 182 v52" stroke="var(--pass)" stroke-width="2.4" stroke-linecap="round" opacity=".8"/></g>
    <rect x="52" y="150" width="20" height="22" rx="4" ${S}/><rect x="318" y="150" width="20" height="22" rx="4" ${S}/><rect x="190" y="234" width="20" height="22" rx="4" ${S}/>
    <text x="50" y="142" font-family="var(--mono)" font-size="10" fill="currentColor" opacity=".7">blue LED</text>
    <text x="300" y="142" font-family="var(--mono)" font-size="10" fill="currentColor" opacity=".7">inline · blue filter</text>
    <text x="216" y="250" font-family="var(--mono)" font-size="10" fill="currentColor" opacity=".7">90° · green filter</text>
  `, 'A tablet dropping into the chamber; the blue beam crosses one corner, the green glow is read at ninety degrees'),

  curve: wrap(`
    <g ${G}><line x1="60" y1="240" x2="360" y2="240"/><line x1="60" y1="40" x2="60" y2="240"/><rect x="60" y="96" width="300" height="44" fill="currentColor" stroke="none" opacity=".07"/></g>
    <path d="M60 238 C 120 236, 150 150, 200 122 S 300 112, 360 110" ${S} stroke="var(--blue)" stroke-width="2.2" data-draw/>
    <path d="M60 238 C 120 236, 150 230, 200 226 S 300 222, 360 222" ${S} stroke="var(--lab)" stroke-width="2.2" data-draw/>
    <text x="66" y="92" font-family="var(--mono)" font-size="10" fill="currentColor" opacity=".7">reference band · 10 runs</text>
    <text x="250" y="104" font-family="var(--mono)" font-size="10" fill="var(--blue-ink)">PASS · P1</text>
    <text x="250" y="258" font-family="var(--mono)" font-size="10" fill="var(--lab)">NEEDS LAB · N1</text>
  `, 'Two curves: a riboflavin run rising into the reference band, a chalk run staying flat'),

  delivery: wrap(`
    <g ${S} data-draw>
      <rect x="70" y="30" width="260" height="240" rx="16"/>
      <path d="M90 66 h120 M90 84 h80"/>
      <rect x="90" y="104" width="220" height="40" rx="8"/>
      <path d="M100 126 h70" stroke="currentColor" opacity=".7"/>
      <path d="M90 164 h220 M90 182 h180 M90 200 h200"/>
      <rect x="90" y="222" width="64" height="26" rx="13" fill="currentColor" opacity=".15"/>
      <rect x="164" y="222" width="64" height="26" rx="13"/>
      <rect x="238" y="222" width="72" height="26" rx="13"/>
    </g>
    <text x="90" y="60" font-family="var(--mono)" font-size="10" fill="currentColor" opacity=".7">Delivery #118 · lot B2-07</text>
    <text x="228" y="130" font-family="var(--mono)" font-size="11" fill="currentColor">$1,240 held · SANDBOX</text>
    <text x="96" y="239" font-family="var(--mono)" font-size="9" fill="currentColor" opacity=".8">Release</text>
    <text x="178" y="239" font-family="var(--mono)" font-size="9" fill="currentColor" opacity=".8">Hold</text>
    <text x="250" y="239" font-family="var(--mono)" font-size="9" fill="currentColor" opacity=".8">Escalate</text>
    <text x="96" y="160" font-family="var(--mono)" font-size="9" fill="currentColor" opacity=".55">12:04 · P1 · "release requires PASS + no recall record + cap + pharmacist tap"</text>
  `, 'The clinic delivery screen: held sandbox money, a decision log and release, hold and escalate buttons'),

  medicines: wrap(`
    <g ${S} data-draw>
      <rect x="110" y="20" width="180" height="260" rx="22"/>
      <path d="M130 60 h90"/>
      ${[0, 1, 2].map((i) => `<rect x="128" y="${84 + i * 56}" width="144" height="44" rx="8"/><circle cx="146" cy="${106 + i * 56}" r="5"/><path d="M160 ${100 + i * 56} h70 M160 ${112 + i * 56} h40"/>`).join('')}
    </g>
    <text x="130" y="54" font-family="var(--mono)" font-size="10" fill="currentColor" opacity=".7">My medicines</text>
    <text x="236" y="${110}" font-family="var(--mono)" font-size="9" fill="var(--pass)">PASS</text>
    <text x="236" y="${166}" font-family="var(--mono)" font-size="9" fill="var(--pass)">PASS</text>
    <text x="226" y="${222}" font-family="var(--mono)" font-size="9" fill="var(--unable)">UNABLE</text>
    <text x="128" y="262" font-family="var(--mono)" font-size="9" fill="currentColor" opacity=".55">tap a row to log "taken"</text>
  `, 'The personal screen: a list of bottles, each with the verdict of its one tested tablet'),
};

// fallbacks for the FIG grid until the station module provides real drawings
const partFallback = (label) => `<svg viewBox="0 0 300 300" width="100%" role="img" aria-label="${label}"><rect x="40" y="40" width="220" height="220" rx="18" fill="none" stroke="rgba(255,255,255,.3)" stroke-dasharray="4 5"/></svg>`;
['container', 'led', 'ldr', 'thermistor', 'stepper', 'esp32'].forEach((k) => { art[k] = partFallback(k); });

export function artFor(key) { return art[key] || ''; }
