import type { LevelSpec } from './types';

export type FreePlayCategory = 'easy' | 'medium' | 'hard' | 'expert';

export const FREE_PLAY_RANGES: Record<FreePlayCategory, { min: number; max: number }> = {
  easy: { min: 5, max: 6 },
  medium: { min: 7, max: 9 },
  hard: { min: 10, max: 12 },
  expert: { min: 13, max: 20 },
};

/** Сколько уровней подряд держится одно число бутылок, прежде чем вырасти. */
export const LEVELS_PER_BOTTLE_STEP = 5;
export const MAX_COLORS = 12;

/** Спецификация n-го (с 1) уровня категории. Число бутылок = цвета + пустые. */
export function freePlaySpec(category: FreePlayCategory, n: number, capacity = 4): LevelSpec {
  const { min, max } = FREE_PLAY_RANGES[category];
  const bottles = Math.min(max, min + Math.floor((n - 1) / LEVELS_PER_BOTTLE_STEP));
  const colors = Math.min(MAX_COLORS, bottles - 2);
  return { colors, empties: bottles - colors, capacity };
}

export const freePlaySeed = (category: FreePlayCategory, n: number): string => `free:${category}:${n}`;
