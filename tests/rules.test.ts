import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyMove, boardFromRows, canPour, isWon, legalMoves, undoMove } from '../src/core/rules';
import { Game } from '../src/core/game';

test('переливается верхний блок одного цвета в пустую', () => {
  const b = boardFromRows([[0, 1, 1], []], 4);
  const r = applyMove(b, 0, 1)!;
  assert.deepEqual(r.board.bottles[0]!.layers, [0]);
  assert.deepEqual(r.board.bottles[1]!.layers, [1, 1]);
  assert.deepEqual(r.move, { from: 0, to: 1, color: 1, count: 2 });
});

test('на другой цвет нельзя, в полную нельзя, в себя нельзя', () => {
  const b = boardFromRows([[0, 1], [0, 0, 0, 0], [0, 2]], 4);
  assert.equal(canPour(b, 0, 2), false);
  assert.equal(canPour(b, 0, 1), false);
  assert.equal(canPour(b, 0, 0), false);
});

test('если места меньше блока — переливается сколько влезает', () => {
  const b = boardFromRows([[1, 0, 0, 0], [0, 0, 0]], 4);
  const r = applyMove(b, 0, 1)!;
  assert.equal(r.move.count, 1);
  assert.deepEqual(r.board.bottles[1]!.layers, [0, 0, 0, 0]);
  assert.deepEqual(r.board.bottles[0]!.layers, [1, 0, 0]);
});

test('undo — точный откат, в т.ч. частичного переливания', () => {
  const b = boardFromRows([[1, 0, 0, 0], [0, 0, 0], [], [1, 1, 1]], 4);
  let cur = b;
  const moves = [];
  for (const [f, t] of [[0, 1], [0, 2], [3, 0]] as const) {
    const r = applyMove(cur, f, t)!;
    cur = r.board; moves.push(r.move);
  }
  for (const m of moves.reverse()) cur = undoMove(cur, m);
  assert.deepEqual(cur, b);
});

test('победа: полные однотонные бутылки, цвет не разбросан', () => {
  assert.equal(isWon(boardFromRows([[0, 0, 0, 0], [1, 1, 1, 1], []], 4)), true);
  assert.equal(isWon(boardFromRows([[0, 0, 0], [0, 1, 1, 1]], 4)), false);
  assert.equal(isWon(boardFromRows([[0, 0, 0], [0], []], 4)), false);
});

test('Game: недопустимый ход не меняет состояние и не считается', () => {
  const g = new Game(boardFromRows([[0, 1], [0, 2], []], 4));
  assert.equal(g.tryMove(0, 1), 'invalid');
  assert.equal(g.moves, 0);
  assert.equal(g.tryMove(0, 2), 'ok');
  assert.equal(g.moves, 1);
  g.undo();
  assert.equal(g.moves, 0);
  assert.equal(g.undoUsed, 1);
});

test('Game: доп. бутылка ограничена лимитом, рестарт возвращает старт', () => {
  const start = boardFromRows([[0, 1], [1, 0], []], 4);
  const g = new Game(start);
  assert.equal(g.addExtraBottle(1), true);
  assert.equal(g.addExtraBottle(1), false);
  assert.equal(g.board.bottles.length, 4);
  g.tryMove(0, 3);
  g.restart();
  assert.deepEqual(g.board, start);
  assert.equal(g.moves, 0);
});

test('legalMoves не предлагает бессмысленное однотонное -> пустую', () => {
  const b = boardFromRows([[0, 0], []], 4);
  assert.equal(legalMoves(b).length, 0);
  assert.equal(legalMoves(b, false).length, 1);
});
