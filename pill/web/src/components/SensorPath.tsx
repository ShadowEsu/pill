// How the station reads: LED → cup → inline sensor (A(t)), and cup → 90° sensor (the riboflavin glow).
// Grey track arrows always; colour lands on top: sky for the beam (brightness = light through), mint for the glow.
const CSS = `
.sp-flow { stroke-dasharray: 3 9; animation: sp-flow .7s linear infinite; }
@keyframes sp-flow { to { stroke-dashoffset: -12; } }
@media (prefers-reduced-motion: reduce) { .sp-flow { animation: none; } }
`;

/** 90° absorbance the reference tablets reach at plateau; callers divide by it so the glow arrow is fully lit there. */
export const GLOW_FULL = 0.33;

const mono = { fontFamily: 'var(--mono)', fontSize: 11, fill: 'var(--muted)' } as const;
const inkMono = { ...mono, fill: 'var(--ink-2)' } as const;

function Arrow({ x1, y1, x2, y2, color, opacity, flow, width = 2.5 }: { x1: number; y1: number; x2: number; y2: number; color: string; opacity: number; flow: boolean; width?: number }) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const head = (da: number) => `${(x2 - 9 * Math.cos(ang + da)).toFixed(1)},${(y2 - 9 * Math.sin(ang + da)).toFixed(1)}`;
  return (
    <g style={{ opacity, transition: 'opacity .4s var(--ease)' }}>
      <line x1={x1} y1={y1} x2={x2 - 4 * Math.cos(ang)} y2={y2 - 4 * Math.sin(ang)} stroke={color} strokeWidth={width} strokeLinecap="round" />
      {flow && <line className="sp-flow" x1={x1} y1={y1} x2={x2 - 6 * Math.cos(ang)} y2={y2 - 6 * Math.sin(ang)} stroke="#fff" strokeWidth={width - 0.5} strokeLinecap="round" />}
      <polygon points={`${x2},${y2} ${head(0.45)} ${head(-0.45)}`} fill={color} />
    </g>
  );
}

export default function SensorPath({ led, glow, inline, running = false }: {
  led: boolean;
  /** 0–1: how strongly the 90° channel sees the glow (arrow opacity). */ glow: number;
  /** 0–1: share of the LED light reaching the inline sensor (arrow brightness). */ inline: number;
  running?: boolean;
}) {
  const g = Math.max(0, Math.min(1, glow));
  const through = Math.max(0, Math.min(1, inline));
  const beam = led ? 'var(--sky)' : 'var(--grey)';
  return (
    <svg viewBox="0 0 360 192" style={{ width: '100%', maxWidth: 520, height: 'auto', display: 'block', margin: '0 auto' }} role="img"
      aria-label={`Light path: LED ${led ? 'on' : 'off'}, ${Math.round(through * 100)} percent through to the inline sensor, 90 degree glow ${Math.round(g * 100)} percent`}>
      <style href="pm-sensorpath" precedence="pm">{CSS}</style>
      {/* grey tracks */}
      <g opacity="0.5">
        <Arrow x1={78} y1={72} x2={142} y2={72} color="var(--line-2)" opacity={1} flow={false} />
        <Arrow x1={218} y1={72} x2={282} y2={72} color="var(--line-2)" opacity={1} flow={false} />
        <Arrow x1={180} y1={118} x2={180} y2={152} color="var(--line-2)" opacity={1} flow={false} />
      </g>
      {/* LED */}
      <rect x="10" y="52" width="64" height="40" rx="10" fill={led ? 'var(--sky-tint)' : 'var(--surface)'} stroke="var(--ink)" strokeWidth="1.2" />
      <text x="42" y="76.5" textAnchor="middle" style={{ ...inkMono, fill: 'var(--ink)' }}>LED</text>
      <text x="42" y="110" textAnchor="middle" style={mono}>465 nm</text>
      {/* beam into the cup */}
      <Arrow x1={78} y1={72} x2={142} y2={72} color={beam} opacity={led ? 1 : 0} flow={running && led} />
      {/* cup with water; mint tint = glow */}
      <text x="180" y="30" textAnchor="middle" style={mono}>cup · quarter tablet</text>
      <path d="M150 58 L153 108 a4 4 0 0 0 4 4 h46 a4 4 0 0 0 4 -4 L210 58 Z" fill="var(--sky-tint)" />
      <path d="M150 58 L153 108 a4 4 0 0 0 4 4 h46 a4 4 0 0 0 4 -4 L210 58 Z" fill="var(--mint)" style={{ opacity: g * 0.45, transition: 'opacity .4s var(--ease)' }} />
      <path d="M150 58 q7.5 -3 15 0 t15 0 t15 0 t15 0" fill="none" stroke="var(--sky)" strokeWidth="1.2" />
      <path d="M146 40 L153 108 a4 4 0 0 0 4 4 h46 a4 4 0 0 0 4 -4 L214 40" fill="none" stroke="var(--ink)" strokeWidth="1.2" strokeLinejoin="round" />
      {/* beam out to the inline sensor: brightness = light through */}
      <Arrow x1={218} y1={72} x2={282} y2={72} color={beam} opacity={led ? 0.2 + 0.8 * through : 0} flow={running && led} />
      <text x="250" y="62" textAnchor="middle" style={mono}>{led ? `${Math.round(through * 100)} %` : '—'}</text>
      {/* inline sensor */}
      <rect x="286" y="52" width="64" height="40" rx="10" fill="var(--surface)" stroke="var(--ink)" strokeWidth="1.2" />
      <text x="318" y="76.5" textAnchor="middle" style={{ ...inkMono, fill: 'var(--ink)' }}>inline</text>
      <text x="318" y="110" textAnchor="middle" style={inkMono}>A(t)</text>
      {/* 90° channel */}
      <Arrow x1={180} y1={118} x2={180} y2={152} color="var(--mint)" opacity={g} flow={running && g > 0.05} />
      <rect x="148" y="154" width="64" height="32" rx="10" fill="var(--surface)" stroke="var(--ink)" strokeWidth="1.2" />
      <text x="180" y="174" textAnchor="middle" style={{ ...inkMono, fill: 'var(--ink)' }}>90°</text>
      <text x="222" y="166" style={inkMono}>90° glow</text>
      <text x="222" y="180" style={mono}>signal {Math.round(g * 100)} %</text>
      <text x="138" y="138" textAnchor="end" style={mono}>at a right angle</text>
    </svg>
  );
}
