// The battle's sound, speed and fighter sizes (platform/audio.ts; the speed and the sizes the 크기
// panel tried are per-device settings through platform/storage.ts). Sounds are the synthesised
// stand-ins until the ElevenLabs files arrive (tools/art/README.md): a blow, a crit, a heal, never
// more often than the ear can tell apart.

import { sound } from '../../platform/audio.ts';
import { webStore } from '../../platform/storage.ts';
import { clampFighterSize, FIGHTER_SIZE, type FighterSize } from '../../render/battle/layout.ts';
import type { Cue } from '../../render/battle/timeline.ts';

/** Playback speeds the button cycles through. The battle itself is the same at any speed. */
export const BATTLE_SPEEDS = [1, 2, 4] as const;
export type BattleSpeed = (typeof BATTLE_SPEEDS)[number];
const SPEED_KEY = 'pref.battleSpeed';

export async function loadSpeed(): Promise<BattleSpeed> {
  const v = Number(await webStore.load(SPEED_KEY));
  return (BATTLE_SPEEDS as readonly number[]).includes(v) ? (v as BattleSpeed) : 1;
}

export function saveSpeed(s: BattleSpeed): void {
  void webStore.save(SPEED_KEY, String(s));
}

export function nextSpeed(s: BattleSpeed): BattleSpeed {
  return BATTLE_SPEEDS[(BATTLE_SPEEDS.indexOf(s) + 1) % BATTLE_SPEEDS.length] as BattleSpeed;
}

/** Sounds for the cues, spaced (ms) so a flurry is a patter, not a roar. */
const GAP = { strike: 70, crit: 90, heal: 220 } as const;

export function makeCueSound(now: () => number = () => performance.now()) {
  const last = { strike: -1e9, crit: -1e9, heal: -1e9 };
  return (c: Cue) => {
    let intent: 'strike' | 'crit' | 'heal' | null = null;
    if (c.kind === 'impact') intent = c.crit ? 'crit' : 'strike';
    else if (c.kind === 'heal') intent = 'heal';
    if (intent === null) return;
    const t = now();
    if (t - last[intent] < GAP[intent]) return;
    last[intent] = t;
    sound.play(intent);
  };
}

const SIZE_KEY = 'pref.battleSize';

/** The fighters' sizes this device tried in the 크기 panel (SizeLab), or the starting ones. */
export async function loadFighterSize(): Promise<FighterSize> {
  try {
    const raw = await webStore.load(SIZE_KEY);
    return clampFighterSize(raw !== null ? (JSON.parse(raw) as Record<string, unknown>) : {});
  } catch {
    return FIGHTER_SIZE;
  }
}

export function saveFighterSize(s: FighterSize): void {
  void webStore.save(SIZE_KEY, JSON.stringify(s));
}
