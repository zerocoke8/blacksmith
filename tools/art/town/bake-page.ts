// The bake's page (bake.ts opens it in headless Chrome through Vite's dev server): bakes the map,
// encodes each picture as WebP, hands it to bake.ts, and returns the manifest.

import { bakeMap } from './bake-map.ts';

declare global {
  interface Window {
    __bakeTown?: (quality: number) => Promise<{ manifest: unknown; ms: Record<string, number>; sizes: Record<string, number> }>;
  }
}

function encode(c: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b !== null ? resolve(b) : reject(new Error('could not encode'))), 'image/webp', quality));
}

window.__bakeTown = async (quality) => {
  const r = await bakeMap();
  const sizes: Record<string, number> = {};
  for (const [name, canvas] of r.canvases) {
    const blob = await encode(canvas, quality);
    const res = await fetch(`/__town-bake/out/${encodeURIComponent(name)}.webp`, { method: 'POST', body: blob });
    if (!res.ok) throw new Error(`could not hand over ${name}`);
    sizes[name] = blob.size;
  }
  return { manifest: r.manifest, ms: { ...r.ms }, sizes };
};
