import type { Reward } from '../config/shop';
import type { DailyEvent } from '../core/events';
import { freePlaySeed, freePlaySpec, type FreePlayCategory } from '../core/freeplay';
import { CHAPTERS, type LevelDef } from './chapters';

/** Уровень, который можно запустить: сюжетный или из свободной игры. */
export interface PlayLevel extends LevelDef {
  kind: 'chapter' | 'free' | 'event';
  chapterId?: number;
  cat?: FreePlayCategory;
  /** Номер внутри главы / категории (с 1). */
  num: number;
  /** Только для события дня: лимит ходов и награда за прохождение. */
  moveLimit?: number;
  rewards?: readonly Reward[];
}

export function chapterLevel(chapterId: number, index: number): PlayLevel | null {
  const ch = CHAPTERS.find((c) => c.id === chapterId);
  const def = ch?.levels[index];
  return ch && def ? { ...def, kind: 'chapter', chapterId, num: index + 1 } : null;
}

export function freeLevel(cat: FreePlayCategory, n: number): PlayLevel {
  return { id: `free:${cat}:${n}`, spec: freePlaySpec(cat, n), seed: freePlaySeed(cat, n), kind: 'free', cat, num: n };
}

export function eventLevel(ev: DailyEvent, moveLimit: number | null): PlayLevel {
  return { id: `event:${ev.day}`, spec: ev.spec, seed: ev.seed, kind: 'event', num: 0, rewards: ev.rewards, ...(moveLimit !== null ? { moveLimit } : {}) };
}

/** Следующий уровень после cur; null — глава закончилась (у события следующего нет). */
export function nextLevel(cur: PlayLevel): PlayLevel | null {
  if (cur.kind === 'event') return null;
  if (cur.kind === 'free') return freeLevel(cur.cat!, cur.num + 1);
  return chapterLevel(cur.chapterId!, cur.num);
}

export function findLevel(id: string): PlayLevel | null {
  const m = /^ch(\d+):l(\d+)$/.exec(id);
  if (m) return chapterLevel(Number(m[1]), Number(m[2]) - 1);
  const f = /^free:(easy|medium|hard|expert):(\d+)$/.exec(id);
  return f ? freeLevel(f[1] as FreePlayCategory, Number(f[2])) : null;
}

export const chapterLevelIds = (chapterId: number): string[] => CHAPTERS.find((c) => c.id === chapterId)?.levels.map((l) => l.id) ?? [];
