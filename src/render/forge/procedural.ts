// The effect shapes, drawn on a 2D canvas in the art's doodle style (tools/art/assets.ts): flat
// white shapes under a fat dark-brown (INK) line, which the scene tints (a sprite's tint multiplies,
// so the white fill takes the colour and the line stays dark): little stars, crosses and drops for
// sparks, a spiky comic impact star and speed lines for a blow, puffy clouds for steam and smoke,
// a flat flame for the furnace, a ring of runes, a flat sunburst. No soft glows or gradients.
// furnaceMouth paints the furnace picture's own flames out, so the scene's flame shows its state.
// Also stand-ins for scene pictures that fail to load, drawn the same flat way, which follow the
// anchors in layout.ts (anvil face, furnace mouth …), so a real picture replaces one without moving anything.

import type { WeaponType } from '../../sim/core/types.ts';
import { type DwarfPose, INK, PROP_ART, SCENE_PLACE } from './layout.ts';

function canvas(w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const g = c.getContext('2d');
  if (g === null) throw new Error('2d canvas unavailable');
  return { c, g };
}

const INK_CSS = `#${INK.toString(16).padStart(6, '0')}`;

/** Fill white and outline in ink: the outline is drawn first, twice as wide, so the fill keeps its full size. */
function inked(g: CanvasRenderingContext2D, path: () => void, line: number): void {
  g.lineJoin = 'round';
  g.lineCap = 'round';
  path();
  g.strokeStyle = INK_CSS;
  g.lineWidth = line * 2;
  g.stroke();
  g.fillStyle = '#ffffff';
  g.fill();
}

// ---------- Effect shapes ----------

export type DoodleShape = 'star' | 'cross' | 'drop' | 'dot' | 'diamond';

/**
 * A small outlined shape (white, tinted when shown), centred in a size×size canvas with room for
 * its line. star = a four-point ✦, cross = a fat plus, drop = a teardrop pointing right (the
 * scene turns it along its flight), dot = a round blob, diamond = a rhombus.
 */
export function doodle(kind: DoodleShape, size = 64): HTMLCanvasElement {
  const { c, g } = canvas(size, size);
  const line = size * 0.07;
  const r = size / 2 - line * 1.4;
  const m = size / 2;
  inked(
    g,
    () => {
      g.beginPath();
      switch (kind) {
        case 'star': {
          // Four points with curved (pinched) sides: ✦.
          const pts = [
            [0, -1],
            [1, 0],
            [0, 1],
            [-1, 0],
          ] as const;
          g.moveTo(m, m - r);
          for (let i = 0; i < 4; i++) {
            const [ax, ay] = pts[i] as readonly [number, number];
            const [bx, by] = pts[(i + 1) % 4] as readonly [number, number];
            g.quadraticCurveTo(m + (ax + bx) * r * 0.12, m + (ay + by) * r * 0.12, m + bx * r, m + by * r);
          }
          g.closePath();
          break;
        }
        case 'cross': {
          const a = r * 0.36;
          g.moveTo(m - a, m - r);
          g.lineTo(m + a, m - r);
          g.lineTo(m + a, m - a);
          g.lineTo(m + r, m - a);
          g.lineTo(m + r, m + a);
          g.lineTo(m + a, m + a);
          g.lineTo(m + a, m + r);
          g.lineTo(m - a, m + r);
          g.lineTo(m - a, m + a);
          g.lineTo(m - r, m + a);
          g.lineTo(m - r, m - a);
          g.lineTo(m - a, m - a);
          g.closePath();
          break;
        }
        case 'drop': {
          // Round tail on the left, point on the right.
          const t = r * 0.5;
          g.moveTo(m + r, m);
          g.quadraticCurveTo(m + r * 0.1, m - t * 1.1, m - r + t, m - t);
          g.arc(m - r + t, m, t, -Math.PI / 2, Math.PI / 2, true);
          g.quadraticCurveTo(m + r * 0.1, m + t * 1.1, m + r, m);
          g.closePath();
          break;
        }
        case 'dot':
          g.arc(m, m, r * 0.8, 0, Math.PI * 2);
          break;
        case 'diamond':
          g.moveTo(m, m - r);
          g.lineTo(m + r * 0.7, m);
          g.lineTo(m, m + r);
          g.lineTo(m - r * 0.7, m);
          g.closePath();
          break;
      }
    },
    line,
  );
  return c;
}

