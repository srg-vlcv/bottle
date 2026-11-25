import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyMove, boardFromRows, isWon } from '../src/core/rules';
import { deadlockState, hint, solve } from '../src/core/solver';
import type { Board, Move } from '../src/core/types';

function replay(b: Board, moves: Move[]): Board {
  let cur = b;
  for (const m of moves) cur = applyMove(cur, m.from, m.to)!.board;
  return cur;
}

test('солвер находит оптимальное решение и оно действительно приводит к победе', () => {
  const b = boardFromRows([[0, 1, 0, 1], [1, 0, 1, 0], [], []], 4);
  const r = solve(b);
  assert.equal(r.status, 'solved');
  assert.equal(r.optimal, true);
  assert.equal(isWon(replay(b, r.moves)), true);
});

test('солвер доказывает неразрешимость', () => {
  // Две полные смешанные бутылки и ни одной свободной ёмкости: ходов нет.
  const b = boardFromRows([[0, 1, 0, 1], [1, 0, 1, 0]], 4);
  assert.equal(solve(b).status, 'unsolvable');
  assert.equal(deadlockState(b), 'deadlock');
});

test('подсказка — допустимый ход с текущей позиции', () => {
  const b = boardFromRows([[0, 1, 0, 1], [1, 0, 1, 0], [], []], 4);
  const m = hint(b)!;
  assert.ok(m);
  assert.ok(applyMove(b, m.from, m.to));
});

test('лимит узлов даёт status=limit, а не зависание', () => {
  const b = boardFromRows([[0, 1, 2, 3], [3, 2, 1, 0], [1, 3, 0, 2], [2, 0, 3, 1], [], []], 4);
  assert.equal(solve(b, { maxNodes: 3 }).status, 'limit');
});
