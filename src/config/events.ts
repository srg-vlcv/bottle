/**
 * Событие дня: награда выпадает случайно (но одинаково для всех игроков в этот день), а сложность подстраивается под её ценность:
 * только монеты — лёгкий уровень, щедрая награда — больше бутылок и лимит ходов (игрок узнаёт о нём заранее).
 */
export const EVENT = {
  coins: { min: 50, max: 300 }, // монеты — всегда
  coinValueDivisor: 250,
  /** Независимые броски: chance — вероятность, min..max — количество, value — «ценность» за штуку. */
  extras: {
    extraBottle: { chance: 0.25, min: 1, max: 3, value: 0.9 },
    hint: { chance: 0.2, min: 1, max: 3, value: 0.7 },
    undo: { chance: 0.45, min: 1, max: 2, value: 0.4 },
    rare: { chance: 0.15, min: 1, max: 4, value: 1.0 },
  },
  /** По возрастанию minValue. Минимум бутылок в событии — 7. limitFactor — лимит ходов = ceil(par × factor). */
  tiers: [
    { minValue: 0, colors: 5, empties: 2, limitFactor: null as number | null },
    { minValue: 1.4, colors: 7, empties: 2, limitFactor: null as number | null },
    { minValue: 2.6, colors: 9, empties: 2, limitFactor: 2.4 as number | null },
    { minValue: 4.2, colors: 11, empties: 2, limitFactor: 1.9 as number | null },
  ],
} as const;