/** The comic impact star of a blow: a spiky, slightly uneven star with a fat line (white, tinted yellow). */
export function burst(size = 256, points = 9): HTMLCanvasElement {
  const { c, g } = canvas(size, size);
  const line = size * 0.035;
  const m = size / 2;
  const outer = size / 2 - line * 1.6;
  inked(
    g,
    () => {
      g.beginPath();
      for (let i = 0; i < points * 2; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / points;
        // Uneven spikes, as if drawn by hand.
        const k = i % 2 === 0 ? (i % 4 === 0 ? 1 : 0.84) : 0.46 + 0.05 * Math.sin(i * 2.3);
        const x = m + Math.cos(a) * outer * k;
        const y = m + Math.sin(a) * outer * k;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
    },
    line,
  );
  return c;
}

/** Short speed lines radiating round an empty middle (ink, drawn white-on-nothing: tint them dark or leave as ink). */
export function speedLines(size = 256, count = 10): HTMLCanvasElement {
  const { c, g } = canvas(size, size);
  const m = size / 2;
  g.strokeStyle = INK_CSS;
  g.lineCap = 'round';
  g.lineWidth = size * 0.026;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + (i % 2 === 0 ? 0.12 : -0.08);
    const r0 = size * (i % 2 === 0 ? 0.33 : 0.37);
    const r1 = size * (i % 2 === 0 ? 0.47 : 0.44);
    g.beginPath();
    g.moveTo(m + Math.cos(a) * r0, m + Math.sin(a) * r0);
    g.lineTo(m + Math.cos(a) * r1, m + Math.sin(a) * r1);
    g.stroke();
  }
  return c;
}

/** A puffy cloud of round lumps with one outline round all of them (steam, smoke, the bellows' air). */
export function cloud(size = 128): HTMLCanvasElement {
  const { c, g } = canvas(size, size);
  const line = size * 0.05;
  const m = size / 2;
  const lumps: [number, number, number][] = [
    [-0.2, 0.08, 0.24],
    [0.04, -0.12, 0.27],
    [0.24, 0.06, 0.22],
    [0.02, 0.14, 0.24],
  ];
  const path = () => {
    g.beginPath();
    for (const [x, y, r] of lumps) {
      g.moveTo(m + (x + r) * size, m + y * size);
      g.arc(m + x * size, m + y * size, r * size, 0, Math.PI * 2);
    }
  };
  // The union's outline: every lump stroked wide, then every lump filled over the inner lines.
  path();
  g.strokeStyle = INK_CSS;
  g.lineWidth = line * 2;
  g.stroke();
  path();
  g.fillStyle = '#ffffff';
  g.fill();
  return c;
}

/**
 * A flat cartoon flame (white, tinted by the fire's state), its base along the bottom edge and
 * centred: one tall tongue and two small ones on the sides. inner = the lighter core laid inside
 * the flame: one plain round-bottomed tongue, no outline.
 */
export function flame(w = 128, h = 160, inner = false): HTMLCanvasElement {
  if (inner) return flameCore(w, h);
  const { c, g } = canvas(w, h);
  const line = w * 0.05;
  const L = line * 1.2;
  const x0 = L;
  const x1 = w - L;
  const top = L;
  const base = h - L;
  const mx = w / 2;
  const path = () => {
    g.beginPath();
    g.moveTo(mx, top);
    // Right side: down to a small tongue, then round the base.
    g.bezierCurveTo(mx + w * 0.14, top + h * 0.22, x1, top + h * 0.3, x1 - w * 0.02, top + h * 0.42);
    g.bezierCurveTo(x1 - w * 0.08, top + h * 0.5, x1 + w * 0.0, top + h * 0.56, x1, base - h * 0.28);
    g.bezierCurveTo(x1, base - h * 0.06, mx + w * 0.22, base, mx, base);
    g.bezierCurveTo(mx - w * 0.22, base, x0, base - h * 0.06, x0, base - h * 0.28);
    g.bezierCurveTo(x0, top + h * 0.5, x0 + w * 0.08, top + h * 0.44, x0 + w * 0.04, top + h * 0.34);
    g.bezierCurveTo(x0 + w * 0.2, top + h * 0.4, mx - w * 0.1, top + h * 0.3, mx, top);
    g.closePath();
  };
  inked(g, path, line);
  return c;
}

