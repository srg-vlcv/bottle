import type { BonusId } from './balance';

export type ChestTier = 'wood' | 'silver' | 'gold';
export const CHEST_TIERS: readonly ChestTier[] = ['wood', 'silver', 'gold'];

export type Reward =
  | { kind: 'rare'; n: number }
  | { kind: 'coins'; n: number }
  | { kind: 'bonus'; id: BonusId; n: number }
  | { kind: 'chest'; tier: ChestTier; n: number }
  /** id = 'random' — случайная ещё не купленная тема (если все есть — вместо неё кристаллы). */
  | { kind: 'theme'; id: string };

export interface LootEntry { weight: number; reward: Reward }

/**
 * Сундуки. Шансы показываются игроку в окне сундука (считаются из этих же весов).
 * rolls — сколько предметов выпадает из одного сундука (каждый — независимый бросок по таблице).
 * Темы/косметика появятся в таблицах вместе с самими темами (этап Ж).
 */
export const CHESTS: Record<ChestTier, { priceRare: number; rolls: number; loot: readonly LootEntry[] }> = {
  wood: {
    priceRare: 5, rolls: 1,
    loot: [
      { weight: 45, reward: { kind: 'coins', n: 40 } }, { weight: 20, reward: { kind: 'coins', n: 100 } },
      { weight: 14, reward: { kind: 'bonus', id: 'undo', n: 2 } }, { weight: 12, reward: { kind: 'bonus', id: 'hint', n: 1 } },
      { weight: 7, reward: { kind: 'bonus', id: 'extraBottle', n: 1 } }, { weight: 2, reward: { kind: 'rare', n: 3 } },
    ],
  },
  silver: {
    priceRare: 15, rolls: 2,
    loot: [
      { weight: 30, reward: { kind: 'coins', n: 120 } }, { weight: 3, reward: { kind: 'coins', n: 300 } },
      { weight: 18, reward: { kind: 'bonus', id: 'undo', n: 3 } }, { weight: 18, reward: { kind: 'bonus', id: 'hint', n: 2 } },
      { weight: 16, reward: { kind: 'bonus', id: 'extraBottle', n: 1 } },
      { weight: 10, reward: { kind: 'rare', n: 5 } }, { weight: 5, reward: { kind: 'rare', n: 10 } },
      { weight: 4, reward: { kind: 'theme', id: 'random' } },
    ],
  },
  gold: {
    priceRare: 40, rolls: 3,
    loot: [
      { weight: 22, reward: { kind: 'coins', n: 300 } }, { weight: 22, reward: { kind: 'bonus', id: 'extraBottle', n: 2 } },
      { weight: 16, reward: { kind: 'bonus', id: 'hint', n: 3 } }, { weight: 14, reward: { kind: 'bonus', id: 'undo', n: 5 } },
      { weight: 14, reward: { kind: 'rare', n: 10 } }, { weight: 9, reward: { kind: 'rare', n: 25 } }, { weight: 3, reward: { kind: 'rare', n: 60 } },
      { weight: 8, reward: { kind: 'theme', id: 'random' } },
    ],
  },
};

/** Если выпала «случайная тема», а все темы уже есть — выдаём столько кристаллов. */
export const THEME_FALLBACK_RARE = 20;

/** Цена бонуса в мягкой валюте (бутылка за монеты не продаётся). */
export const COIN_PRICES: Partial<Record<BonusId, number>> = { undo: 40, hint: 80 };

export interface Product {
  /** id товара в консоли разработчика Яндекс Игр (consumable). */
  id: string;
  title: { ru: string; en: string };
  desc: { ru: string; en: string };
  rewards: readonly Reward[];
  /** Рекомендуемая цена в ЯН (реальная задаётся в консоли; игра берёт её из каталога SDK). */
  suggestedPriceYan: number;
}

export const PRODUCTS: readonly Product[] = [
  { id: 'rare_50', title: { ru: '50 кристаллов', en: '50 crystals' }, desc: { ru: 'Горсть редких кристаллов', en: 'A handful of rare crystals' }, rewards: [{ kind: 'rare', n: 50 }], suggestedPriceYan: 30 },
  { id: 'rare_150', title: { ru: '150 кристаллов', en: '150 crystals' }, desc: { ru: 'Мешочек кристаллов', en: 'A pouch of crystals' }, rewards: [{ kind: 'rare', n: 150 }], suggestedPriceYan: 80 },
  { id: 'rare_500', title: { ru: '500 кристаллов', en: '500 crystals' }, desc: { ru: 'Сундук кристаллов', en: 'A chest of crystals' }, rewards: [{ kind: 'rare', n: 500 }], suggestedPriceYan: 230 },
  { id: 'chests_wood_5', title: { ru: '5 деревянных сундуков', en: '5 wooden chests' }, desc: { ru: 'Пять деревянных сундуков', en: 'Five wooden chests' }, rewards: [{ kind: 'chest', tier: 'wood', n: 5 }], suggestedPriceYan: 40 },
  { id: 'chests_silver_3', title: { ru: '3 серебряных сундука', en: '3 silver chests' }, desc: { ru: 'Три серебряных сундука', en: 'Three silver chests' }, rewards: [{ kind: 'chest', tier: 'silver', n: 3 }], suggestedPriceYan: 90 },
  { id: 'chests_gold_1', title: { ru: 'Золотой сундук', en: 'Golden chest' }, desc: { ru: 'Золотой сундук и 10 кристаллов', en: 'A golden chest and 10 crystals' }, rewards: [{ kind: 'chest', tier: 'gold', n: 1 }, { kind: 'rare', n: 10 }], suggestedPriceYan: 100 },
];
