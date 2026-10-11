// Stand-ins drawn on a 2D canvas for scene pictures that have not arrived yet, and the small
// effect textures (soft dot, glow, shine line, rune ring, crack, rays). The scene turns each
// canvas into a texture. Shapes follow the anchors in layout.ts (anvil face, furnace mouth …),
// so a real picture can replace a stand-in without moving anything else.

import type { WeaponType } from '../../sim/core/types.ts';
import { type DwarfPose, PROP_ART } from './layout.ts';

function canvas(w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const g = c.getContext('2d');
  if (g === null) throw new Error('2d canvas unavailable');
  return { c, g };
}

// ---------- Effect textures ----------

/** White radial dot, soft edge (particles, glows). */
export function softDot(size = 64, hard = 0.15): HTMLCanvasElement {
  const { c, g } = canvas(size, size);
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(hard, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.28)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

/** Wide soft puff with a lumpy edge (steam, smoke). */
export function puff(size = 128): HTMLCanvasElement {
  const { c, g } = canvas(size, size);
  const r = size / 2;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const x = r + Math.cos(a) * r * 0.28;
    const y = r + Math.sin(a) * r * 0.22;
    const grad = g.createRadialGradient(x, y, 0, x, y, r * 0.62);
    grad.addColorStop(0, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  }
  return c;
}

/** Horizontal shine streak: a long soft ellipse, white in the middle. */
export function shineLine(w = 256, h = 24): HTMLCanvasElement {
  const { c, g } = canvas(w, h);
  g.save();
  g.translate(w / 2, h / 2);
  g.scale(w / 2, h / 2);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, 1);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.2, 'rgba(255,255,255,0.7)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(-1, -1, 2, 2);
  g.restore();
  return c;
}

