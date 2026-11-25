import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chapterDone, firstUnfinishedIndex, freeDone, isUnlocked, totalStars } from '../src/core/progress';
import { chapterLevel, findLevel, freeLevel, nextLevel } from '../src/content/levels';
import { CHAPTERS } from '../src/content/chapters';

const ids = ['a', 'b', 'c'];

test('открытие уровней по цепочке', () => {
  assert.equal(isUnlocked({}, ids, 0), true);
  assert.equal(isUnlocked({}, ids, 1), false);
  assert.equal(isUnlocked({ a: 2 }, ids, 1), true);
  assert.equal(isUnlocked({ a: 2 }, ids, 2), false);
});

test('глава пройдена, первый непройденный, звёзды', () => {
  assert.equal(chapterDone({ a: 1, b: 3 }, ids), false);
  assert.equal(chapterDone({ a: 1, b: 3, c: 2 }, ids), true);
  assert.equal(firstUnfinishedIndex({ a: 1 }, ids), 1);
  assert.equal(firstUnfinishedIndex({ a: 1, b: 1, c: 1 }, ids), 2);
  assert.equal(totalStars({ a: 1, b: 3 }), 4);
});

test('свободная игра: прогресс по категориям раздельный', () => {
  const p = { 'free:easy:1': 3, 'free:easy:2': 1, 'free:hard:1': 2, 'ch1:l1': 3 };
  assert.equal(freeDone(p, 'easy'), 2);
  assert.equal(freeDone(p, 'hard'), 1);
  assert.equal(freeDone(p, 'medium'), 0);
});

test('навигация по уровням: следующий, конец главы, поиск по id', () => {
  const n = nextLevel(chapterLevel(1, 0)!)!;
  assert.equal(n.id, 'ch1:l2');
  assert.equal(nextLevel(chapterLevel(1, CHAPTERS[0]!.levels.length - 1)!), null);
  assert.equal(nextLevel(freeLevel('easy', 4))!.id, 'free:easy:5');
  assert.equal(findLevel('ch1:l3')!.num, 3);
  assert.equal(findLevel('free:expert:7')!.cat, 'expert');
  assert.equal(findLevel('nonsense'), null);
});
