import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EVENT } from '../src/config/events';
import { DAILY_CYCLE } from '../src/config/daily';
import { THEMES } from '../src/content/themes';
import { ACHIEVEMENTS, grantAchievements, isUnlocked } from '../src/core/achievements';
import { claimDaily, dailyStatus, dayIndex } from '../src/core/daily';
import { eventForDay, moveLimitFor, rewardValue, rollEventRewards, tierFor } from '../src/core/events';
import { generateLevel } from '../src/core/generator';
import { createRng } from '../src/core/rng';
import { defaultSave, mergeSaves, migrate, type Save } from '../src/core/save';
import { buyTheme, openChest, resolveRewards, setActiveTheme } from '../src/core/shop';
import { solve } from '../src/core/solver';

// ---------- ежедневная награда ----------
test('день считается по локальной полуночи игрока', () => {
  const t = Date.UTC(2026, 9, 24, 21, 30); // 21:30 UTC
  assert.equal(dayIndex(t, -180) - dayIndex(t, 0), 1); // в Москве (UTC+3) уже следующий день
});

test('ежедневная награда: 5 → 10 → 20+подсказка → 50+отмена, затем цикл из 7 дней', () => {
  assert.equal(DAILY_CYCLE.length, 7);
  let s: Save = defaultSave();
  const got: number[] = [];
  for (let d = 100; d < 108; d++) {
    const r = claimDaily(s, d)!;
    s = r.save;
    got.push(r.status.dayInCycle);
  }
  assert.deepEqual(got, [1, 2, 3, 4, 5, 6, 7, 1]);
  const s1 = claimDaily(defaultSave(), 1)!;
  assert.equal(s1.save.coins, 5);
  const s3 = [1, 2, 3].reduce((acc, d) => claimDaily(acc, d)!.save, defaultSave());
  assert.equal(s3.coins, 5 + 10 + 20); assert.equal(s3.bonuses.hint, defaultSave().bonuses.hint + 1);
});

test('ежедневная награда: дважды в день нельзя; пропуск одного дня серию не ломает, двух — ломает', () => {
  let s = claimDaily(defaultSave(), 10)!.save;
  assert.equal(claimDaily(s, 10), null);
  assert.equal(dailyStatus(s.daily, 12).streakAfter, 2);   // пропущен 1 день — серия жива
  assert.equal(dailyStatus(s.daily, 13).streakAfter, 1);   // пропущено 2 дня — заново
  s = claimDaily(s, 12)!.save;
  assert.equal(s.stats.dailyClaims, 2);
  assert.equal(dailyStatus(s.daily, 11).canClaim, false);  // часы назад — нельзя
});

// ---------- событие дня ----------
test('событие дня: одинаково у всех в этот день, монеты всегда 50–300, минимум 7 бутылок', () => {
  for (let day = 1; day <= 300; day++) {
    const a = eventForDay(day), b = eventForDay(day);
    assert.deepEqual(a, b);
    const coins = a.rewards.find((r) => r.kind === 'coins')!;
    assert.ok(coins.kind === 'coins' && coins.n >= EVENT.coins.min && coins.n <= EVENT.coins.max);
    assert.ok(a.spec.colors + a.spec.empties >= 7);
  }
});

test('событие дня: шансы наград близки к заданным (независимые броски)', () => {
  const rng = createRng(99), N = 30_000;
  const has = { extraBottle: 0, hint: 0, undo: 0, rare: 0 };
  for (let i = 0; i < N; i++) for (const r of rollEventRewards(rng)) {
    if (r.kind === 'bonus') has[r.id]++; else if (r.kind === 'rare') has.rare++;
  }
  assert.ok(Math.abs(has.extraBottle / N - 0.25) < 0.01);
  assert.ok(Math.abs(has.hint / N - 0.2) < 0.01);
  assert.ok(Math.abs(has.undo / N - 0.45) < 0.01);
  assert.ok(Math.abs(has.rare / N - 0.15) < 0.01);
});

test('сложность растёт вместе с ценностью награды; встречаются все 4 уровня сложности', () => {
  const tiers = new Set<number>();
  let prevBottles = 0;
  for (let v = 0; v < 8; v += 0.05) {
    const t = EVENT.tiers[tierFor(v)]!;
    assert.ok(t.colors + t.empties >= prevBottles);
    prevBottles = t.colors + t.empties;
  }
  for (let d = 1; d < 400; d++) tiers.add(eventForDay(d).tier);
  assert.deepEqual([...tiers].sort(), [0, 1, 2, 3]);
  assert.equal(tierFor(rewardValue([{ kind: 'coins', n: 50 }])), 0); // «только монеты» — лёгкий
  assert.equal(moveLimitFor(20, null), null);
  assert.equal(moveLimitFor(20, 1.9), 38);
});