/** The flame's core: a single tongue, round at the bottom, its tip leaning a little. */
function flameCore(w: number, h: number): HTMLCanvasElement {
  const { c, g } = canvas(w, h);
  const mx = w / 2;
  const r = w * 0.42;
  const cy = h - r - 1;
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(mx + w * 0.04, 1);
  g.bezierCurveTo(mx + w * 0.18, h * 0.3, mx + r, cy - r * 0.6, mx + r, cy);
  g.arc(mx, cy, r, 0, Math.PI);
  g.bezierCurveTo(mx - r, cy - r * 0.8, mx - w * 0.1, h * 0.28, mx + w * 0.04, 1);
  g.closePath();
  g.fill();
  return c;
}

/** The box (shares of the picture) the furnace's opening is looked for in, and the point inside it to start from. */
export interface MouthSearch {
  x0: number;
  x1: number;
  top: number;
  bottom: number;
}

/**
 * The furnace picture's painted flames painted out, so the drawn flame can show the fire's state:
 * from the mouth point, every pixel inside the box that is dark (the opening and its line) or warm
 * (the painted flames) and joined to it is the opening; its warm pixels, and a 2 px rim round them
 * inside the opening, are painted in the opening's own dark (the middle of its dark pixels). The
 * rest of the canvas (the picture's size) stays clear, so it lies over the picture exactly and
 * follows the opening's own shape, whatever stones are drawn round it. Null when nothing warm is
 * found (a picture with an empty mouth needs no cover).
 */
