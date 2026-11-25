import { EVENT } from '../config/events';
import type { Reward } from '../config/shop';
import { createRng, type Rng } from './rng';
import type { LevelSpec } from './types';

export interface DailyEvent {
  day: number;
  rewards: Reward[];
  value: number;
  tier: number;
  spec: LevelSpec;
  seed: string;
  /** null — без лимита ходов. */
  limitFactor: number | null;
}

const int = (rng: Rng, a: number, b: number): number => a + Math.floor(rng() * (b - a + 1));

/** Бросок награды: монеты всегда + независимые шансы на бутылки/подсказки/отмены/кристаллы. */
export function rollEventRewards(rng: Rng): Reward[] {
  const out: Reward[] = [{ kind: 'coins', n: int(rng, EVENT.coins.min, EVENT.coins.max) }];
  const x = EVENT.extras;
  if (rng() < x.extraBottle.chance) out.push({ kind: 'bonus', id: 'extraBottle', n: int(rng, x.extraBottle.min, x.extraBottle.max) });
  if (rng() < x.hint.chance) out.push({ kind: 'bonus', id: 'hint', n: int(rng, x.hint.min, x.hint.max) });
  if (rng() < x.undo.chance) out.push({ kind: 'bonus', id: 'undo', n: int(rng, x.undo.min, x.undo.max) });
  if (rng() < x.rare.chance) out.push({ kind: 'rare', n: int(rng, x.rare.min, x.rare.max) });
  return out;
}

export function rewardValue(rewards: readonly Reward[]): number {
  let v = 0;
  for (const r of rewards) {
    if (r.kind === 'coins') v += r.n / EVENT.coinValueDivisor;
    else if (r.kind === 'rare') v += r.n * EVENT.extras.rare.value;
    else if (r.kind === 'bonus') v += r.n * EVENT.extras[r.id === 'extraBottle' ? 'extraBottle' : r.id].value;
  }
  return v;
}

export function tierFor(value: number): number {
  let t = 0;
  EVENT.tiers.forEach((x, i) => { if (value >= x.minValue) t = i; });
  return t;
}

/** Событие конкретного дня: одинаково у всех игроков (seed от номера дня). */
export function eventForDay(day: number): DailyEvent {
  const rewards = rollEventRewards(createRng(`event-reward:${day}`));
  const value = rewardValue(rewards);
  const tier = tierFor(value);
  const t = EVENT.tiers[tier]!;
  return { day, rewards, value, tier, spec: { colors: t.colors, empties: t.empties, capacity: 4 }, seed: `event:${day}`, limitFactor: t.limitFactor };
}

export const moveLimitFor = (par: number, factor: number | null): number | null => (factor === null ? null : Math.ceil(par * factor));