/** A ring of runes (각인). */
export function runeRing(size = 256): HTMLCanvasElement {
  const { c, g } = canvas(size, size);
  const r = size / 2;
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.lineCap = 'round';
  g.lineWidth = size * 0.012;
  g.beginPath();
  g.arc(r, r, r * 0.9, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = size * 0.008;
  g.beginPath();
  g.arc(r, r, r * 0.66, 0, Math.PI * 2);
  g.stroke();
  // Runes between the rings: short strokes, a different shape each.
  g.lineWidth = size * 0.014;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const cx = r + Math.cos(a) * r * 0.78;
    const cy = r + Math.sin(a) * r * 0.78;
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
  // A star in the middle.
  g.lineWidth = size * 0.01;
  g.beginPath();
  for (let i = 0; i <= 5; i++) {
    const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
    const x = r + Math.cos(a) * r * 0.5;
    const y = r + Math.sin(a) * r * 0.5;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  return c;
}

/** Jagged crack across a bar (white; tinted when shown). */
export function crack(w = 256, h = 80): HTMLCanvasElement {
  const { c, g } = canvas(w, h);
  g.strokeStyle = 'rgba(255,255,255,1)';
  g.lineJoin = 'miter';
  g.lineCap = 'round';
  const path = [
    [0.08, 0.5],
    [0.2, 0.38],
    [0.3, 0.6],
    [0.42, 0.34],
    [0.5, 0.56],
    [0.6, 0.3],
    [0.7, 0.62],
    [0.8, 0.42],
    [0.92, 0.55],
  ];
  g.lineWidth = h * 0.08;
  g.beginPath();
  path.forEach(([x, y], i) => (i === 0 ? g.moveTo((x as number) * w, (y as number) * h) : g.lineTo((x as number) * w, (y as number) * h)));
  g.stroke();
  g.lineWidth = h * 0.04;
  g.beginPath();
  g.moveTo(0.42 * w, 0.34 * h);
  g.lineTo(0.46 * w, 0.1 * h);
  g.moveTo(0.6 * w, 0.3 * h);
  g.lineTo(0.66 * w, 0.12 * h);
  g.moveTo(0.3 * w, 0.6 * h);
  g.lineTo(0.27 * w, 0.88 * h);
  g.moveTo(0.7 * w, 0.62 * h);
  g.lineTo(0.75 * w, 0.9 * h);
  g.stroke();
  return c;
}

/** Soft rays from the middle (a finished masterpiece). */
export function rays(size = 256, count = 14): HTMLCanvasElement {
  const { c, g } = canvas(size, size);
  const r = size / 2;
  g.translate(r, r);
  for (let i = 0; i < count; i++) {
    g.rotate((Math.PI * 2) / count);
    const grad = g.createLinearGradient(0, 0, r, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(r, -r * 0.07);
    g.lineTo(r, r * 0.07);
    g.closePath();
    g.fill();
  }
  return c;
}

/** Dark edges (the scene sits in a warm, dim room). */
export function vignette(size = 256): HTMLCanvasElement {
  const { c, g } = canvas(size, size);
  const r = size / 2;
  const grad = g.createRadialGradient(r, r * 0.9, r * 0.35, r, r, r * 1.05);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(8,4,2,0.72)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

// ---------- Scene stand-ins ----------

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Stone wall, shelves of shadow, a warm floor, light from the right (the furnace). */
export function background(w = 600, h = 400): HTMLCanvasElement {
  const { c, g } = canvas(w, h);
  const wall = g.createLinearGradient(0, 0, 0, h);
  wall.addColorStop(0, '#1d1511');
  wall.addColorStop(0.68, '#33251c');
  wall.addColorStop(0.7, '#2a1d15');
  wall.addColorStop(1, '#3a2a1e');
  g.fillStyle = wall;
  g.fillRect(0, 0, w, h);
  // Stones.
  const rowH = h * 0.085;
  for (let row = 0; row * rowH < h * 0.68; row++) {
    const off = row % 2 === 0 ? 0 : w * 0.06;
    for (let x = -off; x < w; x += w * 0.12) {
      const shade = 34 + ((row * 7 + Math.round(x)) % 9);
      g.fillStyle = `rgb(${shade + 10},${shade},${shade - 6})`;
      roundRect(g, x + 2, row * rowH + 2, w * 0.12 - 4, rowH - 4, 4);
      g.fill();
    }
  }
  // Beams.
  g.fillStyle = '#21160f';
  g.fillRect(w * 0.31, 0, w * 0.035, h * 0.69);
  g.fillRect(w * 0.63, 0, w * 0.035, h * 0.69);
  g.fillRect(0, h * 0.08, w, h * 0.03);
  // Tools on the wall (dark shapes).
  g.fillStyle = 'rgba(20,14,10,0.85)';
  for (let i = 0; i < 6; i++) {
    const x = w * (0.38 + i * 0.035);
    g.fillRect(x, h * 0.15, w * 0.008, h * 0.2);
    g.fillRect(x - w * 0.008, h * 0.33, w * 0.024, h * 0.035);
  }
  // Floor stones.
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.moveTo(0, h * (0.74 + i * 0.05));
    g.lineTo(w, h * (0.73 + i * 0.055));
    g.stroke();
  }
  // Furnace light from the right, a cool window on the left.
  const warm = g.createRadialGradient(w * 0.88, h * 0.6, 0, w * 0.88, h * 0.6, w * 0.7);
  warm.addColorStop(0, 'rgba(255,140,50,0.38)');
  warm.addColorStop(1, 'rgba(255,140,50,0)');
  g.fillStyle = warm;
  g.fillRect(0, 0, w, h);
  const cool = g.createRadialGradient(w * 0.12, h * 0.15, 0, w * 0.12, h * 0.15, w * 0.25);
  cool.addColorStop(0, 'rgba(120,150,210,0.22)');
  cool.addColorStop(1, 'rgba(120,150,210,0)');
  g.fillStyle = cool;
  g.fillRect(0, 0, w, h);
  return c;
}

/** Anvil on a stump; the flat face matches PROP_ART.anvil.face. */
export function anvil(w = 320, h = 280): HTMLCanvasElement {
  const { c, g } = canvas(w, h);
  const faceY = PROP_ART.anvil.face.y * h;
  const faceX = PROP_ART.anvil.face.x * w;
  const faceW = PROP_ART.anvil.faceW * w;
  // Stump.
  const stumpTop = h * 0.52;
  const wood = g.createLinearGradient(w * 0.2, 0, w * 0.85, 0);
  wood.addColorStop(0, '#4a2f1b');
  wood.addColorStop(0.5, '#7a5230');
  wood.addColorStop(1, '#3d2616');
  g.fillStyle = wood;
  g.beginPath();
  g.moveTo(w * 0.24, stumpTop);
  g.lineTo(w * 0.82, stumpTop);
  g.lineTo(w * 0.88, h);
  g.lineTo(w * 0.18, h);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(30,18,10,0.6)';
  g.lineWidth = 2;
  for (let i = 1; i < 7; i++) {
    const x = w * (0.24 + i * 0.085);
    g.beginPath();
    g.moveTo(x, stumpTop + 4);
    g.lineTo(x + (i % 2 === 0 ? 4 : -3), h - 4);
    g.stroke();
  }
  g.fillStyle = '#8a6038';
  g.beginPath();
  g.ellipse(w * 0.53, stumpTop, w * 0.29, h * 0.035, 0, 0, Math.PI * 2);
  g.fill();
  // Anvil body.
  const iron = g.createLinearGradient(0, faceY, 0, stumpTop);
  iron.addColorStop(0, '#5d5a5e');
  iron.addColorStop(0.25, '#3b383c');
  iron.addColorStop(1, '#232024');
  g.fillStyle = iron;
  g.beginPath();
  const left = faceX - faceW / 2;
  const right = faceX + faceW / 2;
  g.moveTo(left, faceY);
  g.lineTo(right, faceY);
  g.lineTo(right, faceY + h * 0.11);
  g.lineTo(right - faceW * 0.12, faceY + h * 0.14);
  g.quadraticCurveTo(right - faceW * 0.22, faceY + h * 0.27, right - faceW * 0.08, stumpTop - h * 0.06);
  g.lineTo(right + faceW * 0.04, stumpTop);
  g.lineTo(left - faceW * 0.12, stumpTop);
  g.lineTo(left - faceW * 0.02, stumpTop - h * 0.06);
  g.quadraticCurveTo(left + faceW * 0.16, faceY + h * 0.27, left + faceW * 0.06, faceY + h * 0.14);
  g.lineTo(left - faceW * 0.1, faceY + h * 0.12);
  // Horn to the left.
  g.quadraticCurveTo(left - faceW * 0.42, faceY + h * 0.07, w * 0.04, faceY + h * 0.02);
  g.quadraticCurveTo(left - faceW * 0.3, faceY - h * 0.005, left, faceY);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  g.lineWidth = 2;
  g.stroke();
  // Face highlight (warm rim from the furnace on the right).
  g.fillStyle = 'rgba(255,200,150,0.35)';
  g.fillRect(left, faceY, faceW, h * 0.018);
  g.fillStyle = 'rgba(255,150,80,0.25)';
  g.fillRect(right - 4, faceY, 4, h * 0.11);
  return c;
}

/** Stone furnace: chimney on top, arched mouth at PROP_ART.furnace.mouth. */
export function furnace(w = 260, h = 330): HTMLCanvasElement {
  const { c, g } = canvas(w, h);
  const top = PROP_ART.furnace.top * h;
  const mouth = PROP_ART.furnace.mouth;
  // Chimney.
  g.fillStyle = '#3a2c24';
  g.fillRect(w * 0.36, top, w * 0.28, h * 0.3);
  g.fillStyle = '#4a382c';
  g.fillRect(w * 0.33, top, w * 0.34, h * 0.04);
  // Body (dome).
  const body = g.createLinearGradient(0, h * 0.3, w, h * 0.3);
  body.addColorStop(0, '#2c211b');
  body.addColorStop(0.5, '#4b3a2e');
  body.addColorStop(1, '#2a1f19');
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(w * 0.06, h);
  g.lineTo(w * 0.06, h * 0.48);
  g.quadraticCurveTo(w * 0.1, h * 0.28, w * 0.5, h * 0.27);
  g.quadraticCurveTo(w * 0.9, h * 0.28, w * 0.94, h * 0.48);
  g.lineTo(w * 0.94, h);
  g.closePath();
  g.fill();
  // Bricks.
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 2;
  for (let y = h * 0.36; y < h; y += h * 0.07) {
    g.beginPath();
    g.moveTo(w * 0.07, y);
    g.lineTo(w * 0.93, y);
    g.stroke();
  }
  // Mouth: dark arch with hot coals.
  const mx = mouth.x * w;
  const my = mouth.y * h;
  const mw = w * 0.46;
  const mh = h * 0.26;
  const hot = g.createRadialGradient(mx, my + mh * 0.25, 0, mx, my + mh * 0.25, mw * 0.6);
  hot.addColorStop(0, '#ffd27a');
  hot.addColorStop(0.35, '#ff7a2a');
  hot.addColorStop(1, '#3a0e04');
  g.fillStyle = hot;
  g.beginPath();
  g.moveTo(mx - mw / 2, my + mh / 2);
  g.lineTo(mx - mw / 2, my - mh * 0.1);
  g.quadraticCurveTo(mx, my - mh * 0.75, mx + mw / 2, my - mh * 0.1);
  g.lineTo(mx + mw / 2, my + mh / 2);
  g.closePath();
  g.fill();
  g.strokeStyle = '#1a120d';
  g.lineWidth = 5;
  g.stroke();
  // Ledge.
  g.fillStyle = '#56443a';
  g.fillRect(w * 0.18, my + mh / 2, w * 0.64, h * 0.035);
  return c;
}

/** Leather bellows; the nozzle at PROP_ART.bellows.nozzle points right. */
export function bellows(w = 280, h = 200): HTMLCanvasElement {
  const { c, g } = canvas(w, h);
  const nx = PROP_ART.bellows.nozzle.x * w;
  const ny = PROP_ART.bellows.nozzle.y * h;
  // Handles.
  g.fillStyle = '#5a3b22';
  g.fillRect(w * 0.02, h * 0.18, w * 0.2, h * 0.08);
  g.fillRect(w * 0.02, h * 0.68, w * 0.2, h * 0.08);
  // Boards.
  g.fillStyle = '#6e4a2a';
  g.beginPath();
  g.moveTo(w * 0.18, h * 0.14);
  g.lineTo(w * 0.72, ny - h * 0.06);
  g.lineTo(w * 0.72, ny);
  g.lineTo(w * 0.18, h * 0.3);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(w * 0.18, h * 0.86);
  g.lineTo(w * 0.72, ny + h * 0.08);
  g.lineTo(w * 0.72, ny + h * 0.02);
  g.lineTo(w * 0.18, h * 0.7);
  g.closePath();
  g.fill();
  // Leather folds.
  const leather = g.createLinearGradient(0, h * 0.3, 0, h * 0.7);
  leather.addColorStop(0, '#4a2c1a');
  leather.addColorStop(0.5, '#7a4b2c');
  leather.addColorStop(1, '#3e2414');
  g.fillStyle = leather;
  g.beginPath();
  g.moveTo(w * 0.2, h * 0.3);
  g.quadraticCurveTo(w * 0.42, h * 0.5, w * 0.7, ny);
  g.quadraticCurveTo(w * 0.42, h * 0.52, w * 0.2, h * 0.7);
  g.quadraticCurveTo(w * 0.1, h * 0.5, w * 0.2, h * 0.3);
  g.fill();
  // Nozzle.
  g.fillStyle = '#3a3438';
  g.beginPath();
  g.moveTo(w * 0.7, ny - h * 0.05);
  g.lineTo(nx, ny - h * 0.02);
  g.lineTo(nx, ny + h * 0.03);
  g.lineTo(w * 0.7, ny + h * 0.07);
  g.closePath();
  g.fill();
  return c;
}

/** Wooden quench tub with water at PROP_ART.quench.water. */
export function quench(w = 250, h = 200): HTMLCanvasElement {
  const { c, g } = canvas(w, h);
  const wy = PROP_ART.quench.water.y * h;
  const wood = g.createLinearGradient(0, 0, w, 0);
  wood.addColorStop(0, '#3e2817');
  wood.addColorStop(0.5, '#6a4626');
  wood.addColorStop(1, '#3a2414');
  g.fillStyle = wood;
  g.beginPath();
  g.moveTo(w * 0.08, wy);
  g.lineTo(w * 0.92, wy);
  g.lineTo(w * 0.86, h);
  g.lineTo(w * 0.14, h);
  g.closePath();
  g.fill();
  g.fillStyle = '#2a2a2e';
  g.fillRect(w * 0.1, wy + h * 0.2, w * 0.8, h * 0.06);
  g.fillRect(w * 0.12, h * 0.8, w * 0.76, h * 0.06);
  g.fillStyle = '#20384a';
  g.beginPath();
  g.ellipse(w * 0.5, wy, w * 0.42, h * 0.07, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(160,200,230,0.35)';
  g.beginPath();
  g.ellipse(w * 0.45, wy - h * 0.01, w * 0.2, h * 0.025, 0, 0, Math.PI * 2);
  g.fill();
  return c;
}

/** Hot bar, drawn near white so the sprite tint gives its colour. */
export function ironBar(w = 320, h = 100): HTMLCanvasElement {
  const { c, g } = canvas(w, h);
  const grad = g.createLinearGradient(0, h * 0.2, 0, h * 0.8);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.5, '#f2f2f2');
  grad.addColorStop(1, '#a8a8a8');
  g.fillStyle = grad;
  roundRect(g, w * 0.04, h * 0.3, w * 0.92, h * 0.42, h * 0.16);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.9)';
  roundRect(g, w * 0.12, h * 0.36, w * 0.62, h * 0.08, h * 0.04);
  g.fill();
  return c;
}

/** A plain finished weapon lying flat (when its picture is missing). */
export function weapon(type: WeaponType, w = 360, h = 120): HTMLCanvasElement {
  const { c, g } = canvas(w, h);
  const steel = g.createLinearGradient(0, h * 0.3, 0, h * 0.7);
  steel.addColorStop(0, '#f4f6fa');
  steel.addColorStop(0.5, '#b9c0cc');
  steel.addColorStop(1, '#6e7480');
  const leather = '#5a3a22';
  const brass = '#c89a4a';
  const cy = h / 2;
  const blade = (x0: number, x1: number, half: number) => {
    g.fillStyle = steel;
    g.beginPath();
    g.moveTo(x0, cy - half);
    g.lineTo(x1 - half * 2.2, cy - half);
    g.lineTo(x1, cy);
    g.lineTo(x1 - half * 2.2, cy + half);
    g.lineTo(x0, cy + half);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(60,60,70,0.6)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(x0, cy);
    g.lineTo(x1 - half * 2.4, cy);
    g.stroke();
  };
  const hilt = (x: number, guardH: number, gripW: number) => {
    g.fillStyle = brass;
    g.fillRect(x - w * 0.015, cy - guardH / 2, w * 0.03, guardH);
    g.fillStyle = leather;
    g.fillRect(x - gripW, cy - h * 0.05, gripW - w * 0.015, h * 0.1);
    g.fillStyle = brass;
    g.beginPath();
    g.arc(x - gripW - h * 0.04, cy, h * 0.07, 0, Math.PI * 2);
    g.fill();
  };
  switch (type) {
    case 'oneHandSword':
      blade(w * 0.3, w * 0.97, h * 0.075);
      hilt(w * 0.3, h * 0.42, w * 0.16);
      break;
    case 'greatsword':
      blade(w * 0.26, w * 0.98, h * 0.11);
      hilt(w * 0.26, h * 0.56, w * 0.2);
      break;
    case 'dagger':
      blade(w * 0.42, w * 0.86, h * 0.08);
      hilt(w * 0.42, h * 0.32, w * 0.12);
      break;
    case 'staff': {
      g.fillStyle = '#6a4626';
      g.fillRect(w * 0.04, cy - h * 0.045, w * 0.8, h * 0.09);
      const orb = g.createRadialGradient(w * 0.88, cy, 0, w * 0.88, cy, h * 0.18);
      orb.addColorStop(0, '#e8f6ff');
      orb.addColorStop(1, '#4a86c8');
      g.fillStyle = orb;
      g.beginPath();
      g.arc(w * 0.88, cy, h * 0.17, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = brass;
      g.fillRect(w * 0.8, cy - h * 0.07, w * 0.03, h * 0.14);
      break;
    }
    case 'bow':
    case 'crossbow': {
      g.strokeStyle = '#6a4626';
      g.lineWidth = h * 0.08;
      g.lineCap = 'round';
      g.beginPath();
      if (type === 'bow') {
        g.moveTo(w * 0.1, h * 0.1);
        g.quadraticCurveTo(w * 0.5, h * 0.95, w * 0.9, h * 0.1);
        g.stroke();
        g.strokeStyle = '#e8e0d0';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(w * 0.1, h * 0.1);
        g.lineTo(w * 0.9, h * 0.1);
      } else {
        g.moveTo(w * 0.1, cy);
        g.lineTo(w * 0.85, cy);
        g.stroke();
        g.strokeStyle = '#8a8f9a';
        g.lineWidth = h * 0.06;
        g.beginPath();
        g.moveTo(w * 0.7, h * 0.08);
        g.quadraticCurveTo(w * 0.76, cy, w * 0.7, h * 0.92);
      }
      g.stroke();
      break;
    }
  }
  return c;
}

/**
 * A stand-in dwarf: boots, apron, white beard, a hammer whose place depends on the pose.
 * Foot and head match DWARF_POSE_ART for the idle picture (foot y 0.985, head y 0.02).
 */
export function dwarf(pose: DwarfPose, w = 220, h = 300): HTMLCanvasElement {
  const { c, g } = canvas(w, h);
  const foot = h * 0.985;
  const head = h * 0.02;
  const bodyH = foot - head;
  const cx = w * 0.5;
  const y = (f: number) => head + f * bodyH;
  // Boots and legs.
  g.fillStyle = '#3a2416';
  g.fillRect(cx - w * 0.2, y(0.86), w * 0.16, y(1) - y(0.86));
  g.fillRect(cx + w * 0.04, y(0.86), w * 0.16, y(1) - y(0.86));
  g.fillStyle = '#3f4630';
  g.fillRect(cx - w * 0.17, y(0.68), w * 0.34, y(0.87) - y(0.68));
  // Body and apron.
  g.fillStyle = '#d9c7a6';
  roundRect(g, cx - w * 0.24, y(0.3), w * 0.48, y(0.72) - y(0.3), w * 0.08);
  g.fill();
  g.fillStyle = '#6a4228';
  roundRect(g, cx - w * 0.17, y(0.36), w * 0.36, y(0.82) - y(0.36), w * 0.04);
  g.fill();
  // Head, hair and beard.
  g.fillStyle = '#c99a78';
  g.beginPath();
  g.arc(cx + w * 0.04, y(0.14), w * 0.12, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#d8d6d2';
  g.beginPath();
  g.arc(cx - w * 0.02, y(0.1), w * 0.13, Math.PI, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(cx - w * 0.06, y(0.16));
  g.lineTo(cx + w * 0.18, y(0.16));
  g.lineTo(cx + w * 0.08, y(0.42));
  g.closePath();
  g.fill();
  // Arm and hammer.
  g.strokeStyle = '#c99a78';
  g.lineWidth = w * 0.08;
  g.lineCap = 'round';
  const shoulder = { x: cx + w * 0.05, y: y(0.36) };
  const hand =
    pose === 'raise' || pose === 'cheer'
      ? { x: cx + w * 0.02, y: y(0.02) }
      : pose === 'strike'
        ? { x: cx + w * 0.34, y: y(0.5) }
        : pose === 'work'
          ? { x: cx + w * 0.3, y: y(0.46) }
          : { x: cx + w * 0.16, y: y(0.6) };
  g.beginPath();
  g.moveTo(shoulder.x, shoulder.y);
  g.lineTo(hand.x, hand.y);
  g.stroke();
  g.strokeStyle = '#5a3a22';
  g.lineWidth = w * 0.035;
  const hx = pose === 'raise' || pose === 'cheer' ? hand.x + w * 0.02 : hand.x + w * 0.12;
  const hy = pose === 'raise' || pose === 'cheer' ? hand.y - h * 0.01 : hand.y + (pose === 'idle' ? h * 0.08 : 0);
  g.beginPath();
  g.moveTo(hand.x, hand.y);
  g.lineTo(hx, hy);
  g.stroke();
  g.fillStyle = '#6e6e76';
  g.fillRect(hx - w * 0.06, hy - w * 0.05, w * 0.12, w * 0.1);
  return c;
}
