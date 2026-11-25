import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/core/game';
import { generateLevel } from '../src/core/generator';
import { createRng } from '../src/core/rng';
import { applyMove, boardFromRows, isComplete, isWon, legalMoves, undoMove } from '../src/core/rules';
import { segmentsOf } from '../src/core/segments';
import { restoreGame, sessionOf } from '../src/core/session';
import { solve } from '../src/core/solver';
import type { Board } from '../src/core/types';

const withProps = (b: Board, patch: Record<number, Record<string, unknown>>): Board => ({
  bottles: b.bottles.map((x, i) => (patch[i] ? { ...x, ...patch[i] } : x)),
});

// ---------- «?» скрытые слои ----------
test('«?»: слой открывается, когда становится верхним; откат прячет его обратно', () => {
  let b = boardFromRows([[0, 1, 2], [], [2]], 4);
  b = withProps(b, { 0: { hidden: 2 } });               // скрыты слои 0 и 1, виден верхний (2)
  const r1 = applyMove(b, 0, 2)!;                       // 2 переливается в бутылку с 2
  assert.equal(r1.board.bottles[0]!.hidden, 1);         // открылся слой «1»
  assert.equal(r1.move.prevHidden, 2);
  const r2 = applyMove(r1.board, 0, 1)!;                // «1» уходит в пустую -> открывается слой «0»
  assert.equal(r2.board.bottles[0]!.hidden, 0);
  assert.deepEqual(undoMove(undoMove(r2.board, r2.move), r1.move), b);
});

test('«?»: скрытые слои не склеиваются с видимыми той же краски', () => {
  const b = withProps(boardFromRows([[3, 3, 3]], 4), { 0: { hidden: 2 } });
  const segs = segmentsOf(b.bottles[0]!);
  assert.equal(segs.length, 3);
  assert.deepEqual(segs.map((s) => !!s.hidden), [true, true, false]);
});

test('«?»: ход «на тот же цвет» не раскрывает лишнего', () => {
  const b = withProps(boardFromRows([[0, 1], [1], []], 4), { 0: { hidden: 1 } });
  assert.equal(applyMove(b, 2, 0), null);               // из пустой нельзя
  const m = applyMove(b, 1, 0)!;
  assert.equal(m.board.bottles[0]!.hidden, 1);
  assert.equal(m.move.prevHidden, undefined);
});

// ---------- печати ----------
test('печать: запечатанная бутылка недоступна, пока не собран ключ; снятие печати откатывается', () => {
  let b = boardFromRows([[1, 1, 1], [0, 2], [1], []], 4);
  b = withProps(b, { 1: { locked: true, lockedBy: 0 } });
  assert.equal(applyMove(b, 1, 3), null);               // из запечатанной нельзя
  assert.equal(applyMove(b, 2, 1), null);               // в запечатанную нельзя
  const r = applyMove(b, 2, 0)!;                        // ключ собран -> печать снята
  assert.ok(isComplete(r.board.bottles[0]!));
  assert.equal(r.board.bottles[1]!.locked, false);
  assert.deepEqual(r.move.unlocked, [1]);
  assert.ok(applyMove(r.board, 1, 3));                  // теперь можно
  assert.deepEqual(undoMove(r.board, r.move), b);       // откат возвращает печать
});

test('печать: сгенерированный уровень разрешим, решение приводит к победе', () => {
  const lvl = generateLevel({ colors: 4, empties: 2, capacity: 4, sealed: 1 }, 'seal:t1');
  assert.ok(lvl.board.bottles.some((x) => x.locked));
  const r = solve(lvl.board, { weight: 2, maxNodes: 300_000 });
  assert.equal(r.status, 'solved');
  let cur = lvl.board;
  for (const m of r.moves) cur = applyMove(cur, m.from, m.to)!.board;
  assert.equal(isWon(cur), true);
});

// ---------- разная вместимость ----------
test('разная вместимость: каждый цвет — ровно caps[c] слоёв; решение приводит к победе', () => {
  const caps = [2, 3, 4, 5];
  const lvl = generateLevel({ colors: 4, empties: 2, capacity: 5, caps }, 'caps:t1');
  const count = new Map<number, number>();
  for (const b of lvl.board.bottles) for (const c of b.layers) count.set(c, (count.get(c) ?? 0) + 1);
  caps.forEach((n, c) => assert.equal(count.get(c), n));
  assert.deepEqual(lvl.board.bottles.slice(0, 4).map((b) => b.cap), caps);
  const r = solve(lvl.board, { weight: 2, maxNodes: 300_000 });
  assert.equal(r.status, 'solved');
  let cur = lvl.board;
  for (const m of r.moves) cur = applyMove(cur, m.from, m.to)!.board;
  assert.equal(isWon(cur), true);
});

// ---------- общее ----------
test('генератор детерминирован и для механик; скрытые слои — все, кроме верхнего', () => {
  const spec = { colors: 5, empties: 2, capacity: 4, hidden: 3, sealed: 1 };
  assert.deepEqual(generateLevel(spec, 'det:1').board, generateLevel(spec, 'det:1').board);
  const lvl = generateLevel({ colors: 5, empties: 2, capacity: 4, hidden: 3 }, 'hid:t1');
  const hid = lvl.board.bottles.filter((b) => (b.hidden ?? 0) > 0);
  assert.equal(hid.length, 3);
  for (const b of hid) assert.equal(b.hidden, b.layers.length - 1);
});

test('фазз: случайная игра с механиками — откат до старта даёт стартовую доску, сессия восстанавливается точно', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const lvl = generateLevel({ colors: 5, empties: 2, capacity: 4, hidden: 2, sealed: seed % 2 }, `fuzz:${seed}`);
    const g = new Game(lvl.board);
    const rng = createRng(seed);
    for (let i = 0; i < 40; i++) {
      const mv = legalMoves(g.board, false);
      if (rng() < 0.15 && g.history.length) { g.undo(); continue; }
      if (!mv.length) break;
      const [a, b] = mv[Math.floor(rng() * mv.length)]!;
      g.tryMove(a, b);
    }
    const r = restoreGame(lvl.board, JSON.parse(JSON.stringify(sessionOf('x', g))))!;
    assert.deepEqual(r.board, g.board, `seed ${seed}`);
    while (g.history.length) g.undo();
    assert.deepEqual(g.board, lvl.board, `seed ${seed}: откат до старта`);
  }
});
