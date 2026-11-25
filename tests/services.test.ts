import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CooldownClock, formatMMSS } from '../src/core/cooldown';
import { buyBonus, consumeBonus, levelReward } from '../src/core/economy';
import { applyPurchase } from '../src/core/shop';
import { defaultSave, mergeSaves, migrate } from '../src/core/save';
import { MockSdk } from '../src/services/yandexSdk';
import { BALANCE } from '../src/config/balance';

function fakeClock(start: number) {
  const t = { wall: start, mono: 0 };
  return { t, src: { wall: () => t.wall, mono: () => t.mono } };
}

test('кулдаун: 5 минут, переживает перезапуск через сохранение', () => {
  const { t, src } = fakeClock(1_000_000);
  const c = new CooldownClock(src, { nextAvailableAt: 0, lastKnownTime: 0 });
  assert.equal(c.ready(), true);
  c.start(300_000);
  assert.equal(formatMMSS(c.remainingMs()), '05:00');
  t.wall += 60_000; t.mono += 60_000;
  assert.equal(formatMMSS(c.remainingMs()), '04:00');
  const saved = c.toSave();
  const c2 = new CooldownClock(src, saved);
  assert.equal(c2.ready(), false);
  t.wall += 240_000; t.mono += 240_000;
  assert.equal(c2.ready(), true);
});

test('кулдаун: перевод часов назад в сессии не сокращает ожидание', () => {
  const { t, src } = fakeClock(5_000_000);
  const c = new CooldownClock(src, { nextAvailableAt: 0, lastKnownTime: 0 });
  c.start(300_000);
  t.wall -= 3_600_000; // игрок откатил часы на час
  t.mono += 10_000;
  assert.equal(c.remainingMs(), 290_000);
});

test('кулдаун: откат часов между запусками не помогает', () => {
  const { t, src } = fakeClock(9_000_000);
  const c = new CooldownClock(src, { nextAvailableAt: 0, lastKnownTime: 0 });
  c.start(300_000);
  c.now();
  const saved = c.toSave();
  t.wall -= 3_600_000;
  const c2 = new CooldownClock(src, saved);
  assert.ok(c2.remainingMs() >= 300_000 - 1);
});

test('экономика: покупка бонуса, нехватка валюты, трата', () => {
  let s = { ...defaultSave(), rare: 3 };
  const b = buyBonus(s, 'hint');
  assert.equal(b.result, 'ok');
  assert.equal(b.save.rare, 3 - BALANCE.bonuses.hint.priceRare);
  assert.equal(buyBonus({ ...s, rare: 0 }, 'hint').result, 'not_enough_rare');
  s = { ...s, bonuses: { ...s.bonuses, undo: 0 } };
  assert.equal(consumeBonus(s, 'undo', 0), null);
  assert.equal(levelReward(3, true), BALANCE.rewards.coinsPerLevel[3] * 2);
});

test('платежи: начисление идемпотентно по purchaseToken', () => {
  const s = defaultSave();
  const a = applyPurchase(s, 't1', [{ kind: 'rare', n: 50 }]);
  const b = applyPurchase(a.save, 't1', [{ kind: 'rare', n: 50 }]);
  assert.equal(a.applied, true);
  assert.equal(b.applied, false);
  assert.equal(b.save.rare, 50);
});

test('mock payments: незавершённая покупка видна при старте и снимается consume', async () => {
  const sdk = new MockSdk();
  const p = await sdk.payments.purchase('rare_pack_small');
  assert.equal((await sdk.payments.getPurchases()).length, 1);
  await sdk.payments.consume(p.purchaseToken);
  assert.equal((await sdk.payments.getPurchases()).length, 0);
  sdk.nextPurchaseError = 'cancelled';
  await assert.rejects(sdk.payments.purchase('x'));
});

test('миграция: v0 -> v1, мусор -> дефолт, будущая версия читается', () => {
  const m = migrate({ coins: 120, level: 3 });
  assert.equal(m.version, 1);
  assert.equal(m.coins, 120);
  assert.deepEqual(Object.keys(m.progress), ['ch1:l1', 'ch1:l2', 'ch1:l3']);
  assert.deepEqual(migrate(null), defaultSave());
  assert.equal(migrate({ version: 99, coins: 5 }).coins, 5);
});

test('слияние: прогресс по максимуму, кулдаун не обнуляется, покупки объединяются', () => {
  const a = { ...defaultSave(), updatedAt: 10, progress: { 'ch1:l1': 3 }, adCooldown: { nextAvailableAt: 900, lastKnownTime: 500 } };
  const b = { ...defaultSave(), updatedAt: 20, progress: { 'ch1:l1': 1, 'ch1:l2': 2 }, processedPurchases: ['p1'] };
  const m = mergeSaves(a, b);
  assert.deepEqual(m.progress, { 'ch1:l1': 3, 'ch1:l2': 2 });
  assert.equal(m.adCooldown.nextAvailableAt, 900);
  assert.deepEqual(m.processedPurchases, ['p1']);
});

test('реклама: награда только если rewarded=true; ошибка не стартует кулдаун', async () => {
  const sdk = new MockSdk();
  const { t, src } = fakeClock(1);
  const cd = new CooldownClock(src, { nextAvailableAt: 0, lastKnownTime: 0 });
  const claim = async () => {
    const r = await sdk.showRewarded();
    if (r.ok && r.rewarded) { cd.start(300_000); return true; }
    return false;
  };
  sdk.nextAd = { ok: false, error: 'no ads' };
  assert.equal(await claim(), false);
  assert.equal(cd.ready(), true);
  sdk.nextAd = { ok: true, rewarded: false }; // закрыл рекламу досрочно
  assert.equal(await claim(), false);
  sdk.nextAd = { ok: true, rewarded: true };
  assert.equal(await claim(), true);
  assert.equal(cd.ready(), false);
  t.mono += 300_000; t.wall += 300_000;
  assert.equal(cd.ready(), true);
});
