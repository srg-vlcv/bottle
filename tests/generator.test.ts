import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bakedLevel } from '../src/content/baked';
import { findLevel } from '../src/content/levels';
import { generateLevel, starsFor } from '../src/core/generator';
import { solve } from '../src/core/solver';
import { CHAPTERS } from '../src/content/chapters';
import { freePlaySeed, freePlaySpec, type FreePlayCategory } from '../src/core/freeplay';

test('детерминизм: один seed — одна и та же доска', () => {
  const spec = { colors: 5, empties: 2, capacity: 4 };
  assert.deepEqual(generateLevel(spec, 'x:1').board, generateLevel(spec, 'x:1').board);
  assert.notDeepEqual(generateLevel(spec, 'x:1').board, generateLevel(spec, 'x:2').board);
});

test('запечённые уровни актуальны и разрешимы для ВСЕХ глав (если устарели — запустите npm run bake)', () => {
  let n = 0;
  for (const ch of CHAPTERS) {
    for (const lv of ch.levels) {
      const baked = bakedLevel(lv.spec, lv.seed, lv.minPar);
      assert.ok(baked, `${lv.id}: нет актуальной запечённой копии — npm run bake`);
      const r = solve(baked!.board, { weight: 3, maxNodes: 400_000 });
      assert.equal(r.status, 'solved', `${lv.id} неразрешим`);
      assert.ok(baked!.par >= 1 && baked!.par <= r.moves.length + 40, `${lv.id}: par`);
      n++;
    }
  }
  assert.ok(n >= 80);
});

test('запечённая копия совпадает с тем, что даёт генератор (выборка)', () => {
  for (const id of ['ch1:l6', 'ch2:l3', 'ch3:l5', 'ch4:l4']) {
    const lv = findLevel(id)!;
    assert.deepEqual(generateLevel(lv.spec, lv.seed, { minPar: lv.minPar }), bakedLevel(lv.spec, lv.seed, lv.minPar), id);
  }
});

test('Глава 1: 15–20 уровней, есть босс и обучающие вставки', () => {
  const ch1 = CHAPTERS[0]!;
  assert.ok(ch1.levels.length >= 15 && ch1.levels.length <= 20);
  assert.ok(ch1.levels.some((l) => l.boss));
  assert.ok(ch1.levels.filter((l) => l.tutorial).length >= 4);
  assert.equal(ch1.levels[0]!.spec.colors, 2);
});

test('свободная игра: 40 случайных seed по всем категориям разрешимы', () => {
  const cats: FreePlayCategory[] = ['easy', 'medium', 'hard', 'expert'];
  for (const c of cats) {
    for (let n = 1; n <= 10; n++) {
      const spec = freePlaySpec(c, n * 3);
      const g = generateLevel(spec, freePlaySeed(c, n * 3));
      assert.equal(solve(g.board, { weight: 3, maxNodes: 300_000 }).status, 'solved', `${c}#${n}`);
    }
  }
});

test('категории по числу бутылок', () => {
  const total = (c: FreePlayCategory, n: number) => { const s = freePlaySpec(c, n); return s.colors + s.empties; };
  assert.ok(total('easy', 1) >= 5 && total('easy', 99) <= 6);
  assert.ok(total('medium', 1) >= 7 && total('medium', 99) <= 9);
  assert.ok(total('hard', 1) >= 10 && total('hard', 99) <= 12);
  assert.ok(total('expert', 1) >= 13);
});

test('звёзды по отношению к par', () => {
  assert.equal(starsFor(10, 10, 1.15, 1.6), 3);
  assert.equal(starsFor(14, 10, 1.15, 1.6), 2);
  assert.equal(starsFor(30, 10, 1.15, 1.6), 1);
});
