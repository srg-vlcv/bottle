import type { Board, Move } from './types';
import { applyMove, boardKey, isWon, legalMoves } from './rules';

export type SolveStatus = 'solved' | 'unsolvable' | 'limit';

export interface SolveResult {
  status: SolveStatus;
  moves: Move[];
  nodes: number;
  /** true, если weight === 1 и решение найдено (A* с допустимой эвристикой). */
  optimal: boolean;
}

export interface SolveOptions {
  /** Лимит раскрытых состояний. */
  maxNodes?: number;
  /** 1 = оптимально (A*), >1 = быстрее, но не обязательно кратчайший путь. */
  weight?: number;
}

interface Node {
  board: Board;
  g: number;
  h: number;
  f: number;
  parent: Node | null;
  move: Move | null;
}

/**
 * Допустимая эвристика: число блоков минус число цветов.
 * Один ход уменьшает число блоков максимум на 1 (слияние целого блока с блоком того же цвета).
 */
export function heuristic(board: Board): number {
  let blocks = 0;
  const colors = new Set<number>();
  for (const b of board.bottles) {
    let prev = -1;
    for (const c of b.layers) {
      colors.add(c);
      if (c !== prev) blocks++;
      prev = c;
    }
  }
  return blocks - colors.size;
}

class MinHeap {
  private a: Node[] = [];
  get size(): number { return this.a.length; }
  private less(x: Node, y: Node): boolean { return x.f < y.f || (x.f === y.f && x.h < y.h); }
  push(n: Node): void {
    const a = this.a;
    a.push(n);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(a[i]!, a[p]!)) break;
      [a[i], a[p]] = [a[p]!, a[i]!];
      i = p;
    }
  }
  pop(): Node | undefined {
    const a = this.a;
    if (a.length === 0) return undefined;
    const top = a[0]!;
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && this.less(a[l]!, a[m]!)) m = l;
        if (r < a.length && this.less(a[r]!, a[m]!)) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m]!, a[i]!];
        i = m;
      }
    }
    return top;
  }
}

export function solve(start: Board, opts: SolveOptions = {}): SolveResult {
  const maxNodes = opts.maxNodes ?? 200_000;
  const w = opts.weight ?? 1;
  const h0 = heuristic(start);
  const root: Node = { board: start, g: 0, h: h0, f: w * h0, parent: null, move: null };
  const open = new MinHeap();
  open.push(root);
  const best = new Map<string, number>([[boardKey(start), 0]]);
  let nodes = 0;

  while (open.size > 0) {
    const n = open.pop()!;
    if (isWon(n.board)) {
      const moves: Move[] = [];
      for (let c: Node | null = n; c && c.move; c = c.parent) moves.push(c.move);
      moves.reverse();
      return { status: 'solved', moves, nodes, optimal: w === 1 };
    }
    // Устаревшая запись очереди (к этому ключу уже нашли путь короче).
    if ((best.get(boardKey(n.board)) ?? Infinity) < n.g) continue;
    if (++nodes > maxNodes) return { status: 'limit', moves: [], nodes, optimal: false };

    for (const [i, j] of legalMoves(n.board)) {
      const r = applyMove(n.board, i, j)!;
      const key = boardKey(r.board);
      const g = n.g + 1;
      if ((best.get(key) ?? Infinity) <= g) continue;
      best.set(key, g);
      const h = heuristic(r.board);
      open.push({ board: r.board, g, h, f: g + w * h, parent: n, move: r.move });
    }
  }
  return { status: 'unsolvable', moves: [], nodes, optimal: false };
}

/** Следующий ход-подсказка с текущей позиции (быстрое взвешенное решение). */
export function hint(board: Board, maxNodes = 60_000): Move | null {
  const r = solve(board, { weight: 2.5, maxNodes });
  return r.status === 'solved' && r.moves.length > 0 ? r.moves[0]! : null;
}

/** Тупик: ходов нет вообще, либо солвер доказал неразрешимость. 'unknown' — не хватило лимита. */
export function deadlockState(board: Board, maxNodes = 40_000): 'ok' | 'deadlock' | 'unknown' {
  if (isWon(board)) return 'ok';
  const r = solve(board, { weight: 2.5, maxNodes });
  if (r.status === 'solved') return 'ok';
  return r.status === 'unsolvable' ? 'deadlock' : 'unknown';
}
