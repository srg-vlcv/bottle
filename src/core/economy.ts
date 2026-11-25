import { BALANCE, type BonusId } from '../config/balance';
import type { Save } from './save';

export type BuyResult = 'ok' | 'not_enough_rare';

/** Покупка бонуса за редкую валюту (чистая функция: возвращает новое сохранение). */
export function buyBonus(save: Save, id: BonusId): { save: Save; result: BuyResult } {
  const price = BALANCE.bonuses[id].priceRare;
  if (save.rare < price) return { save, result: 'not_enough_rare' };
  return { save: { ...save, rare: save.rare - price, bonuses: { ...save.bonuses, [id]: save.bonuses[id] + 1 } }, result: 'ok' };
}

/**
 * Трата одного бонуса из запаса; null, если запас пуст. Если запас был полным — запускаем таймер восстановления с этого момента.
 */
export function consumeBonus(save: Save, id: BonusId, now: number): Save | null {
  if (save.bonuses[id] <= 0) return null;
  let regen = save.regen;
  if (id !== 'extraBottle' && save.bonuses[id] >= BALANCE.bonuses[id].cap) regen = { ...regen, [id]: now };
  return { ...save, bonuses: { ...save.bonuses, [id]: save.bonuses[id] - 1 }, regen };
}

export function addBonus(save: Save, id: BonusId, n = 1): Save {
  return { ...save, bonuses: { ...save.bonuses, [id]: save.bonuses[id] + n } };
}

export function levelReward(stars: 1 | 2 | 3, doubled: boolean): number {
  return BALANCE.rewards.coinsPerLevel[stars] * (doubled ? 2 : 1);
}
