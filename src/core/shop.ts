import { BALANCE, type BonusId } from '../config/balance';
import { CHESTS, COIN_PRICES, THEME_FALLBACK_RARE, type ChestTier, type Reward } from '../config/shop';
import { THEMES, getTheme } from '../content/themes';
import type { Rng } from './rng';
import type { Save } from './save';

/** Начисление одной награды (чистая функция). */
export function applyReward(save: Save, r: Reward): Save {
  switch (r.kind) {
    case 'rare': return { ...save, rare: save.rare + r.n };
    case 'coins': return { ...save, coins: save.coins + r.n };
    case 'bonus': return { ...save, bonuses: { ...save.bonuses, [r.id]: save.bonuses[r.id] + r.n } };
    case 'chest': return { ...save, chests: { ...save.chests, [r.tier]: save.chests[r.tier] + r.n } };
    case 'theme': return save.themes.owned.includes(r.id) ? save : { ...save, themes: { ...save.themes, owned: [...save.themes.owned, r.id] } };
  }
}
export const applyRewards = (save: Save, rs: readonly Reward[]): Save => rs.reduce(applyReward, save);

/** Шансы выпадения для окна сундука: p — вероятность одного броска. Считается из тех же весов, что и розыгрыш. */
export function chestOdds(tier: ChestTier): Array<{ reward: Reward; p: number }> {
  const loot = CHESTS[tier].loot;
  const total = loot.reduce((a, e) => a + e.weight, 0);
  return loot.map((e) => ({ reward: e.reward, p: e.weight / total }));
}

/** Розыгрыш сундука: rolls независимых бросков по таблице. */
export function rollChest(tier: ChestTier, rng: Rng): Reward[] {
  const { loot, rolls } = CHESTS[tier];
  const total = loot.reduce((a, e) => a + e.weight, 0);
  const out: Reward[] = [];
  for (let i = 0; i < rolls; i++) {
    let x = rng() * total;
    for (const e of loot) { x -= e.weight; if (x < 0) { out.push(e.reward); break; } }
    if (out.length === i) out.push(loot[loot.length - 1]!.reward); // страховка от округления
  }
  return out;
}

/** «Случайная тема» → конкретная ещё не купленная (разные выпадения в одном сундуке не повторяются); если все есть — кристаллы. */
export function resolveRewards(save: Save, rewards: readonly Reward[], rng: Rng): Reward[] {
  const taken = new Set(save.themes.owned);
  return rewards.map((r) => {
    if (r.kind !== 'theme' || r.id !== 'random') return r;
    const free = THEMES.filter((t) => t.priceRare > 0 && !taken.has(t.id));
    if (free.length === 0) return { kind: 'rare', n: THEME_FALLBACK_RARE };
    const pick = free[Math.floor(rng() * free.length)]!;
    taken.add(pick.id);
    return { kind: 'theme', id: pick.id };
  });
}

/** Открыть сундук из запаса: списать, разыграть, начислить. null — сундуков нет. */
export function openChest(save: Save, tier: ChestTier, rng: Rng): { save: Save; rewards: Reward[] } | null {
  if (save.chests[tier] <= 0) return null;
  const rewards = resolveRewards(save, rollChest(tier, rng), rng);
  const spent: Save = { ...save, chests: { ...save.chests, [tier]: save.chests[tier] - 1 } };
  return { save: applyRewards(spent, rewards), rewards };
}

export type BuyResult = 'ok' | 'not_enough_rare' | 'not_enough_coins' | 'unavailable';

/** Купить сундук за редкую валюту — он попадает в запас. */
export function buyChest(save: Save, tier: ChestTier): { save: Save; result: BuyResult } {
  const price = CHESTS[tier].priceRare;
  if (save.rare < price) return { save, result: 'not_enough_rare' };
  return { save: { ...save, rare: save.rare - price, chests: { ...save.chests, [tier]: save.chests[tier] + 1 } }, result: 'ok' };
}

export function buyBonusRare(save: Save, id: BonusId): { save: Save; result: BuyResult } {
  const price = BALANCE.bonuses[id].priceRare;
  if (save.rare < price) return { save, result: 'not_enough_rare' };
  return { save: { ...save, rare: save.rare - price, bonuses: { ...save.bonuses, [id]: save.bonuses[id] + 1 } }, result: 'ok' };
}

export function buyBonusCoins(save: Save, id: BonusId): { save: Save; result: BuyResult } {
  const price = COIN_PRICES[id];
  if (price === undefined) return { save, result: 'unavailable' };
  if (save.coins < price) return { save, result: 'not_enough_coins' };
  return { save: { ...save, coins: save.coins - price, bonuses: { ...save.bonuses, [id]: save.bonuses[id] + 1 } }, result: 'ok' };
}

const MAX_TOKENS = 200;

/** Начисление покупки ровно один раз по purchaseToken (идемпотентно). */
export function applyPurchase(save: Save, token: string, rewards: readonly Reward[]): { save: Save; applied: boolean } {
  if (save.processedPurchases.includes(token)) return { save, applied: false };
  const next = applyRewards(save, rewards);
  return { save: { ...next, processedPurchases: [...next.processedPurchases, token].slice(-MAX_TOKENS) }, applied: true };
}

/** Купить тему за кристаллы или монеты (косметика покупается и за мягкую валюту). */
export function buyTheme(save: Save, id: string, currency: 'rare' | 'coins'): { save: Save; result: BuyResult } {
  const theme = getTheme(id);
  if (theme.id !== id || save.themes.owned.includes(id)) return { save, result: 'unavailable' };
  const owned = [...save.themes.owned, id];
  if (currency === 'rare') {
    if (save.rare < theme.priceRare) return { save, result: 'not_enough_rare' };
    return { save: { ...save, rare: save.rare - theme.priceRare, themes: { ...save.themes, owned } }, result: 'ok' };
  }
  if (save.coins < theme.priceCoins) return { save, result: 'not_enough_coins' };
  return { save: { ...save, coins: save.coins - theme.priceCoins, themes: { ...save.themes, owned } }, result: 'ok' };
}

/** Применить купленную тему «в один тап». */
export function setActiveTheme(save: Save, id: string): Save {
  return save.themes.owned.includes(id) ? { ...save, themes: { ...save.themes, active: id } } : save;
}
