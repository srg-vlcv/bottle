import type { Reward } from '../config/shop';
import { chapterLevelIds } from '../content/levels';
import { chapterDone, freeDone } from './progress';
import type { Save } from './save';
import { applyRewards } from './shop';

export interface AchievementDef {
  id: string;
  title: { ru: string; en: string };
  desc: { ru: string; en: string };
  target: number;
  progress(s: Save): number;
  reward: readonly Reward[];
}

const threeStars = (s: Save): number => Object.values(s.progress).filter((v) => v === 3).length;
const coins = (n: number): Reward => ({ kind: 'coins', n });
const rare = (n: number): Reward => ({ kind: 'rare', n });
const bonus = (id: 'undo' | 'hint' | 'extraBottle', n: number): Reward => ({ kind: 'bonus', id, n });

/** 23 достижения; награда выдаётся автоматически в момент выполнения. */
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'first_win', title: { ru: 'Первый шаг', en: 'First Step' }, desc: { ru: 'Пройдите первый уровень', en: 'Complete your first level' }, target: 1, progress: (s) => s.stats.levelsWon, reward: [coins(10)] },
  { id: 'wins_10', title: { ru: 'Освоился', en: 'Getting the Hang of It' }, desc: { ru: 'Пройдите 10 уровней', en: 'Complete 10 levels' }, target: 10, progress: (s) => s.stats.levelsWon, reward: [coins(50)] },
  { id: 'wins_50', title: { ru: 'Опытный химик', en: 'Seasoned Chemist' }, desc: { ru: 'Пройдите 50 уровней', en: 'Complete 50 levels' }, target: 50, progress: (s) => s.stats.levelsWon, reward: [rare(3)] },
  { id: 'wins_200', title: { ru: 'Мастер лаборатории', en: 'Lab Master' }, desc: { ru: 'Пройдите 200 уровней', en: 'Complete 200 levels' }, target: 200, progress: (s) => s.stats.levelsWon, reward: [rare(10)] },
  { id: 'pours_100', title: { ru: 'Сто переливаний', en: 'A Hundred Pours' }, desc: { ru: 'Сделайте 100 переливаний', en: 'Make 100 pours' }, target: 100, progress: (s) => s.stats.pours, reward: [coins(50)] },
  { id: 'pours_1000', title: { ru: 'Неутомимый', en: 'Tireless' }, desc: { ru: 'Сделайте 1000 переливаний', en: 'Make 1000 pours' }, target: 1000, progress: (s) => s.stats.pours, reward: [bonus('extraBottle', 1)] },
  { id: 'star3_1', title: { ru: 'Идеально!', en: 'Perfect!' }, desc: { ru: 'Получите 3 звезды на уровне', en: 'Earn 3 stars on a level' }, target: 1, progress: threeStars, reward: [coins(30)] },
  { id: 'star3_25', title: { ru: 'Перфекционист', en: 'Perfectionist' }, desc: { ru: 'Получите 3 звезды на 25 уровнях', en: 'Earn 3 stars on 25 levels' }, target: 25, progress: threeStars, reward: [rare(5)] },
  { id: 'no_undo_10', title: { ru: 'Без права на ошибку', en: 'No Take-Backs' }, desc: { ru: 'Пройдите 10 уровней без отмены хода', en: 'Complete 10 levels without undo' }, target: 10, progress: (s) => s.stats.noUndoWins, reward: [bonus('hint', 2)] },
  { id: 'chapter_1', title: { ru: 'Первый день позади', en: 'Day One Done' }, desc: { ru: 'Пройдите Главу 1', en: 'Complete Chapter 1' }, target: 1, progress: (s) => (chapterDone(s.progress, chapterLevelIds(1)) ? 1 : 0), reward: [rare(5)] },
  { id: 'chapter_2', title: { ru: 'Тайна раскрыта', en: 'Mystery Unveiled' }, desc: { ru: 'Пройдите Главу 2', en: 'Complete Chapter 2' }, target: 1, progress: (s) => (chapterDone(s.progress, chapterLevelIds(2)) ? 1 : 0), reward: [rare(5)] },
  { id: 'chapter_3', title: { ru: 'Хранитель эссенций', en: 'Essence Keeper' }, desc: { ru: 'Пройдите Главу 3', en: 'Complete Chapter 3' }, target: 1, progress: (s) => (chapterDone(s.progress, chapterLevelIds(3)) ? 1 : 0), reward: [rare(8)] },
  { id: 'chapter_4', title: { ru: 'Спаситель наставника', en: "Mentor's Savior" }, desc: { ru: 'Пройдите Главу 4', en: 'Complete Chapter 4' }, target: 1, progress: (s) => (chapterDone(s.progress, chapterLevelIds(4)) ? 1 : 0), reward: [rare(12)] },
  { id: 'free_easy_10', title: { ru: 'Разминка', en: 'Warm-Up' }, desc: { ru: 'Пройдите 10 лёгких уровней свободной игры', en: 'Complete 10 Easy free-play levels' }, target: 10, progress: (s) => freeDone(s.progress, 'easy'), reward: [coins(80)] },
  { id: 'free_hard_5', title: { ru: 'Не боюсь сложного', en: 'Bring It On' }, desc: { ru: 'Пройдите 5 сложных уровней свободной игры', en: 'Complete 5 Hard free-play levels' }, target: 5, progress: (s) => freeDone(s.progress, 'hard'), reward: [rare(3)] },
  { id: 'free_expert_3', title: { ru: 'Эксперт', en: 'Expert' }, desc: { ru: 'Пройдите 3 уровня уровня «Эксперт»', en: 'Complete 3 Expert free-play levels' }, target: 3, progress: (s) => freeDone(s.progress, 'expert'), reward: [rare(5)] },
  { id: 'themes_3', title: { ru: 'Коллекционер', en: 'Collector' }, desc: { ru: 'Соберите 3 темы оформления', en: 'Own 3 themes' }, target: 3, progress: (s) => s.themes.owned.length, reward: [coins(100)] },
  { id: 'chests_5', title: { ru: 'Охотник за сокровищами', en: 'Treasure Hunter' }, desc: { ru: 'Откройте 5 сундуков', en: 'Open 5 chests' }, target: 5, progress: (s) => s.stats.chestsOpened, reward: [bonus('undo', 3)] },
  { id: 'ads_5', title: { ru: 'Помощь друзей', en: 'A Little Help' }, desc: { ru: 'Получите 5 бонусов за рекламу', en: 'Get 5 ad bonuses' }, target: 5, progress: (s) => s.stats.adsWatched, reward: [coins(50)] },
  { id: 'daily_7', title: { ru: 'Постоянный гость', en: 'Regular Guest' }, desc: { ru: 'Заберите ежедневную награду 7 раз', en: 'Claim the daily reward 7 times' }, target: 7, progress: (s) => s.stats.dailyClaims, reward: [rare(3)] },
  { id: 'streak_7', title: { ru: 'Неделя подряд', en: 'A Week Strong' }, desc: { ru: 'Серия ежедневных наград — 7 дней', en: 'Reach a 7-day daily streak' }, target: 7, progress: (s) => s.daily.streak, reward: [{ kind: 'chest', tier: 'silver', n: 1 }] },
  { id: 'event_3', title: { ru: 'Событийный', en: 'Event Fan' }, desc: { ru: 'Пройдите 3 события дня', en: 'Complete 3 daily events' }, target: 3, progress: (s) => s.stats.eventsWon, reward: [bonus('extraBottle', 2)] },
  { id: 'hints_10', title: { ru: 'С подсказкой веселее', en: 'Hint Lover' }, desc: { ru: 'Используйте 10 подсказок', en: 'Use 10 hints' }, target: 10, progress: (s) => s.stats.hintsUsed, reward: [coins(40)] },
];

const key = (id: string): string => `ach:${id}`;
export const isUnlocked = (s: Save, id: string): boolean => s.achievements.includes(key(id));

/** Выдаёт награды за все новые достижения (один раз каждое). */
export function grantAchievements(save: Save): { save: Save; unlocked: AchievementDef[] } {
  const unlocked: AchievementDef[] = [];
  let cur = save;
  for (const a of ACHIEVEMENTS) {
    if (isUnlocked(cur, a.id) || a.progress(cur) < a.target) continue;
    cur = applyRewards({ ...cur, achievements: [...cur.achievements, key(a.id)] }, a.reward);
    unlocked.push(a);
  }
  return { save: cur, unlocked };
}
