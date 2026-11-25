import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHEST_TIERS, CHESTS, PRODUCTS } from '../src/config/shop';
import { createRng } from '../src/core/rng';
import { defaultSave, migrate, type Save } from '../src/core/save';
import { buyBonusCoins, buyBonusRare, buyChest, chestOdds, openChest, rollChest } from '../src/core/shop';
import { PaymentsService } from '../src/services/payments';
import { MockSdk } from '../src/services/yandexSdk';

test('шансы сундуков нормированы и считаются из тех же весов, что и розыгрыш', () => {
  for (const tier of CHEST_TIERS) {
    const odds = chestOdds(tier);
    assert.ok(Math.abs(odds.reduce((a, o) => a + o.p, 0) - 1) < 1e-9, tier);
    assert.equal(odds.length, CHESTS[tier].loot.length);
  }
});

test('розыгрыш детерминирован по seed и даёт rolls предметов', () => {
  for (const tier of CHEST_TIERS) {
    const a = rollChest(tier, createRng(7)), b = rollChest(tier, createRng(7));
    assert.deepEqual(a, b);
    assert.equal(a.length, CHESTS[tier].rolls);
  }
});

test('статистика: частоты на большой выборке близки к заявленным шансам', () => {
  const rng = createRng(12345), N = 40_000;
  const counts = new Map<string, number>();
  for (let i = 0; i < N; i++) for (const r of rollChest('silver', rng)) counts.set(JSON.stringify(r), (counts.get(JSON.stringify(r)) ?? 0) + 1);
  const total = N * CHESTS.silver.rolls;
  for (const o of chestOdds('silver')) {
    const f = (counts.get(JSON.stringify(o.reward)) ?? 0) / total;
    assert.ok(Math.abs(f - o.p) < 0.01, `${JSON.stringify(o.reward)}: ${f.toFixed(3)} vs ${o.p.toFixed(3)}`);
  }
});

test('сундук золотой невыгодно «фармить»: ожидаемые кристаллы ниже цены', () => {
  for (const tier of CHEST_TIERS) {
    const exp = chestOdds(tier).reduce((a, o) => a + (o.reward.kind === 'rare' ? o.reward.n * o.p : 0), 0) * CHESTS[tier].rolls;
    assert.ok(exp < CHESTS[tier].priceRare, `${tier}: ${exp} >= ${CHESTS[tier].priceRare}`);
  }
});

test('покупка и открытие сундука: списание, запас, награда', () => {
  let s: Save = { ...defaultSave(), rare: 20 };
  const b = buyChest(s, 'silver');
  assert.equal(b.result, 'ok'); assert.equal(b.save.rare, 5); assert.equal(b.save.chests.silver, 1);
  assert.equal(buyChest({ ...s, rare: 3 }, 'wood').result, 'not_enough_rare');
  s = b.save;
  const o = openChest(s, 'silver', createRng(1))!;
  assert.equal(o.save.chests.silver, 0);
  assert.equal(o.rewards.length, 2);
  assert.equal(openChest(o.save, 'silver', createRng(1)), null); // запас пуст
});

test('бонусы за кристаллы и монеты; бутылка за монеты не продаётся', () => {
  const s: Save = { ...defaultSave(), rare: 10, coins: 100 };
  assert.equal(buyBonusRare(s, 'hint').save.bonuses.hint, s.bonuses.hint + 1);
  assert.equal(buyBonusRare({ ...s, rare: 0 }, 'hint').result, 'not_enough_rare');
  assert.equal(buyBonusCoins(s, 'undo').save.coins, 60);
  assert.equal(buyBonusCoins({ ...s, coins: 1 }, 'undo').result, 'not_enough_coins');
  assert.equal(buyBonusCoins(s, 'extraBottle').result, 'unavailable');
});

test('миграция: у старых сохранений появляются сундуки', () => {
  assert.deepEqual(migrate({ version: 1, coins: 5 }).chests, { wood: 0, silver: 0, gold: 0 });
});

// ---------- платежи ----------
function makeService() {
  const sdk = new MockSdk();
  let save: Save = defaultSave();
  const flushes: number[] = [];
  const svc = new PaymentsService(sdk, () => save, (fn) => { save = fn(save); }, async () => { flushes.push(1); });
  return { sdk, svc, get save() { return save; }, flushes };
}

test('платежи: покупка начисляет награду, сохраняет и гасит consume', async () => {
  const t = makeService();
  const r = await t.svc.buy('rare_50');
  assert.equal(r.ok, true);
  assert.equal(t.save.rare, 50);
  assert.equal(t.flushes.length, 1);
  assert.equal((await t.sdk.payments.getPurchases()).length, 0);
});

test('платежи: пакет сундуков кладёт сундуки в запас', async () => {
  const t = makeService();
  await t.svc.buy('chests_gold_1');
  assert.equal(t.save.chests.gold, 1); assert.equal(t.save.rare, 10);
});

test('платежи: незавершённая покупка добирается при старте ровно один раз', async () => {
  const t = makeService();
  t.sdk.pending.push({ productID: 'rare_150', purchaseToken: 'orphan-1' }); // игра закрылась до начисления
  assert.equal(await t.svc.recoverPending(), 1);
  assert.equal(t.save.rare, 150);
  // consume не прошёл в прошлый раз (токен остался в getPurchases), но начислять повторно нельзя
  t.sdk.pending.push({ productID: 'rare_150', purchaseToken: 'orphan-1' });
  assert.equal(await t.svc.recoverPending(), 0);
  assert.equal(t.save.rare, 150);
  assert.equal((await t.sdk.payments.getPurchases()).length, 0);
});

test('платежи: отмена и ошибка не меняют состояние', async () => {
  const t = makeService();
  t.sdk.nextPurchaseError = 'user cancelled';
  assert.deepEqual(await t.svc.buy('rare_50'), { ok: false, reason: 'cancelled' });
  t.sdk.nextPurchaseError = 'network down';
  assert.deepEqual(await t.svc.buy('rare_50'), { ok: false, reason: 'error' });
  assert.equal(t.save.rare, 0);
  assert.deepEqual(await t.svc.buy('no_such'), { ok: false, reason: 'unknown_product' });
});

test('платежи: неизвестный товар в незавершённых не начисляется и не гасится', async () => {
  const t = makeService();
  t.sdk.pending.push({ productID: 'mystery', purchaseToken: 'x' });
  assert.equal(await t.svc.recoverPending(), 0);
  assert.equal((await t.sdk.payments.getPurchases()).length, 1);
});

test('каталог: у каждого товара есть id, награды и тексты RU/EN', () => {
  const ids = new Set<string>();
  for (const p of PRODUCTS) {
    assert.ok(!ids.has(p.id)); ids.add(p.id);
    assert.ok(p.rewards.length > 0 && p.title.ru && p.title.en && p.desc.ru && p.desc.en && p.suggestedPriceYan > 0);
  }
});
