// 전투 동작의 규격과 좌표 움직임 (기획서 14장 연출, 사용자 결정 13): the six actions every fighter has —
// 대기·공격·스킬·피격·승리·필살기 — with the frame count, fps and anchor a sprite sheet for them must
// have, and the coordinate motion used while there is no sheet ('캐릭터가 좌표로 왔다갔다만 해도 된다').
// Pure numbers: anim.ts puts them on PixiJS; tools/art/README.md tells how a sheet is made.

/** The six actions (사용자 결정 13), plus 'down' (a fighter falls; no sheet, always the motion). */
export const ANIM_ACTIONS = ['idle', 'attack', 'skill', 'hit', 'victory', 'ultimate'] as const;
export type AnimAction = (typeof ANIM_ACTIONS)[number];
export type MotionAction = AnimAction | 'down';

export interface AnimSpec {
  /** Frames in the sheet (a horizontal strip of equal cells). */
  frames: number;
  fps: number;
  /** Loops while the action lasts (idle, victory); the others play once and go back to idle. */
  loop: boolean;
}

/**
 * 스프라이트 시트 규격 (tools/art/README.md): what Seedance → ffmpeg must deliver per action. The
 * one-shot actions' lengths (frames ÷ fps) are what the battle waits for: an attack's blow lands at
 * ATTACK_IMPACT_AT of it.
 */
export const ANIM_SPEC: Record<AnimAction, AnimSpec> = {
  idle: { frames: 8, fps: 8, loop: true },
  attack: { frames: 6, fps: 15, loop: false },
  skill: { frames: 8, fps: 14, loop: false },
  hit: { frames: 4, fps: 12, loop: false },
  victory: { frames: 8, fps: 10, loop: true },
  ultimate: { frames: 12, fps: 12, loop: false },
};

/**
 * Where a frame stands: its anchor in the cell (0..1), the feet's middle. Every cell of every sheet
 * uses the same one, as the still pictures do (tools/art: feet on the bottom line).
 */
export const ANIM_ANCHOR = { x: 0.5, y: 0.97 } as const;

/** Sheets are drawn facing left, like the stills; a hero (on the left, looking right) is mirrored. */
export const ANIM_DRAWN_FACING = 'left' as const;

/** How long a one-shot action lasts (ms, at speed 1). */
export function actionMs(action: AnimAction): number {
  const s = ANIM_SPEC[action];
  return Math.round((s.frames / s.fps) * 1000);
}

/** The share of an attack where the blow lands (the lunge's far point). */
export const ATTACK_IMPACT_AT = 0.45;

/** The motion's sizes (px at a fighter 100 px tall; anim.ts scales them by the fighter's height). */
export const MOTION = {
  breathMs: 1700,
  breath: 0.022,
  lunge: 34,
  recoil: 7,
  skillRise: 12,
  knock: 12,
  hop: 20,
  ultimateRise: 26,
  downMs: 520,
} as const;

/** One frame's offset from the fighter's place. dx is toward the foe (anim.ts turns it by facing). */
export interface MotionPose {
  dx: number;
  dy: number;
  sx: number;
  sy: number;
  rot: number;
  alpha: number;
  /** 0..1: how white the picture flashes (a hit). */
  flash: number;
}

export const REST_POSE: MotionPose = { dx: 0, dy: 0, sx: 1, sy: 1, rot: 0, alpha: 1, flash: 0 };

const clamp01 = (k: number) => Math.max(0, Math.min(1, k));

/**
 * The pose `t` ms into an action that lasts `dur` ms. `reach` is how far a melee lunge goes (px at
 * 100 px tall, toward the foe); a ranged attack only recoils. `time` is the scene clock (breathing).
 */
export function motionPose(action: MotionAction, t: number, dur: number, opts: { melee: boolean; time: number; phase?: number }): MotionPose {
  const k = dur > 0 ? clamp01(t / dur) : 1;
  const breath = Math.sin(((opts.time + (opts.phase ?? 0) * MOTION.breathMs) / MOTION.breathMs) * Math.PI * 2);
  switch (action) {
    case 'idle':
      return { ...REST_POSE, sy: 1 + MOTION.breath * breath, sx: 1 - MOTION.breath * 0.4 * breath };
    case 'attack': {
      if (!opts.melee) {
        // A ranged shot: a small kick back as it lets go.
        const r = k < ATTACK_IMPACT_AT * 0.6 ? 0 : Math.sin(((k - ATTACK_IMPACT_AT * 0.6) / (1 - ATTACK_IMPACT_AT * 0.6)) * Math.PI);
        return { ...REST_POSE, dx: -MOTION.recoil * r, sx: 1 - 0.04 * r, sy: 1 + 0.03 * r };
      }
      // Out fast to the far point at ATTACK_IMPACT_AT, back slower.
      const out = k < ATTACK_IMPACT_AT ? 1 - (1 - k / ATTACK_IMPACT_AT) ** 2 : 1 - ((k - ATTACK_IMPACT_AT) / (1 - ATTACK_IMPACT_AT)) ** 1.5;
      const lean = k < ATTACK_IMPACT_AT ? 0.12 * out : 0.12 * out;
      return { ...REST_POSE, dx: MOTION.lunge * out, dy: -4 * Math.sin(k * Math.PI), rot: lean, sx: 1 + 0.05 * out, sy: 1 - 0.04 * out };
    }
    case 'skill': {
      const up = Math.sin(k * Math.PI);
      const squash = k < 0.2 ? Math.sin((k / 0.2) * Math.PI) : 0;
      return { ...REST_POSE, dx: (opts.melee ? 10 : 0) * up, dy: -MOTION.skillRise * up, sx: 1 + 0.08 * up - 0.08 * squash, sy: 1 + 0.06 * up + 0.08 * squash };
    }
    case 'hit': {
      const back = (1 - k) ** 2;
      return { ...REST_POSE, dx: -MOTION.knock * Math.sin(Math.min(1, k * 3) * Math.PI * 0.5) * back * 1.6, rot: -0.08 * back, flash: clamp01(1 - k * 2.5), sx: 1 + 0.05 * back, sy: 1 - 0.05 * back };
    }
    case 'victory': {
      // Little hops, twice a second.
      const ph = ((opts.time + (opts.phase ?? 0) * 500) % 500) / 500;
      const hop = Math.abs(Math.sin(ph * Math.PI));
      return { ...REST_POSE, dy: -MOTION.hop * hop, sy: ph < 0.1 || ph > 0.9 ? 0.94 : 1.03, sx: ph < 0.1 || ph > 0.9 ? 1.05 : 0.98 };
    }
    case 'ultimate': {
      const crouch = k < 0.25 ? Math.sin((k / 0.25) * Math.PI * 0.5) : 1 - clamp01((k - 0.25) / 0.15);
      const rise = k < 0.25 ? 0 : Math.sin(clamp01((k - 0.25) / 0.75) * Math.PI);
      return {
        ...REST_POSE,
        dx: (opts.melee ? 24 : 6) * rise,
        dy: -MOTION.ultimateRise * rise,
        sx: 1 + 0.1 * crouch - 0.04 * rise,
        sy: 1 - 0.12 * crouch + 0.1 * rise,
        rot: 0.1 * Math.sin(rise * Math.PI * 2),
      };
    }
    case 'down': {
      return { ...REST_POSE, dx: -10 * k, dy: 6 * k, rot: -0.9 * k * k, alpha: 1 - k, sy: 1 - 0.2 * k };
    }
  }
}
