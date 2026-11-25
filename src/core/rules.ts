import type { Board, Bottle, Color, Move } from './types';

export interface Block { color: Color; count: number }

/** Верхний непрерывный блок одного цвета (null для пустой бутылки). */
export function topBlock(b: Bottle): Block | null {
  const n = b.layers.length;
  if (n === 0) return null;
  const color = b.layers[n - 1]!;
  let count = 1;
  while (count < n && b.layers[n - 1 - count] === color) count++;
  return { color, count };
}

export const freeSpace = (b: Bottle): number => b.cap - b.layers.length;
export const isEmpty = (b: Bottle): boolean => b.layers.length === 0;
export const isUniform = (b: Bottle): boolean => b.layers.every((c) => c === b.layers[0]);
export const isComplete = (b: Bottle): boolean => b.layers.length === b.cap && isUniform(b);

export function canPour(board: Board, from: number, to: number): boolean {
  if (from === to) return false;
  const src = board.bottles[from];
  const dst = board.bottles[to];
  if (!src || !dst) return false;
  if (src.locked || dst.locked) return false; // запечатанные бутылки недоступны
  const blk = topBlock(src);
  if (!blk || freeSpace(dst) === 0) return false;
  const dTop = topBlock(dst);
  return dTop === null || dTop.color === blk.color;
}

/** Применяет ход. Возвращает новую доску и запись хода, либо null, если ход недопустим. */
export function applyMove(board: Board, from: number, to: number): { board: Board; move: Move } | null {
  if (!canPour(board, from, to)) return null;
  const src = board.bottles[from]!;
  const dst = board.bottles[to]!;
  const blk = topBlock(src)!;
  const count = Math.min(blk.count, freeSpace(dst));
  const newLen = src.layers.length - count;
  // «?»: когда верхним становится скрытый слой — он открывается навсегда
  const prevHidden = src.hidden ?? 0;
  const hidden = Math.min(prevHidden, Math.max(0, newLen - 1));
  const bottles = board.bottles.slice();
  bottles[from] = { ...src, layers: src.layers.slice(0, newLen), ...(prevHidden > 0 ? { hidden } : {}) };
  bottles[to] = { ...dst, layers: dst.layers.concat(Array<Color>(count).fill(blk.color)) };
  // печати: собранная бутылка-ключ снимает печать навсегда
  const unlocked: number[] = [];
  for (let i = 0; i < bottles.length; i++) {
    const b = bottles[i]!;
    if (b.locked && b.lockedBy !== undefined && isComplete(bottles[b.lockedBy]!)) { bottles[i] = { ...b, locked: false }; unlocked.push(i); }
  }
  const move: Move = {
    from, to, color: blk.color, count,
    ...(hidden !== prevHidden ? { prevHidden } : {}),
    ...(unlocked.length ? { unlocked } : {}),
  };
  return { board: { bottles }, move };
}

/** Точный откат хода (переливание детерминировано, поэтому обратимо). */
export function undoMove(board: Board, m: Move): Board {
  const src = board.bottles[m.from]!;
  const dst = board.bottles[m.to]!;
  const bottles = board.bottles.slice();
  bottles[m.to] = { ...dst, layers: dst.layers.slice(0, dst.layers.length - m.count) };
  bottles[m.from] = { ...src, layers: src.layers.concat(Array<Color>(m.count).fill(m.color)), ...(m.prevHidden !== undefined ? { hidden: m.prevHidden } : {}) };
  for (const i of m.unlocked ?? []) bottles[i] = { ...bottles[i]!, locked: true }; // печать возвращается
  return { bottles };
}

/** Победа: каждая непустая бутылка полна и однотонна, и ни один цвет не разбросан по бутылкам. */
export function isWon(board: Board): boolean {
  const seen = new Set<Color>();
  for (const b of board.bottles) {
    if (isEmpty(b)) continue;
    if (!isComplete(b)) return false;
    const c = b.layers[0]!;
    if (seen.has(c)) return false;
    seen.add(c);
  }
  return true;
}

/** Все допустимые ходы (опционально без заведомо бессмысленных). */
export function legalMoves(board: Board, prune = true): Array<[number, number]> {
  const res: Array<[number, number]> = [];
  const bs = board.bottles;
  for (let i = 0; i < bs.length; i++) {
    const src = bs[i]!;
    if (isEmpty(src)) continue;
    if (prune && isComplete(src)) continue;
    for (let j = 0; j < bs.length; j++) {
      if (!canPour(board, i, j)) continue;
      // Однотонное -> в пустую такой же вместимости: то же состояние с точностью до перестановки.
      if (prune && isEmpty(bs[j]!) && isUniform(src) && bs[j]!.cap === src.cap) continue;
      res.push([i, j]);
    }
  }
  return res;
}

export function addBottle(board: Board, cap?: number): Board {
  const c = cap ?? Math.max(...board.bottles.map((b) => b.cap));
  return { bottles: board.bottles.concat({ cap: c, layers: [] }) };
}

export function boardFromRows(rows: number[][], cap: number): Board {
  return { bottles: rows.map((layers) => ({ cap, layers })) };
}

/**
 * Ключ состояния для солвера. Обычно инвариантен к перестановке бутылок одинаковой вместимости; если есть печати
 * (ссылки lockedBy на конкретные бутылки), симметрию использовать нельзя — ключ позиционный. «?» на ключ не влияет.
 */
export function boardKey(board: Board): string {
  if (board.bottles.some((b) => b.lockedBy !== undefined)) {
    return 'P' + board.bottles.map((b) => `${b.cap}:${b.layers.join('.')}${b.locked ? '!' : ''}`).join('|');
  }
  return board.bottles.map((b) => `${b.cap}:${b.layers.join('.')}`).sort().join('|');
}
