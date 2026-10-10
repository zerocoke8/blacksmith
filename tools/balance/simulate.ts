// Runs one world for N days under a supply policy and keeps what the report needs.

import { DAY_MINUTES } from '../../src/sim/data/world.ts';
import { createPolicy, type MaterialRule, type PolicyId } from '../../src/sim/world/supply.ts';
import type { WorldEvent, WorldRules, WorldState } from '../../src/sim/world/types.ts';
import { advanceWorld, createWorld } from '../../src/sim/world/world.ts';

export interface RunConfig {
  seed: number;
  days: number;
  policy: PolicyId;
  material: MaterialRule;
  rules?: Partial<WorldRules>;
}

export interface DailySample {
  day: number;
  fame: number;
  fameStage: number;
  /** Best floor reached with our weapons, any tower. */
  shopRecord: number;
  /** Best floor reached by anyone, any weapon. */
  worldRecord: number;
  merchantBand: number;
  activeHeroes: number;
}

export interface RunResult {
  config: RunConfig;
  world: WorldState;
  events: WorldEvent[];
  daily: DailySample[];
}

export function simulate(config: RunConfig): RunResult {
  const world = createWorld(config.seed, config.rules ?? {});
  const policy = createPolicy(config.policy, config.material);
  const events: WorldEvent[] = [];
  const daily: DailySample[] = [];
  let worldRecord = 0;
  for (let day = 1; day <= config.days; day++) {
    const batch = advanceWorld(world, day * DAY_MINUTES, policy);
    for (const e of batch) {
      events.push(e);
      if (e.kind === 'record' && e.floor > worldRecord) worldRecord = e.floor;
    }
    daily.push({
      day,
      fame: world.fame,
      fameStage: world.fameStage,
      shopRecord: Math.max(...Object.values(world.shopRecord)),
      worldRecord,
      merchantBand: world.merchantBand,
      activeHeroes: world.heroes.length,
    });
  }
  return { config, world, events, daily };
}
