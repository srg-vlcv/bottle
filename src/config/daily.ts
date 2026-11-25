import type { Reward } from './shop';

/** Ежедневная награда: цикл из 7 дней, после 7-го снова с 1-го (серия продолжает считаться). */
export const DAILY_CYCLE: readonly (readonly Reward[])[] = [
  [{ kind: 'coins', n: 5 }],
  [{ kind: 'coins', n: 10 }],
  [{ kind: 'coins', n: 20 }, { kind: 'bonus', id: 'hint', n: 1 }],
  [{ kind: 'coins', n: 50 }, { kind: 'bonus', id: 'undo', n: 1 }],
  [{ kind: 'coins', n: 80 }, { kind: 'bonus', id: 'extraBottle', n: 1 }],
  [{ kind: 'coins', n: 120 }, { kind: 'bonus', id: 'hint', n: 1 }, { kind: 'bonus', id: 'undo', n: 1 }],
  [{ kind: 'coins', n: 150 }, { kind: 'chest', tier: 'silver', n: 1 }],
];

/** Сколько пропущенных дней серия «прощает» (1 = можно пропустить один день и не потерять серию). */
export const DAILY_GRACE_DAYS = 1;
