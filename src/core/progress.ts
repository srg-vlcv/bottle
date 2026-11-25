/** Чистые функции прогресса: что открыто, что пройдено. progress: levelId -> звёзды (1..3). */
export type Progress = Readonly<Record<string, number>>;

export const isDone = (p: Progress, id: string): boolean => (p[id] ?? 0) > 0;

/** Уровень открыт, если он первый в списке или предыдущий пройден. */
export function isUnlocked(p: Progress, ids: readonly string[], index: number): boolean {
  return index <= 0 || isDone(p, ids[index - 1]!);
}

export const chapterDone = (p: Progress, ids: readonly string[]): boolean => ids.length > 0 && ids.every((id) => isDone(p, id));

export function firstUnfinishedIndex(p: Progress, ids: readonly string[]): number {
  const i = ids.findIndex((id) => !isDone(p, id));
  return i === -1 ? ids.length - 1 : i;
}

/** Сколько уровней категории свободной игры пройдено. */
export function freeDone(p: Progress, cat: string): number {
  const prefix = `free:${cat}:`;
  return Object.keys(p).filter((k) => k.startsWith(prefix) && isDone(p, k)).length;
}

export const totalStars = (p: Progress): number => Object.values(p).reduce((a, b) => a + b, 0);