export function furnaceMouth(source: CanvasImageSource, w: number, h: number, box: MouthSearch, seed: { x: number; y: number }): HTMLCanvasElement | null {
  const { c, g } = canvas(w, h);
  g.drawImage(source, 0, 0, c.width, c.height);
  const W = c.width;
  const H = c.height;
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  const x0 = Math.max(0, Math.floor(box.x0 * W));
  const x1 = Math.min(W - 1, Math.ceil(box.x1 * W));
  const y0 = Math.max(0, Math.floor(box.top * H));
  const y1 = Math.min(H - 1, Math.ceil(box.bottom * H));
  // Dark: the opening and the ink line (lum under 0.3); warm: the painted flames (red well over blue).
  const kind = (p: number): 0 | 1 | 2 => {
    const i = p * 4;
    if ((d[i + 3] ?? 0) < 128) return 0;
    const r = d[i] ?? 0;
    const gg = d[i + 1] ?? 0;
    const b = d[i + 2] ?? 0;
    if (r > 150 && r - b > 80) return 2;
    return (0.3 * r + 0.59 * gg + 0.11 * b) / 255 < 0.3 ? 1 : 0;
  };
  const inBox = (x: number, y: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  // The opening: flood from the mouth point (or the nearest dark or warm pixel to it).
  const region = new Uint8Array(W * H);
  let start = -1;
  const sx = Math.round(seed.x * W);
  const sy = Math.round(seed.y * H);
  for (let r = 0; r < 24 && start < 0; r++) {
    for (let dy = -r; dy <= r && start < 0; dy++) {
      for (let dx = -r; dx <= r && start < 0; dx++) {
        const x = sx + dx;
        const y = sy + dy;
        if (inBox(x, y) && kind(y * W + x) !== 0) start = y * W + x;
      }
    }
  }
  if (start < 0) return null;
  const stack = [start];
  region[start] = 1;
  const warm: number[] = [];
  const dark: number[] = [];
  while (stack.length > 0) {
    const p = stack.pop() as number;
    const x = p % W;
    const y = (p - x) / W;
    if (kind(p) === 2) warm.push(p);
    else dark.push(p);
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ] as const) {
      if (!inBox(nx, ny)) continue;
      const q = ny * W + nx;
      if (region[q] === 0 && kind(q) !== 0) {
        region[q] = 1;
        stack.push(q);
      }
    }
  }
  if (warm.length === 0 || dark.length === 0) return null;
  // The opening's own dark: the middle of its dark pixels, each channel.
  const pick = (ch: number) => {
    const v: number[] = [];
    for (let k = 0; k < dark.length; k += Math.max(1, Math.floor(dark.length / 4000))) v.push(d[(dark[k] as number) * 4 + ch] ?? 0);
    v.sort((a, b) => a - b);
    return v[v.length >> 1] ?? 0;
  };
  const fill = [pick(0), pick(1), pick(2)];
  // The flames and a 2 px rim round them, inside the opening.
  const paint = new Uint8Array(W * H);
  for (const p of warm) {
    const x = p % W;
    const y = (p - x) / W;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const q = (y + dy) * W + (x + dx);
        if (inBox(x + dx, y + dy) && region[q] === 1) paint[q] = 1;
      }
    }
  }
  const out = g.createImageData(W, H);
  const o = out.data;
  for (let p = 0; p < W * H; p++) {
    if (paint[p] === 0) continue;
    o[p * 4] = fill[0] ?? 0;
    o[p * 4 + 1] = fill[1] ?? 0;
    o[p * 4 + 2] = fill[2] ?? 0;
    o[p * 4 + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  return c;
}

/** A ring of runes (각인) in an outlined band: ink line under a white one, tinted violet. */
export function runeRing(size = 256): HTMLCanvasElement {
  const { c, g } = canvas(size, size);
  const r = size / 2;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const strokes = (width: number, colour: string) => {
    g.strokeStyle = colour;
    g.lineWidth = width;
    g.beginPath();
    g.arc(r, r, r * 0.86, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(r, r, r * 0.62, 0, Math.PI * 2);
    g.stroke();
    // Runes between the rings: short strokes, a different shape each.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const cx = r + Math.cos(a) * r * 0.74;
      const cy = r + Math.sin(a) * r * 0.74;
      const s = size * 0.045;
      g.save();
      g.translate(cx, cy);
      g.rotate(a + Math.PI / 2);
      g.beginPath();
      g.moveTo(0, -s);
      g.lineTo(0, s);
      if (i % 3 === 0) {
        g.moveTo(0, -s);
        g.lineTo(s * 0.8, -s * 0.2);
      } else if (i % 3 === 1) {
        g.moveTo(-s * 0.7, -s * 0.4);
        g.lineTo(s * 0.7, s * 0.4);
      } else {
        g.moveTo(0, 0);
        g.lineTo(-s * 0.7, s * 0.6);
        g.moveTo(0, 0);
        g.lineTo(s * 0.7, s * 0.6);
      }
      g.stroke();
      g.restore();
    }
  };
  strokes(size * 0.05, INK_CSS);
  strokes(size * 0.022, '#ffffff');
  return c;
}

/** Jagged crack across a bar (ink with a white core, tinted): the stand-in when iron_cracked is missing. */
export function crack(w = 256, h = 80): HTMLCanvasElement {
  const { c, g } = canvas(w, h);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const path = [
    [0.3, 0.12],
    [0.42, 0.4],
    [0.36, 0.55],
    [0.5, 0.75],
    [0.46, 0.92],
  ];
  const draw = (width: number, colour: string) => {
    g.strokeStyle = colour;
    g.lineWidth = width;
    g.beginPath();
    path.forEach(([x, y], i) => (i === 0 ? g.moveTo((x as number) * w, (y as number) * h) : g.lineTo((x as number) * w, (y as number) * h)));
    g.stroke();
  };
  draw(h * 0.16, INK_CSS);
  draw(h * 0.05, '#ffffff');
  return c;
}

/** Flat wedges round the middle (white, tinted pale gold, shown faint): behind a 걸작 or a legendary weapon. */
export function sunburst(size = 256, count = 12): HTMLCanvasElement {
  const { c, g } = canvas(size, size);
  const r = size / 2;
  g.translate(r, r);
  g.fillStyle = '#ffffff';
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const half = Math.PI / count / 2;
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, r, a - half, a + half);
    g.closePath();
    g.fill();
  }
  return c;
}

/**
 * The hot bar's picture made tintable: every pixel's brightness over the bar's own (its fill turns
 * white, its dark line stays dark), so a tint paints the whole bar one flat colour by its heat.
 * Pixels brighter than the fill (its light stripe, the sparkles) clamp to white with it.
 */
export function tintable(source: CanvasImageSource, w: number, h: number, fill = 0.7): HTMLCanvasElement {
  const { c, g } = canvas(w, h);
  g.drawImage(source, 0, 0, w, h);
  const img = g.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = (0.3 * (d[i] ?? 0) + 0.59 * (d[i + 1] ?? 0) + 0.11 * (d[i + 2] ?? 0)) / 255;
    const v = Math.round(Math.min(1, lum / fill) * 255);
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
  }
  g.putImageData(img, 0, 0);
  return c;
}

// ---------- Scene stand-ins ----------
// Drawn the same way as the pictures they stand in for: flat colours under the fat INK line, no
// gradients, no glow. They show only when a picture fails to load.

