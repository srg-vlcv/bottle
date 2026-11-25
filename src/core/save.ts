import { BALANCE } from '../config/balance';

export const SAVE_VERSION = 1;

/** Незаконченный уровень: чтобы после выхода игрок продолжил с того же места. */
export interface Session { id: string; moves: Array<[number, number]>; extraAts: number[]; undo: number; hints: number }

export interface SaveV1 {
  version: 1;
  updatedAt: number;
  progress: Record<string, number>; // levelId -> звёзды (1..3); ключи 'ch1:l3', 'free:easy:12'
  coins: number;
  rare: number;
  bonuses: { undo: number; extraBottle: number; hint: number };
  themes: { owned: string[]; active: string };
  achievements: string[];
  stats: { pours: number; levelsWon: number; noUndoWins: number; adsWatched: number; chestsOpened: number; dailyClaims: number; eventsWon: number; hintsUsed: number };
  /** Событие дня: день (индекс суток), за который уже пройдено. */
  event: { day: number; done: boolean };
  adCooldown: { nextAvailableAt: number; lastKnownTime: number };
  daily: { streak: number; lastClaimDay: number };
  settings: { lang: 'ru' | 'en' | null; sound: boolean; music: boolean; colorblind: boolean; vibration: boolean };
  processedPurchases: string[]; // идемпотентность платежей
  lastLevel: string | null; // для кнопки «Продолжить»
  /** Время (мс) последнего начисления восстанавливаемого бонуса; 0 = таймер не запущен. */
  regen: { undo: number; hint: number };
  /** Ступень лестницы кулдаунов рекламы (0 = следующий кулдаун будет самым коротким). */
  adStep: number;
  seenDialogs: string[];
  chests: { wood: number; silver: number; gold: number };
  session: Session | null;
}

export type Save = SaveV1;

export function defaultSave(): Save {
  return {
    version: 1, updatedAt: 0, progress: {}, coins: 0, rare: 0,
    bonuses: { undo: BALANCE.bonuses.undo.start, extraBottle: BALANCE.bonuses.extraBottle.start, hint: BALANCE.bonuses.hint.start },
    themes: { owned: ['lab'], active: 'lab' },
    achievements: [], stats: { pours: 0, levelsWon: 0, noUndoWins: 0, adsWatched: 0, chestsOpened: 0, dailyClaims: 0, eventsWon: 0, hintsUsed: 0 },
    event: { day: -1, done: false },
    adCooldown: { nextAvailableAt: 0, lastKnownTime: 0 },
    daily: { streak: 0, lastClaimDay: -1 },
    settings: { lang: null, sound: true, music: true, colorblind: false, vibration: true },
    processedPurchases: [], lastLevel: null,
    regen: { undo: 0, hint: 0 }, adStep: 0, seenDialogs: [], chests: { wood: 0, silver: 0, gold: 0 }, session: null,
  };
}

type Raw = Record<string, any>;

/** Цепочка миграций: v0 (без поля version, плоский {coins, level}) -> v1. */
const MIGRATIONS: Array<(r: Raw) => Raw> = [
  (r) => {
    const out: Raw = { ...r, version: 1 };
    const lvl = typeof r.level === 'number' ? r.level : 0;
    out.progress = r.progress ?? Object.fromEntries(Array.from({ length: lvl }, (_, i) => [`ch1:l${i + 1}`, 1]));
    delete out.level;
    return out;
  },
];

export function migrate(raw: unknown): Save {
  const base = defaultSave();
  if (!raw || typeof raw !== 'object') return base;
  let r: Raw = raw as Raw;
  let v = typeof r.version === 'number' ? r.version : 0;
  if (v > SAVE_VERSION) v = SAVE_VERSION; // сохранение из будущего: читаем то, что понимаем
  for (; v < SAVE_VERSION; v++) r = MIGRATIONS[v]!(r);
  return {
    ...base, ...r,
    version: 1,
    bonuses: { ...base.bonuses, ...(r.bonuses ?? {}) },
    themes: { ...base.themes, ...(r.themes ?? {}) },
    stats: { ...base.stats, ...(r.stats ?? {}) },
    adCooldown: { ...base.adCooldown, ...(r.adCooldown ?? {}) },
    daily: { ...base.daily, ...(r.daily ?? {}) },
    settings: { ...base.settings, ...(r.settings ?? {}) },
    regen: { ...base.regen, ...(r.regen ?? {}) },
    chests: { ...base.chests, ...(r.chests ?? {}) },
    event: { ...base.event, ...(r.event ?? {}) },
  } as Save;
}

/** Слияние локального и облачного сохранений: прогресс не теряется, кулдаун не обнуляется. */
export function mergeSaves(a: Save, b: Save): Save {
  const [older, newer] = a.updatedAt <= b.updatedAt ? [a, b] : [b, a];
  const progress: Record<string, number> = { ...older.progress };
  for (const [k, s] of Object.entries(newer.progress)) progress[k] = Math.max(progress[k] ?? 0, s);
  return {
    ...newer,
    progress,
    themes: { owned: [...new Set([...older.themes.owned, ...newer.themes.owned])], active: newer.themes.active },
    achievements: [...new Set([...older.achievements, ...newer.achievements])],
    processedPurchases: [...new Set([...older.processedPurchases, ...newer.processedPurchases])],
    stats: Object.fromEntries(Object.keys(a.stats).map((k) => [k, Math.max((a.stats as Record<string, number>)[k] ?? 0, (b.stats as Record<string, number>)[k] ?? 0)])) as Save['stats'],
    event: a.event.day > b.event.day ? a.event : b.event.day > a.event.day ? b.event : { day: a.event.day, done: a.event.done || b.event.done },
    adCooldown: {
      nextAvailableAt: Math.max(a.adCooldown.nextAvailableAt, b.adCooldown.nextAvailableAt),
      lastKnownTime: Math.max(a.adCooldown.lastKnownTime, b.adCooldown.lastKnownTime),
    },
    daily: a.daily.lastClaimDay >= b.daily.lastClaimDay ? a.daily : b.daily,
    adStep: Math.max(a.adStep, b.adStep),
    session: newer.session ?? older.session,
    chests: { wood: Math.max(a.chests.wood, b.chests.wood), silver: Math.max(a.chests.silver, b.chests.silver), gold: Math.max(a.chests.gold, b.chests.gold) },
    seenDialogs: [...new Set([...older.seenDialogs, ...newer.seenDialogs])],
  };
}
