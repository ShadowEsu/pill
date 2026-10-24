// The money rail (the site's Payments rail): nodes on a dashed track, a USDC token riding the lane above the node that
// holds the money. Change `at` and the token travels there (1.25 s, a small hop); tracks behind it light in payment blue.
// `held` rings the token and its node amber; `flowing` runs dashes along the next track (waiting for a tap or a payment).
// Equal columns, so a node's x is ((i + .5) / n) of the width. Reduced motion: the token is simply at `at`.
import Glyph, { type GlyphName } from './Glyph';
import './cinema.css';

export interface RailNode { id: string; label: string; sub?: string; glyph: GlyphName }

const LANE = 34;                 // token lane height above the icons
const ICON_MID = LANE + 4 + 26;  // track y: through the middle of the 52 px icons

export default function TokenRail({ nodes, at, amount, held = false, flowing = false, edgeLabels, label }: {
  nodes: RailNode[];
  /** index of the node holding the token */ at: number;
  /** text inside the token, e.g. "480.00 USDC" */ amount: string;
  held?: boolean;
  flowing?: boolean;
  edgeLabels?: string[];
  label: string;
}) {
  const n = nodes.length;
  const x = (i: number) => `${((i + 0.5) / n) * 100}%`;
  return (
    <figure className={'cn-railbox n' + n} style={{ margin: 0, position: 'relative', paddingTop: LANE }} role="img" aria-label={`${label}: ${amount} at ${nodes[at]?.label ?? ''}${held ? ', held' : ''}`}>
      <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: ICON_MID, height: 0 }}>
        {nodes.slice(1).map((_, i) => (
          <span key={i} className={'cn-track' + (i < at ? ' done' : '') + (flowing && i === at ? ' flow' : '')}
            style={{ position: 'absolute', left: `calc(${x(i)} + 34px)`, width: `calc(${100 / n}% - 68px)`, margin: 0 }}>
            <span className="lit" style={{ transitionDelay: i === at - 1 ? '.35s' : '0s' }} />
            {edgeLabels?.[i] && <span className="lbl">{edgeLabels[i]}</span>}
          </span>
        ))}
      </div>
      <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, paddingTop: 4 }}>
        {nodes.map((nd, i) => (
          <div key={nd.id} className={'cn-node' + (i === at ? (held ? ' held' : ' hot') : '')}>
            <span className="ico"><Glyph name={nd.glyph} size={32} delay={i * 140} /></span>
            <span className="nm">{nd.label}</span>
            {nd.sub && <span className="sb">{nd.sub}</span>}
          </div>
        ))}
      </div>
      <span aria-hidden="true" className="cn-token-pos" style={{ left: x(at), top: LANE / 2 }}>
        <span key={at} className={'cn-token num' + (held ? ' held' : ' moving')}>{amount}</span>
      </span>
    </figure>
  );
}