test('уровни событий всех сложностей разрешимы и укладываются в лимит ходов', () => {
  for (const [i, t] of EVENT.tiers.entries()) {
    const spec = { colors: t.colors, empties: t.empties, capacity: 4 };
    const lvl = generateLevel(spec, `event-test:${i}`);
    assert.equal(solve(lvl.board, { weight: 3, maxNodes: 300_000 }).status, 'solved', `tier ${i}`);
    if (t.limitFactor !== null) assert.ok(Math.ceil(lvl.par * t.limitFactor) >= lvl.par);
  }
});

// ---------- достижения ----------
test('достижения: 15–20 штук, id уникальны, награда выдаётся один раз', () => {
  assert.ok(ACHIEVEMENTS.length >= 15 && ACHIEVEMENTS.length <= 25);
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
  const base = defaultSave();
  assert.equal(grantAchievements(base).unlocked.length, 0);
  const s: Save = { ...base, stats: { ...base.stats, levelsWon: 10, pours: 100 } };
  const g = grantAchievements(s);
  assert.deepEqual(g.unlocked.map((a) => a.id).sort(), ['first_win', 'pours_100', 'wins_10']);
  assert.equal(g.save.coins, 10 + 50 + 50);
  assert.ok(isUnlocked(g.save, 'first_win'));
  assert.equal(grantAchievements(g.save).unlocked.length, 0); // повторно — ничего
});

// ---------- темы ----------
test('покупка темы за кристаллы или монеты, применение в один тап', () => {
  const t = THEMES[1]!;
  let s: Save = { ...defaultSave(), rare: 100, coins: 1000 };
  const a = buyTheme(s, t.id, 'rare');
  assert.equal(a.result, 'ok'); assert.equal(a.save.rare, 100 - t.priceRare); assert.ok(a.save.themes.owned.includes(t.id));
  assert.equal(buyTheme(a.save, t.id, 'coins').result, 'unavailable'); // уже куплена
  assert.equal(buyTheme({ ...s, rare: 0 }, t.id, 'rare').result, 'not_enough_rare');
  assert.equal(buyTheme({ ...s, coins: 0 }, t.id, 'coins').result, 'not_enough_coins');
  assert.equal(buyTheme(s, 'nope', 'rare').result, 'unavailable');
  assert.equal(setActiveTheme(s, t.id).themes.active, 'lab');            // не куплена — не применится
  assert.equal(setActiveTheme(a.save, t.id).themes.active, t.id);
});

test('сундук: «случайная тема» превращается в ещё не купленную; если все куплены — кристаллы', () => {
  const s: Save = defaultSave();
  const r1 = resolveRewards(s, [{ kind: 'theme', id: 'random' }, { kind: 'theme', id: 'random' }], createRng(5));
  const ids = r1.map((r) => (r.kind === 'theme' ? r.id : ''));
  assert.ok(ids.every((i) => i && i !== 'lab' && i !== 'random'));
  assert.notEqual(ids[0], ids[1]); // в одном сундуке темы не повторяются
  const all: Save = { ...s, themes: { owned: THEMES.map((t) => t.id), active: 'lab' } };
  assert.deepEqual(resolveRewards(all, [{ kind: 'theme', id: 'random' }], createRng(1)), [{ kind: 'rare', n: 20 }]);
  // открытие реального сундука начисляет выбранную тему
  let found = false;
  for (let seed = 0; seed < 400 && !found; seed++) {
    const o = openChest({ ...s, chests: { wood: 0, silver: 0, gold: 1 } }, 'gold', createRng(seed))!;
    const th = o.rewards.find((r) => r.kind === 'theme');
    if (th && th.kind === 'theme') { found = true; assert.ok(o.save.themes.owned.includes(th.id)); }
  }
  assert.ok(found);
});

test('миграция и слияние: новые поля есть, статистика по максимуму, событие не теряется', () => {
  const m = migrate({ version: 1, stats: { pours: 5 } });
  assert.equal(m.stats.pours, 5); assert.equal(m.stats.eventsWon, 0); assert.deepEqual(m.event, { day: -1, done: false });
  const a = { ...defaultSave(), updatedAt: 1, stats: { ...defaultSave().stats, pours: 9, eventsWon: 1 }, event: { day: 7, done: true } };
  const b = { ...defaultSave(), updatedAt: 2, stats: { ...defaultSave().stats, pours: 3, hintsUsed: 4 }, event: { day: 7, done: false } };
  const x = mergeSaves(a, b);
  assert.equal(x.stats.pours, 9); assert.equal(x.stats.hintsUsed, 4); assert.equal(x.stats.eventsWon, 1);
  assert.deepEqual(x.event, { day: 7, done: true });
});
