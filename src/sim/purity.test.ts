// Guards the rule that src/sim is pure, deterministic TypeScript (CLAUDE.md):
// no UI or rendering imports, no device clock, no unseeded randomness, no browser globals.
// That is what lets the same code run on a server later and replay identically.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SIM_DIR = fileURLToPath(new URL('.', import.meta.url));

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listSourceFiles(full));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const FORBIDDEN: { pattern: RegExp; why: string }[] = [
  { pattern: /from\s+['"](react|react-dom|pixi\.js)['"/]/, why: 'UI/render library import' },
  { pattern: /from\s+['"][./]*\.\.\/(ui|render|platform)\//, why: 'import from ui/render/platform' },
  { pattern: /from\s+['"]node:/, why: 'Node-only import' },
  { pattern: /\bDate\.now\s*\(|\bnew\s+Date\s*\(/, why: 'reads the device clock' },
  { pattern: /\bMath\.random\s*\(/, why: 'unseeded randomness (use core/rng.ts)' },
  { pattern: /\b(window|document|localStorage|sessionStorage|navigator)\./, why: 'browser global' },
  { pattern: /\b(setTimeout|setInterval|requestAnimationFrame)\s*\(/, why: 'real-time scheduling' },
];

describe('src/sim purity', () => {
  const files = listSourceFiles(SIM_DIR);

  it('has source files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(relative(SIM_DIR, file), () => {
      const text = readFileSync(file, 'utf8');
      const violations = FORBIDDEN.filter(({ pattern }) => pattern.test(text)).map(({ why }) => why);
      expect(violations).toEqual([]);
    });
  }
});
