import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/config/balance';
import { nextAdCooldown } from '../src/core/adchain';
import { addBonus, consumeBonus } from '../src/core/economy';
import { regenIntervalMs, regenRemainingMs, tickRegen } from '../src/core/regen';
import { defaultSave } from '../src/core/save';

const MIN = 60_000;

test('трата полного запаса запускает таймер восстановления', () => {
  const s = defaultSave();
  const after = consumeBonus(s, 'hint', 1000)!;
  assert.equal(after.bonuses.hint, BALANCE.bonuses.hint.cap - 1);
  assert.equal(after.regen.hint, 1000);
  // повторная трата не сбрасывает таймер
  assert.equal(consumeBonus(after, 'hint', 5000)!.regen.hint, 1000);
  assert.equal(consumeBonus({ ...s, bonuses: { ...s.bonuses, undo: 0 } }, 'undo', 0), null);
});

test('бутылка не восстанавливается сама, только добавляется', () => {
  const s = consumeBonus(defaultSave(), 'extraBottle', 10)!;
  assert.equal(s.bonuses.extraBottle, 0);
  assert.equal(tickRegen(s, 10 * 60 * MIN), s);
  assert.equal(addBonus(s, 'extraBottle').bonuses.extraBottle, 1);
});

test('восстановление: по единице за regenFullMs/cap, остаток таймера сохраняется', () => {
  const iv = regenIntervalMs('hint'); // 20 мин
  assert.equal(iv, 20 * MIN);
  let s = { ...defaultSave(), bonuses: { ...defaultSave().bonuses, hint: 0 }, regen: { undo: 0, hint: 1000 } };
  const t = tickRegen(s, 1000 + 45 * MIN);
  assert.equal(t.bonuses.hint, 2);
  assert.equal(t.regen.hint, 1000 + 40 * MIN);
  assert.equal(regenRemainingMs(t, 'hint', 1000 + 45 * MIN), 15 * MIN);
  s = tickRegen(t, 1000 + 45 * MIN) as typeof s;
  assert.equal(s, t); // без изменений — та же ссылка
});

test('офлайн долго: упираемся в cap и таймер паркуется', () => {
  const s = { ...defaultSave(), bonuses: { ...defaultSave().bonuses, undo: 1 }, regen: { undo: 5, hint: 0 } };
  const t = tickRegen(s, 100 * 60 * MIN);
  assert.equal(t.bonuses.undo, BALANCE.bonuses.undo.cap);
  assert.equal(regenRemainingMs(t, 'undo', 100 * 60 * MIN), null);
});

test('откат часов не даёт бонусов, таймер перезапускается от «сейчас»', () => {
  const s = { ...defaultSave(), bonuses: { ...defaultSave().bonuses, hint: 0 }, regen: { undo: 0, hint: 10 * 60 * MIN } };
  const t = tickRegen(s, 5 * 60 * MIN);
  assert.equal(t.bonuses.hint, 0);
  assert.equal(t.regen.hint, 5 * 60 * MIN);
});

test('лестница кулдаунов рекламы: 2 → 5 → 10 → 20 → 20', () => {
  const cfg = BALANCE.rewardedAd;
  let step = 0, next = 0, now = 1_000_000;
  const got: number[] = [];
  for (let i = 0; i < 5; i++) {
    const r = nextAdCooldown(step, next, now, cfg);
    got.push(r.cooldownMs / MIN);
    step = r.step; next = now + r.cooldownMs; now = next + 1000; // берёт сразу, как только доступно
  }
  assert.deepEqual(got, [2, 5, 10, 20, 20]);
});

test('по умолчанию лестница не сбрасывается: вернулся через сутки — ступень та же', () => {
  const prevNext = 5_000_000;
  assert.equal(BALANCE.rewardedAd.resetAfterMs, null);
  const r = nextAdCooldown(3, prevNext, prevNext + 24 * 60 * MIN, BALANCE.rewardedAd);
  assert.equal(r.cooldownMs, 20 * MIN);
  assert.equal(r.step, 4);
});

test('сброс лестницы можно включить в конфиге', () => {
  const cfg = { scheduleMs: BALANCE.rewardedAd.scheduleMs, resetAfterMs: 60 * MIN };
  const prevNext = 5_000_000;
  assert.equal(nextAdCooldown(3, prevNext, prevNext + 30 * MIN, cfg).cooldownMs, 20 * MIN);
  assert.equal(nextAdCooldown(3, prevNext, prevNext + 60 * MIN, cfg).cooldownMs, 2 * MIN);
});
