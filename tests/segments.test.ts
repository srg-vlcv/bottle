import { test } from 'node:test';
import assert from 'node:assert/strict';
import { segmentsOf, totalAmount, withDelta } from '../src/core/segments';

test('сегменты: слои сливаются в блоки', () => {
  assert.deepEqual(segmentsOf({ cap: 4, layers: [0, 1, 1, 2] }), [
    { color: 0, amount: 1 }, { color: 1, amount: 2 }, { color: 2, amount: 1 },
  ]);
  assert.deepEqual(segmentsOf({ cap: 4, layers: [] }), []);
});

test('withDelta: убывание сверху, дробные значения, исходник не мутируется', () => {
  const s = segmentsOf({ cap: 4, layers: [0, 1, 1] });
  const half = withDelta(s, 1, -1.5);
  assert.deepEqual(half, [{ color: 0, amount: 1 }, { color: 1, amount: 0.5 }]);
  assert.deepEqual(s, [{ color: 0, amount: 1 }, { color: 1, amount: 2 }]);
  assert.deepEqual(withDelta(s, 1, -2), [{ color: 0, amount: 1 }]);
});

test('withDelta: прибавление в пустую и на тот же цвет; сумма сохраняется при переливании', () => {
  assert.deepEqual(withDelta([], 3, 0.5), [{ color: 3, amount: 0.5 }]);
  const src = segmentsOf({ cap: 4, layers: [2, 2, 2] }), dst = segmentsOf({ cap: 4, layers: [2] });
  for (const p of [0, 0.3, 1.7, 3]) {
    assert.ok(Math.abs(totalAmount(withDelta(src, 2, -p)) + totalAmount(withDelta(dst, 2, p)) - 4) < 1e-9);
  }
});