/** Stand-in colours: the doodle palette (app.css --dd-*) and the pictures' own flat fills. */
const STAND = {
  wall: '#cbbba6',
  stone: '#d8c9b4',
  wood: '#876045',
  beam: '#9a6a45',
  iron: '#8e8984',
  ironLight: '#b3aea8',
  stump: '#b07a4a',
  stumpTop: '#cf9a66',
  leather: '#a8703e',
  water: '#8ec8ee',
  shirt: '#f6ebd5',
  apron: '#8a5a3a',
  skin: '#f6d3b8',
  hair: '#b9b6b2',
  boots: '#6f4c35',
  gold: '#f3d36a',
  orb: '#f2a65a',
} as const;

/** Fill a path with a colour under the ink line (the line drawn first, twice as wide, so the fill keeps its size). */
function flat(g: CanvasRenderingContext2D, path: () => void, fill: string, line: number): void {
  g.lineJoin = 'round';
  g.lineCap = 'round';
  path();
  g.strokeStyle = INK_CSS;
  g.lineWidth = line * 2;
  g.stroke();
  g.fillStyle = fill;
  g.fill();
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Stone wall over a plain wooden floor that meets it at SCENE_PLACE.floor of the height, as bg_workshop. */
export function background(w = 600, h = 400): HTMLCanvasElement {
  const { c, g } = canvas(w, h);
  const floorY = h * SCENE_PLACE.floor;
  g.fillStyle = STAND.wall;
  g.fillRect(0, 0, w, floorY);
  // Stones: rounded blocks with an ink line, every other row offset by half a block.
  const rowH = floorY / 5;
  const blockW = w / 7;
  for (let row = 0; row < 5; row++) {
    const off = row % 2 === 0 ? 0 : blockW / 2;
    for (let x = -off; x < w; x += blockW) {
      flat(g, () => roundRect(g, x + 4, row * rowH + 4, blockW - 8, rowH - 8, 8), STAND.stone, 1.5);
    }
  }
  // Two posts and a beam.
  for (const x of [w * 0.32, w * 0.66]) flat(g, () => roundRect(g, x, -4, w * 0.035, floorY + 4, 3), STAND.beam, 2);
  flat(g, () => roundRect(g, -4, h * 0.06, w + 8, h * 0.035, 3), STAND.beam, 2);
  // The floor, its line along the wall.
  g.fillStyle = STAND.wood;
  g.fillRect(0, floorY, w, h - floorY);
  g.strokeStyle = INK_CSS;
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(0, floorY);
  g.lineTo(w, floorY);
  g.stroke();
  return c;
}

/** Anvil on a stump; the flat face matches PROP_ART.anvil.face. */
export function anvil(w = 320, h = 280): HTMLCanvasElement {
  const { c, g } = canvas(w, h);
  const line = w * 0.018;
  const faceY = PROP_ART.anvil.face.y * h + line;
  const faceX = PROP_ART.anvil.face.x * w;
  const faceW = PROP_ART.anvil.faceW * w;
  const stumpTop = h * 0.56;
  flat(
    g,
    () => {
      g.beginPath();
      g.moveTo(w * 0.24, stumpTop);
      g.lineTo(w * 0.84, stumpTop);
      g.lineTo(w * 0.86, h - line * 1.5);
      g.lineTo(w * 0.22, h - line * 1.5);
      g.closePath();
    },
    STAND.stump,
    line,
  );
  flat(
    g,
    () => {
      g.beginPath();
      g.ellipse(w * 0.54, stumpTop, w * 0.3, h * 0.045, 0, 0, Math.PI * 2);
    },
    STAND.stumpTop,
    line,
  );
  const left = faceX - faceW / 2;
  const right = faceX + faceW / 2;
  flat(
    g,
    () => {
      g.beginPath();
      g.moveTo(left, faceY);
      g.lineTo(right, faceY);
      g.lineTo(right, faceY + h * 0.12);
      g.lineTo(right - faceW * 0.16, faceY + h * 0.16);
      g.lineTo(right - faceW * 0.1, stumpTop - h * 0.02);
      g.lineTo(left + faceW * 0.04, stumpTop - h * 0.02);
      g.lineTo(left + faceW * 0.12, faceY + h * 0.16);
      g.lineTo(left - faceW * 0.1, faceY + h * 0.12);
      // The horn, to the left.
      g.quadraticCurveTo(left - faceW * 0.4, faceY + h * 0.06, w * 0.05, faceY + h * 0.02);
      g.quadraticCurveTo(left - faceW * 0.3, faceY, left, faceY);
      g.closePath();
    },
    STAND.iron,
    line,
  );
  return c;
}

/** Stone furnace with a chimney; its opening is drawn empty and dark round PROP_ART.furnace.flame, where the scene draws the fire. */
export function furnace(w = 260, h = 330): HTMLCanvasElement {
  const { c, g } = canvas(w, h);
  const line = w * 0.02;
  const top = PROP_ART.furnace.top * h + line;
  const fl = PROP_ART.furnace.flame;
  flat(g, () => roundRect(g, w * 0.58, top, w * 0.24, h * 0.36, w * 0.04), STAND.iron, line);
  flat(
    g,
    () => {
      g.beginPath();
      g.moveTo(w * 0.08, h - line * 1.5);
      g.lineTo(w * 0.08, h * 0.5);
      g.quadraticCurveTo(w * 0.1, h * 0.3, w * 0.5, h * 0.29);
      g.quadraticCurveTo(w * 0.9, h * 0.3, w * 0.92, h * 0.5);
      g.lineTo(w * 0.92, h - line * 1.5);
      g.closePath();
    },
    STAND.stone,
    line,
  );
  // The opening: an arch round where the flame stands.
  const mw = fl.w * w * 1.5;
  const mx = fl.x * w;
  const base = fl.y * h + line;
  const mTop = base - fl.h * h * 1.3;
  flat(
    g,
    () => {
      g.beginPath();
      g.moveTo(mx - mw / 2, base);
      g.lineTo(mx - mw / 2, mTop + mw / 2);
      g.arc(mx, mTop + mw / 2, mw / 2, Math.PI, 0);
      g.lineTo(mx + mw / 2, base);
      g.closePath();
    },
    INK_CSS,
    line,
  );
  return c;
}

/** Bellows; the nozzle at PROP_ART.bellows.nozzle points right. */
export function bellows(w = 280, h = 200): HTMLCanvasElement {
  const { c, g } = canvas(w, h);
  const line = w * 0.02;
  const nx = PROP_ART.bellows.nozzle.x * w - line;
  const ny = PROP_ART.bellows.nozzle.y * h;
  flat(
    g,
    () => {
      g.beginPath();
      g.moveTo(w * 0.7, ny - h * 0.06);
      g.lineTo(nx, ny - h * 0.02);
      g.lineTo(nx, ny + h * 0.03);
      g.lineTo(w * 0.7, ny + h * 0.07);
      g.closePath();
    },
    STAND.iron,
    line,
  );
  flat(
    g,
    () => {
      g.beginPath();
      g.moveTo(w * 0.16, h * 0.28);
      g.quadraticCurveTo(w * 0.45, h * 0.12, w * 0.72, ny - h * 0.04);
      g.lineTo(w * 0.72, ny + h * 0.06);
      g.quadraticCurveTo(w * 0.45, h * 0.88, w * 0.16, h * 0.72);
      g.quadraticCurveTo(w * 0.08, h * 0.5, w * 0.16, h * 0.28);
      g.closePath();
    },
    STAND.leather,
    line,
  );
  flat(g, () => roundRect(g, w * 0.03, h * 0.42, w * 0.16, h * 0.16, h * 0.08), STAND.beam, line);
  return c;
}

/** Wooden tub with water at PROP_ART.quench.water. */
export function quench(w = 250, h = 200): HTMLCanvasElement {
  const { c, g } = canvas(w, h);
  const line = w * 0.02;
  const wy = PROP_ART.quench.water.y * h;
  flat(
    g,
    () => {
      g.beginPath();
      g.moveTo(w * 0.1, wy);
      g.lineTo(w * 0.9, wy);
      g.lineTo(w * 0.84, h - line * 1.5);
      g.lineTo(w * 0.16, h - line * 1.5);
      g.closePath();
    },
    STAND.stump,
    line,
  );
  for (const y of [wy + h * 0.22, h * 0.78]) flat(g, () => roundRect(g, w * 0.12, y, w * 0.76, h * 0.06, 3), STAND.iron, line * 0.7);
  flat(
    g,
    () => {
      g.beginPath();
      g.ellipse(w * 0.5, wy, w * 0.4, h * 0.07, 0, 0, Math.PI * 2);
    },
    STAND.water,
    line,
  );
  return c;
}

/** Hot bar, white under an ink line so the tint gives its colour; the bar fills PROP_ART.iron.bar. */
export function ironBar(w = 320, h = 130): HTMLCanvasElement {
  const { c, g } = canvas(w, h);
  const bar = PROP_ART.iron.bar;
  const line = h * 0.05;
  const x = bar.x0 * w + line;
  const y = bar.y0 * h + line;
  const bw = (bar.x1 - bar.x0) * w - line * 2;
  const bh = (bar.y1 - bar.y0) * h - line * 2;
  inked(g, () => roundRect(g, x, y, bw, bh, bh * 0.3), line);
  return c;
}

/** A plain finished weapon lying flat, tip to the right (when its picture is missing). */
export function weapon(type: WeaponType, w = 360, h = 120): HTMLCanvasElement {
  const { c, g } = canvas(w, h);
  const line = h * 0.035;
  const cy = h / 2;
  const blade = (x0: number, x1: number, half: number) =>
    flat(
      g,
      () => {
        g.beginPath();
        g.moveTo(x0, cy - half);
        g.lineTo(x1 - half * 2, cy - half);
        g.quadraticCurveTo(x1, cy - half * 0.4, x1, cy);
        g.quadraticCurveTo(x1, cy + half * 0.4, x1 - half * 2, cy + half);
        g.lineTo(x0, cy + half);
        g.closePath();
      },
      STAND.ironLight,
      line,
    );
  const hilt = (x: number, guardH: number, gripW: number) => {
    flat(g, () => roundRect(g, x - gripW, cy - h * 0.06, gripW, h * 0.12, h * 0.04), STAND.apron, line);
    flat(
      g,
      () => {
        g.beginPath();
        g.arc(x - gripW - h * 0.05, cy, h * 0.08, 0, Math.PI * 2);
      },
      STAND.gold,
      line,
    );
    flat(g, () => roundRect(g, x - w * 0.02, cy - guardH / 2, w * 0.04, guardH, w * 0.015), STAND.gold, line);
  };
  switch (type) {
    case 'oneHandSword':
      blade(w * 0.3, w * 0.95, h * 0.09);
      hilt(w * 0.3, h * 0.42, w * 0.15);
      break;
    case 'greatsword':
      blade(w * 0.26, w * 0.96, h * 0.13);
      hilt(w * 0.26, h * 0.56, w * 0.18);
      break;
    case 'dagger':
      blade(w * 0.42, w * 0.84, h * 0.09);
      hilt(w * 0.42, h * 0.32, w * 0.12);
      break;
    case 'staff':
      flat(g, () => roundRect(g, w * 0.05, cy - h * 0.06, w * 0.76, h * 0.12, h * 0.06), STAND.beam, line);
      flat(
        g,
        () => {
          g.beginPath();
          g.arc(w * 0.87, cy, h * 0.17, 0, Math.PI * 2);
        },
        STAND.orb,
        line,
      );
      break;
    case 'bow':
    case 'crossbow': {
      const limb = () => {
        g.beginPath();
        if (type === 'bow') {
          g.moveTo(w * 0.1, h * 0.15);
          g.quadraticCurveTo(w * 0.5, h * 0.95, w * 0.9, h * 0.15);
        } else {
          g.moveTo(w * 0.7, h * 0.1);
          g.quadraticCurveTo(w * 0.78, cy, w * 0.7, h * 0.9);
        }
      };
      if (type === 'crossbow') flat(g, () => roundRect(g, w * 0.08, cy - h * 0.06, w * 0.8, h * 0.12, h * 0.05), STAND.beam, line);
      // The limb: an ink stroke with its colour inside.
      g.lineCap = 'round';
      limb();
      g.strokeStyle = INK_CSS;
      g.lineWidth = h * 0.12;
      g.stroke();
      limb();
      g.strokeStyle = type === 'bow' ? STAND.beam : STAND.ironLight;
      g.lineWidth = h * 0.12 - line * 2;
      g.stroke();
      g.strokeStyle = INK_CSS;
      g.lineWidth = line;
      g.beginPath();
      if (type === 'bow') {
        g.moveTo(w * 0.1, h * 0.15);
        g.lineTo(w * 0.9, h * 0.15);
      } else {
        g.moveTo(w * 0.7, h * 0.1);
        g.lineTo(w * 0.6, cy);
        g.lineTo(w * 0.7, h * 0.9);
      }
      g.stroke();
      break;
    }
  }
  return c;
}

/**
 * A stand-in dwarf: boots, shirt and apron, a round head in a big grey beard, a hammer whose place
 * depends on the pose (slump: head down, eyes shut, the hammer hanging by his boots). Foot and head
 * match what the scene expects of a stand-in (foot y 0.985, head y 0.02).
 */
export function dwarf(pose: DwarfPose, w = 220, h = 300): HTMLCanvasElement {
  const { c, g } = canvas(w, h);
  const line = w * 0.018;
  const foot = h * 0.985;
  const head = h * 0.02;
  const bodyH = foot - head;
  const cx = w * 0.46;
  const y = (f: number) => head + f * bodyH;
  const sag = pose === 'slump' ? 0.05 : 0;
  // Boots.
  for (const x of [cx - w * 0.17, cx + w * 0.03]) flat(g, () => roundRect(g, x, y(0.88), w * 0.15, y(1) - y(0.88) - line, w * 0.04), STAND.boots, line);
  // Body: shirt, apron.
  flat(g, () => roundRect(g, cx - w * 0.22, y(0.34 + sag), w * 0.44, y(0.9) - y(0.34 + sag), w * 0.12), STAND.shirt, line);
  flat(g, () => roundRect(g, cx - w * 0.15, y(0.44 + sag), w * 0.3, y(0.88) - y(0.44 + sag), w * 0.05), STAND.apron, line);
  // Arm and hammer.
  const shoulder = { x: cx + w * 0.12, y: y(0.42 + sag) };
  const hand =
    pose === 'raise' || pose === 'cheer'
      ? { x: cx + w * 0.16, y: y(0.08) }
      : pose === 'strike'
        ? { x: cx + w * 0.4, y: y(0.52) }
        : pose === 'work'
          ? { x: cx + w * 0.36, y: y(0.5) }
          : pose === 'slump'
            ? { x: cx + w * 0.26, y: y(0.8) }
            : { x: cx + w * 0.3, y: y(0.62) };
  g.lineCap = 'round';
  g.strokeStyle = INK_CSS;
  g.lineWidth = w * 0.09;
  g.beginPath();
  g.moveTo(shoulder.x, shoulder.y);
  g.lineTo(hand.x, hand.y);
  g.stroke();
  g.strokeStyle = STAND.shirt;
  g.lineWidth = w * 0.09 - line * 2;
  g.stroke();
  const up = pose === 'raise' || pose === 'cheer';
  const hx = up ? hand.x : hand.x + w * 0.04;
  const hy = up ? hand.y - h * 0.07 : pose === 'slump' ? hand.y + h * 0.08 : hand.y + h * 0.02;
  flat(g, () => roundRect(g, hx - w * 0.06, hy - w * 0.045, w * 0.12, w * 0.09, w * 0.02), STAND.iron, line);
  // Head, hair and the big beard over the chest.
  const hcx = cx + w * 0.06;
  const hcy = y(0.16 + sag);
  flat(
    g,
    () => {
      g.beginPath();
      g.arc(hcx - w * 0.02, hcy - w * 0.02, w * 0.2, Math.PI * 0.95, Math.PI * 2.05);
      g.closePath();
    },
    STAND.hair,
    line,
  );
  flat(
    g,
    () => {
      g.beginPath();
      g.arc(hcx + w * 0.04, hcy + w * 0.02, w * 0.14, 0, Math.PI * 2);
    },
    STAND.skin,
    line,
  );
  flat(
    g,
    () => {
      g.beginPath();
      g.ellipse(hcx + w * 0.02, y(0.36 + sag), w * 0.2, bodyH * 0.17, 0, 0, Math.PI * 2);
    },
    STAND.hair,
    line,
  );
  // Eyes: dots, or little shut arcs (glad when he cheers, tired when he slumps).
  g.fillStyle = INK_CSS;
  g.strokeStyle = INK_CSS;
  g.lineWidth = line;
  for (const ex of [hcx + w * 0.06, hcx + w * 0.13]) {
    g.beginPath();
    if (pose === 'cheer') {
      g.arc(ex, hcy + w * 0.01, w * 0.025, Math.PI, 0);
      g.stroke();
    } else if (pose === 'slump') {
      g.arc(ex, hcy + w * 0.02, w * 0.025, 0, Math.PI);
      g.stroke();
    } else {
      g.arc(ex, hcy, w * 0.018, 0, Math.PI * 2);
      g.fill();
    }
  }
  return c;
}
