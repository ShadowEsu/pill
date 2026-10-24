// Dependency-free QR code: byte mode, error correction level M, versions 1–8 (up to 152 bytes; an EIP-681 USDC link is
// about 125). Follows ISO/IEC 18004: Reed–Solomon over GF(256) (poly 0x11D), interleaved blocks, function patterns,
// zig-zag data placement, the mask with the lowest penalty, BCH format and version bits. Rendered as one SVG path,
// black on white with the 4-module quiet zone.

// Level M, versions 1..8: total codewords, EC codewords per block, number of blocks.
const TOTAL = [26, 44, 70, 100, 134, 172, 196, 242];
const EC_PER_BLOCK = [10, 16, 26, 18, 24, 16, 18, 22];
const BLOCKS = [1, 1, 1, 2, 2, 4, 4, 4];
const ALIGN = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42]];
const MAX_VERSION = 8;

function gfMul(x: number, y: number) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsDivisor(degree: number) {
  const r = new Array<number>(degree).fill(0);
  r[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      r[j] = gfMul(r[j], root);
      if (j + 1 < degree) r[j] ^= r[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return r;
}

function rsRemainder(data: number[], divisor: number[]) {
  const r = new Array<number>(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ r.shift()!;
    r.push(0);
    divisor.forEach((c, i) => { r[i] ^= gfMul(c, factor); });
  }
  return r;
}

/** Data + EC codewords for `bytes` at `version`, interleaved as the symbol stores them. */
function codewords(bytes: Uint8Array, version: number) {
  const v = version - 1;
  const dataLen = TOTAL[v] - EC_PER_BLOCK[v] * BLOCKS[v];
  const bits: number[] = [];
  const put = (val: number, len: number) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(0b0100, 4); // byte mode
  put(bytes.length, 8); // count indicator: 8 bits for versions 1–9
  bytes.forEach((b) => put(b, 8));
  put(0, Math.min(4, dataLen * 8 - bits.length)); // terminator
  put(0, (8 - (bits.length % 8)) % 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let pad = 0xec; data.length < dataLen; pad ^= 0xec ^ 0x11) data.push(pad);

  const numBlocks = BLOCKS[v];
  const ecLen = EC_PER_BLOCK[v];
  const shortLen = Math.floor(TOTAL[v] / numBlocks);
  const numShort = numBlocks - (TOTAL[v] % numBlocks);
  const divisor = rsDivisor(ecLen);
  const blocks: { data: number[]; ec: number[] }[] = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const len = shortLen - ecLen + (i < numShort ? 0 : 1);
    const d = data.slice(k, k + len);
    k += len;
    blocks.push({ data: d, ec: rsRemainder(d, divisor) });
  }
  const out: number[] = [];
  for (let i = 0; i <= shortLen - ecLen; i++) for (const b of blocks) if (i < b.data.length) out.push(b.data[i]);
  for (let i = 0; i < ecLen; i++) for (const b of blocks) out.push(b.ec[i]);
  return out;
}

const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

/** ISO 18004 penalty rules N1–N4; the mask with the lowest score is used. */
function penalty(m: boolean[][]) {
  const n = m.length;
  let score = 0;
  let dark = 0;
  const line = (get: (i: number) => boolean) => {
    let s = 0;
    let run = 1;
    for (let i = 1; i <= n; i++) {
      if (i < n && get(i) === get(i - 1)) run++;
      else { if (run >= 5) s += run - 2; run = 1; }
    }
    // 1:1:3:1:1 finder-like runs with 4 light modules on one side (40 each)
    const row = Array.from({ length: n }, (_, i) => (get(i) ? '1' : '0')).join('');
    for (let i = row.indexOf('1011101'); i !== -1; i = row.indexOf('1011101', i + 1)) {
      const before = row.slice(Math.max(0, i - 4), i);
      const after = row.slice(i + 7, i + 11);
      if ((i < 4 || before === '0000') || (i + 11 > n || after === '0000')) s += 40;
    }
    return s;
  };
  for (let y = 0; y < n; y++) {
    score += line((x) => m[y][x]);
    score += line((x) => m[x][y]);
    for (let x = 0; x < n; x++) {
      if (m[y][x]) dark++;
      if (x + 1 < n && y + 1 < n && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) score += 3;
    }
  }
  return score + 10 * Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5);
}

/** QR modules (true = dark), row-major, without the quiet zone. Throws if the text needs more than version 8. */
export function encodeQr(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  let version = 1;
  while (version <= MAX_VERSION && 12 + bytes.length * 8 > (TOTAL[version - 1] - EC_PER_BLOCK[version - 1] * BLOCKS[version - 1]) * 8) version++;
  if (version > MAX_VERSION) throw new Error(`QR: ${bytes.length} bytes is over the 152-byte limit of version 8-M`);
  const size = 17 + version * 4;
  const mod = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const set = (x: number, y: number, dark: boolean) => { mod[y][x] = dark; fn[y][x] = true; };

  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      set(x, y, d !== 2 && d !== 4);
    }
  }
  const pos = ALIGN[version - 1];
  for (let i = 0; i < pos.length; i++) for (let j = 0; j < pos.length; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === pos.length - 1) || (i === pos.length - 1 && j === 0)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  const drawFormat = (mask: number) => {
    const data = (0b00 << 3) | mask; // level M = 00
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const bit = (i: number) => ((bits >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true); // dark module
  };
  drawFormat(0); // reserve the format areas
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3), b = Math.floor(i / 3);
      set(a, b, dark); set(b, a, dark);
    }
  }

  const cw = codewords(bytes, version);
  let k = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j;
      const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
      if (fn[y][x]) continue;
      mod[y][x] = k < cw.length * 8 && ((cw[k >>> 3] >>> (7 - (k & 7))) & 1) === 1; // remainder bits are 0
      k++;
    }
  }

  let best: boolean[][] | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    drawFormat(mask);
    const m = mod.map((row, y) => row.map((d, x) => (fn[y][x] ? d : d !== MASKS[mask](x, y))));
    const s = penalty(m);
    if (s < bestScore) { bestScore = s; best = m; }
  }
  return best!;
}

/** The QR as an SVG (black on white, 4-module quiet zone). `label` is the accessible name. */
export default function Qr({ value, label, size = 240 }: { value: string; label: string; size?: number }) {
  const m = encodeQr(value);
  const n = m.length + 8;
  let d = '';
  m.forEach((row, y) => row.forEach((dark, x) => { if (dark) d += `M${x + 4} ${y + 4}h1v1h-1z`; }));
  return (
    <svg className="qr" role="img" aria-label={label} viewBox={`0 0 ${n} ${n}`} width={size} height={size} shapeRendering="crispEdges" style={{ display: 'block', width: '100%', maxWidth: size, height: 'auto', aspectRatio: '1', background: '#fff', borderRadius: 12 }}>
      <rect width={n} height={n} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}
