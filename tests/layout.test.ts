import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseLayout, viewHeightFor, type LayoutParams } from '../src/render/layout';

const P: LayoutParams = { spacing: 1.32, rowGap: 3.55, bottleH: 2.95, elev: 0.26 };
const PHONE = 9 / 19.5, DESKTOP = 16 / 9, SQUARE = 1.0, ULTRA = 21 / 9;

test('телефон: не больше 5 бутылок на полке, как раньше', () => {
  for (let n = 3; n <= 20; n++) {
    const [rows, per] = chooseLayout(n, PHONE, P);
    assert.ok(rows * per >= n && per <= 5, `n=${n}: ${rows}x${per}`);
  }
  assert.deepEqual(chooseLayout(4, PHONE, P), [1, 4]);
  assert.deepEqual(chooseLayout(8, PHONE, P), [2, 4]);
});

test('ПК 16:9: все бутылки помещаются, рядов не больше 5, до 10 в ряд', () => {
  for (let n = 3; n <= 20; n++) {
    const [rows, per] = chooseLayout(n, DESKTOP, P);
    assert.ok(rows * per >= n && rows <= 5 && per <= 10, `n=${n}: ${rows}x${per}`);
    assert.ok((rows - 1) * per < n, `n=${n}: нет пустых рядов`);
  }
  assert.equal(chooseLayout(8, DESKTOP, P)[0], 1);   // 8 бутылок — один ряд
  assert.equal(chooseLayout(20, DESKTOP, P)[0], 2);  // 20 — два ряда по 10
});

test('выбранная раскладка — лучшая по размеру бутылок среди допустимых', () => {
  for (const aspect of [SQUARE, DESKTOP, ULTRA]) {
    for (let n = 4; n <= 20; n++) {
      const [r, per] = chooseLayout(n, aspect, P);
      const best = viewHeightFor(r, per, aspect, P);
      const maxPer = aspect < 1.3 ? 7 : 10;
      for (let r2 = Math.ceil(n / maxPer); r2 <= Math.min(n, 5); r2++) {
        assert.ok(best <= viewHeightFor(r2, Math.ceil(n / r2), aspect, P) + 1e-6, `aspect=${aspect.toFixed(2)} n=${n}`);
      }
    }
  }
});

test('на широком экране бутылки не мельче, чем в телефонной раскладке того же экрана', () => {
  for (let n = 4; n <= 20; n++) {
    const [r, per] = chooseLayout(n, DESKTOP, P);
    const phoneLike = chooseLayout(n, PHONE, P); // та же «вертикальная» раскладка на широком экране
    assert.ok(viewHeightFor(r, per, DESKTOP, P) <= viewHeightFor(phoneLike[0], phoneLike[1], DESKTOP, P) + 1e-6);
  }
});
