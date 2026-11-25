/** ВЕСЬ баланс игры — здесь. Менять числа можно, не трогая логику. */
const MIN = 60_000;

export const BALANCE = {
  bottleCapacity: 4,
  stars: { three: 1.15, two: 1.6 }, // множители к par (оптимуму солвера)
  bonuses: {
    // Отмена и подсказка — глобальный запас; сами восстанавливаются: полный запас за regenFullMs (по 1 штуке за regenFullMs/cap).
    undo: { priceRare: 1, start: 5, cap: 5, regenFullMs: 60 * MIN },
    hint: { priceRare: 2, start: 3, cap: 3, regenFullMs: 60 * MIN },
    // Бутылка — глобальный запас, сама НЕ восстанавливается: только реклама / редкая валюта.
    extraBottle: { priceRare: 3, start: 1, maxPerLevel: 1 },
    restart: { priceRare: 0 },
  },
  rewardedAd: {
    /** Что даёт кнопка «Бонус» внизу экрана. */
    reward: 'extraBottle' as 'undo' | 'hint' | 'extraBottle',
    /** Лестница ожидания ПОСЛЕ каждой просмотренной рекламы: 2 → 5 → 10 → 20 мин (дальше остаётся 20). */
    scheduleMs: [2 * MIN, 5 * MIN, 10 * MIN, 20 * MIN],
    /** null = лестница никогда не сбрасывается (вернулся — бонус уже готов). Число = сброс после такого простоя. */
    resetAfterMs: null as number | null,
    clockToleranceMs: 2000,
  },
  fullscreenAd: { minIntervalMs: 120_000, firstLevelAllowed: 8, everyNLevels: 3 },
  rewards: {
    coinsPerLevel: { 1: 10, 2: 15, 3: 20 } as Record<1 | 2 | 3, number>,
    chapterRare: 10,
  },
  daily: { cycle: [10, 20, 30, 40, 60, 80, 150] }, // монеты по дням серии (пока без сундука)
} as const;

export type BonusId = 'undo' | 'extraBottle' | 'hint';
