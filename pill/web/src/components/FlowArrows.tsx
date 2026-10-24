// A row of nodes joined by dashed arrows (vertical when the container is narrow). Live edges flow: the dashes march toward the arrowhead.
import './viz.css';

export interface FlowNode { id: string; label: string; sub?: string; value?: string; accent: string }
export interface FlowEdge { from: string; to: string; label?: string; live?: boolean; color?: string }

export default function FlowArrows({ nodes, edges, label }: { nodes: FlowNode[]; edges: FlowEdge[]; label: string }) {
  const out: React.ReactNode[] = [];
  nodes.forEach((n, i) => {
    if (i) {
      const e = edges.find((x) => x.from === nodes[i - 1].id && x.to === n.id);
      out.push(
        <li key={'e' + n.id} className={'flow-edge' + (e?.live ? ' live' : '')} style={{ ['--edge' as string]: e?.color }} aria-label={`${nodes[i - 1].label} to ${n.label}${e?.label ? ': ' + e.label : ''}${e?.live ? ' (moving now)' : ''}`}>
          <svg className="eh" width="56" height="12" viewBox="0 0 56 12" aria-hidden="true"><path className="shaft" d="M0 6 H47" /><path className="head" d="M46 1 L56 6 L46 11 Z" /></svg>
          <svg className="ev" width="12" height="22" viewBox="0 0 12 22" aria-hidden="true"><path className="shaft" d="M6 0 V13" /><path className="head" d="M1 12 L6 22 L11 12 Z" /></svg>
          {e?.label && <span className="elabel">{e.label}</span>}
        </li>,
      );
    }
    out.push(
      <li key={n.id} className="flow-node rise" style={{ ['--accent' as string]: n.accent, animationDelay: `${i * 80}ms` }}>
        <span className="txt"><span className="lbl">{n.label}</span>{n.sub && <span className="sub">{n.sub}</span>}</span>
        {n.value && <span className="val">{n.value}</span>}
      </li>,
    );
  });
  return <div className="flow-wrap"><ol className="flow" aria-label={label}>{out}</ol></div>;
}
