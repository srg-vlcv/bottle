import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/core/game';
import { generateLevel } from '../src/core/generator';
import { createRng } from '../src/core/rng';
import { legalMoves } from '../src/core/rules';
import { defaultSave, mergeSaves, migrate } from '../src/core/save';
import { restoreGame, sessionOf } from '../src/core/session';

function randomPlay(g: Game, rng: () => number, steps: number): void {
  for (let i = 0; i < steps; i++) {
    const r = rng();
    if (r < 0.12 && g.history.length > 0) { g.undo(); continue; }
    if (r < 0.18) { g.addExtraBottle(1); continue; }
    const mv = legalMoves(g.board, false);
    if (mv.length === 0) break;
    const [a, b] = mv[Math.floor(rng() * mv.length)]!;
    g.tryMove(a, b);
  }
}

test('партия восстанавливается точно: доска, история, отмены (в т.ч. с доп. бутылкой и откатами)', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const lvl = generateLevel({ colors: 4, empties: 2, capacity: 4 }, `sess:${seed}`);
    const g = new Game(lvl.board);
    randomPlay(g, createRng(seed), 30);
    const r = restoreGame(lvl.board, JSON.parse(JSON.stringify(sessionOf('x', g))))!;
    assert.deepEqual(r.board, g.board, `seed ${seed}: доска`);
    assert.deepEqual(r.history, g.history, `seed ${seed}: история`);
    assert.equal(r.undoUsed, g.undoUsed);
    assert.deepEqual(r.extraAts, g.extraAts);
  }
});

test('отмена после доп. бутылки: бутылка остаётся, восстановление даёт ту же доску', () => {
  const lvl = generateLevel({ colors: 3, empties: 2, capacity: 4 }, 'sess:undo');
  const g = new Game(lvl.board);
  const mv = legalMoves(g.board, false);
  g.tryMove(mv[0]![0], mv[0]![1]); g.tryMove(...(legalMoves(g.board, false)[0]!));
  g.addExtraBottle(1);
  g.undo(); g.undo();
  assert.equal(g.board.bottles.length, lvl.board.bottles.length + 1);
  const r = restoreGame(lvl.board, sessionOf('x', g))!;
  assert.deepEqual(r.board, g.board);
});

test('неподходящая запись (чужая доска) не ломает игру', () => {
  const lvl = generateLevel({ colors: 3, empties: 2, capacity: 4 }, 'sess:bad');
  assert.equal(restoreGame(lvl.board, { id: 'x', moves: [[0, 0]], extraAts: [], undo: 0, hints: 0 }), null);
});

test('сессия сохраняется, мигрирует и сливается', () => {
  assert.equal(defaultSave().session, null);
  assert.equal(migrate({ version: 1 }).session, null);
  const a = { ...defaultSave(), updatedAt: 1, session: { id: 'ch1:l2', moves: [[0, 1]] as Array<[number, number]>, extraAts: [], undo: 0, hints: 0 } };
  const b = { ...defaultSave(), updatedAt: 2, session: null };
  assert.equal(mergeSaves(a, b).session?.id, 'ch1:l2');
});
